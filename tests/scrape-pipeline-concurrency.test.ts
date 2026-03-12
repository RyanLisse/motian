import { describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/event-bus", () => ({ publish: vi.fn() }));
vi.mock("../src/services/ai-enrichment", () => ({
  enrichJobsBatch: vi.fn(() => Promise.resolve()),
}));
vi.mock("../src/services/normalize", () => ({
  normalizeAndSaveJobs: vi.fn(),
}));
vi.mock("../src/services/record-scrape-result", () => ({
  recordScrapeResult: vi.fn(() => Promise.resolve()),
}));
vi.mock("../src/services/scrapers/index", () => ({
  scrapeFlextender: vi.fn(),
  scrapeOpdrachtoverheid: vi.fn(),
  scrapeStriive: vi.fn(),
}));

import {
  getScrapePipelineConcurrency,
  runScrapePipelinesWithConcurrency,
} from "../src/services/scrape-pipeline";

describe("getScrapePipelineConcurrency", () => {
  it("uses the default and clamps env overrides", () => {
    expect(getScrapePipelineConcurrency({} as NodeJS.ProcessEnv)).toBe(2);
    expect(
      getScrapePipelineConcurrency({ SCRAPE_PIPELINE_CONCURRENCY: "0" } as NodeJS.ProcessEnv),
    ).toBe(1);
    expect(
      getScrapePipelineConcurrency({ SCRAPE_PIPELINE_CONCURRENCY: "99" } as NodeJS.ProcessEnv),
    ).toBe(10);
    expect(
      getScrapePipelineConcurrency({ SCRAPE_PIPELINE_CONCURRENCY: "abc" } as NodeJS.ProcessEnv),
    ).toBe(2);
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
