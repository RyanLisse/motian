import { describe, expect, it, vi } from "vitest";

const { mockDbInsert, mockSyncJobSkills } = vi.hoisted(() => ({
  mockDbInsert: vi.fn(),
  mockSyncJobSkills: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/db", async (importOriginal) => ({
  ...(await importOriginal()),
  db: {
    insert: mockDbInsert,
  },
}));

vi.mock("../src/services/esco", () => ({
  syncJobSkills: mockSyncJobSkills,
}));

import { normalizeAndSaveJobs } from "../src/services/normalize";
import {
  getScrapePipelineConcurrency,
  runScrapePipelinesWithConcurrency,
} from "../src/services/scrape-pipeline";

const BATCH_INSERT_SIZE = 10;

describe("getScrapePipelineConcurrency", () => {
  it("uses the default and clamps env overrides", () => {
    expect(getScrapePipelineConcurrency({} as NodeJS.ProcessEnv)).toBe(4);
    expect(
      getScrapePipelineConcurrency({ SCRAPE_PIPELINE_CONCURRENCY: "0" } as NodeJS.ProcessEnv),
    ).toBe(1);
    expect(
      getScrapePipelineConcurrency({ SCRAPE_PIPELINE_CONCURRENCY: "99" } as NodeJS.ProcessEnv),
    ).toBe(10);
    expect(
      getScrapePipelineConcurrency({ SCRAPE_PIPELINE_CONCURRENCY: "abc" } as NodeJS.ProcessEnv),
    ).toBe(4);
  });
});

describe("runScrapePipelinesWithConcurrency", () => {
  it("preserves input order while honoring the concurrency cap", async () => {
    const configs = [
      { platform: "first", baseUrl: "https://example.com/1" },
      { platform: "second", baseUrl: "https://example.com/2" },
      { platform: "third", baseUrl: "https://example.com/3" },
    ];
    let active = 0;
    let maxActive = 0;

    const results = await runScrapePipelinesWithConcurrency(configs, {
      concurrency: 2,
      runner: async (config) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 10));
        active -= 1;

        return {
          jobsNew: config.platform.length,
          duplicates: 0,
          errors: [],
        };
      },
    });

    expect(maxActive).toBe(2);
    expect(results).toHaveLength(3);
    expect(
      results.map((result) =>
        result.status === "fulfilled" ? result.value.jobsNew : String(result.reason),
      ),
    ).toEqual([5, 6, 5]);
  });

  it("clamps explicit concurrency overrides below one", async () => {
    const calls: string[] = [];

    const results = await runScrapePipelinesWithConcurrency(
      [
        { platform: "alpha", baseUrl: "https://example.com/a" },
        { platform: "beta", baseUrl: "https://example.com/b" },
      ],
      {
        concurrency: 0,
        runner: async (config) => {
          calls.push(config.platform);
          return { jobsNew: 1, duplicates: 0, errors: [] };
        },
      },
    );

    expect(calls).toEqual(["alpha", "beta"]);
    expect(results.every((result) => result.status === "fulfilled")).toBe(true);
  });
});

describe("normalizeAndSaveJobs batch inserts", () => {
  it("executes DB insert batches sequentially without overlap", async () => {
    const insertWindows: Array<{ start: number; end: number }> = [];
    let activeInsertCalls = 0;
    let maxActiveInsertCalls = 0;

    const valuesMock = vi.fn((rows: Array<{ externalId: string }>) => ({
      onConflictDoUpdate: vi.fn().mockReturnThis(),
      returning: vi.fn(async () => {
        const insertWindow = { start: Date.now(), end: 0 };
        insertWindows.push(insertWindow);
        activeInsertCalls += 1;
        maxActiveInsertCalls = Math.max(maxActiveInsertCalls, activeInsertCalls);

        await new Promise((resolve) => setTimeout(resolve, 10));

        activeInsertCalls -= 1;
        insertWindow.end = Date.now();
        return rows.map((row) => ({
          id: `job-${row.externalId}`,
          externalId: row.externalId,
          isNew: true,
        }));
      }),
    }));

    mockDbInsert.mockImplementation(() => ({
      values: valuesMock,
    }));

    const listings = Array.from({ length: 120 }, (_, index) => ({
      externalId: `ext-${index + 1}`,
      externalUrl: `https://example.com/jobs/${index + 1}`,
      title: `Batch job ${index + 1}`,
      description: "This listing has a sufficiently long description for validation checks.",
      status: "open",
    }));

    const result = await normalizeAndSaveJobs("flextender", listings);

    expect(result.errors).toEqual([]);
    expect(mockDbInsert).toHaveBeenCalledTimes(12);
    expect(mockSyncJobSkills).toHaveBeenCalledTimes(120);
    expect(maxActiveInsertCalls).toBe(1);
    expect(insertWindows).toHaveLength(12);

    for (let index = 1; index < insertWindows.length; index += 1) {
      expect(insertWindows[index].start).toBeGreaterThanOrEqual(insertWindows[index - 1].end);
    }

    // Guard against regressions if batch size changes upstream.
    expect(valuesMock.mock.calls[0]?.[0]).toHaveLength(BATCH_INSERT_SIZE);
  });
});
