import { describe, expect, it, vi } from "vitest";
import { getOverviewData } from "../app/overzicht/data";
import type { db } from "../src/db";

function createAwaitableQuery<T>(result: T) {
  const promise = Promise.resolve(result);
  const chain: Promise<T> & {
    from?: ReturnType<typeof vi.fn>;
    where?: ReturnType<typeof vi.fn>;
    groupBy?: ReturnType<typeof vi.fn>;
    orderBy?: ReturnType<typeof vi.fn>;
    limit?: ReturnType<typeof vi.fn>;
    leftJoin?: ReturnType<typeof vi.fn>;
    innerJoin?: ReturnType<typeof vi.fn>;
  } = promise;
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.groupBy = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.leftJoin = vi.fn(() => chain);
  chain.innerJoin = vi.fn(() => chain);

  return chain;
}

describe("getOverviewData", () => {
  // Call order for database.select():
  // 1. platformCounts
  // 2. getRecentJobs (internal select)
  // 3. activeScrapers
  // 4. getRecentScrapes (internal select)
  // 5. pipelineStageCounts
  // 6. upcomingInterviewCountResult
  // 7. upcomingInterviews

  it("executes dashboard reads through one transaction-backed connection", async () => {
    const select = vi
      .fn()
      .mockReturnValueOnce(createAwaitableQuery([{ platform: "linkedin", count: 3, weeklyNew: 1 }]))
      .mockReturnValueOnce(
        createAwaitableQuery([
          {
            id: "job-1",
            title: "Engineer",
            company: "Motian",
            platform: "linkedin",
            location: "Utrecht",
            scrapedAt: new Date("2026-03-08T09:30:00.000Z"),
            endClient: null,
            province: null,
          },
        ]),
      )
      .mockReturnValueOnce(createAwaitableQuery([{ id: "cfg-1", platform: "linkedin" }]))
      .mockReturnValueOnce(
        createAwaitableQuery([
          { id: "run-1", config_id: "cfg-1", platform: "linkedin", status: "success" },
        ]),
      )
      .mockReturnValueOnce(createAwaitableQuery([{ stage: "new", count: 4 }]))
      .mockReturnValueOnce(createAwaitableQuery([{ count: 2 }]))
      .mockReturnValueOnce(createAwaitableQuery([{ id: "interview-1", candidateName: "Jane" }]));

    const result = await getOverviewData({ select } as unknown as typeof db);

    expect(select).toHaveBeenCalledTimes(7);
    expect(result.platformCounts).toEqual([{ platform: "linkedin", count: 3, weeklyNew: 1 }]);
    expect(result.recentJobs).toEqual([
      {
        id: "job-1",
        title: "Engineer",
        company: "Motian",
        platform: "linkedin",
        location: "Utrecht",
        scrapedAt: new Date("2026-03-08T09:30:00.000Z"),
      },
    ]);
    expect(result.recentScrapes).toEqual([
      {
        id: "run-1",
        configId: "cfg-1",
        platform: "linkedin",
        runAt: undefined,
        durationMs: undefined,
        jobsFound: undefined,
        jobsNew: undefined,
        duplicates: undefined,
        status: "success",
        errors: [],
      },
    ]);
    expect(result.pipelineStageCounts).toEqual([{ stage: "new", count: 4 }]);
    expect(result.upcomingInterviewCountResult).toEqual([{ count: 2 }]);
  });

  it("keeps one latest scrape row per platform for the overview data sources", async () => {
    const select = vi
      .fn()
      .mockReturnValueOnce(createAwaitableQuery([{ platform: "linkedin", count: 3, weeklyNew: 1 }]))
      .mockReturnValueOnce(
        createAwaitableQuery([
          {
            id: "job-latest",
            title: "Communicatieadviseur",
            company: "Gemeente Veere",
            platform: "flextender",
            location: "Zeeland",
            scrapedAt: new Date("2026-03-08T09:30:00.000Z"),
            endClient: null,
            province: null,
          },
        ]),
      )
      .mockReturnValueOnce(createAwaitableQuery([{ id: "cfg-1", platform: "linkedin" }]))
      .mockReturnValueOnce(
        createAwaitableQuery([
          {
            id: "run-linkedin",
            config_id: "cfg-1",
            platform: "linkedin",
            run_at: new Date("2026-03-08T09:00:00.000Z"),
            duration_ms: 1200,
            jobs_found: 10,
            jobs_new: 4,
            duplicates: 6,
            status: "success",
            errors: [],
          },
          {
            id: "run-indeed",
            config_id: "cfg-2",
            platform: "indeed",
            run_at: new Date("2026-03-08T08:00:00.000Z"),
            duration_ms: 1800,
            jobs_found: 8,
            jobs_new: 3,
            duplicates: 5,
            status: "partial",
            errors: ["Timeout"],
          },
        ]),
      )
      .mockReturnValueOnce(createAwaitableQuery([{ stage: "new", count: 4 }]))
      .mockReturnValueOnce(createAwaitableQuery([{ count: 2 }]))
      .mockReturnValueOnce(createAwaitableQuery([{ id: "interview-1", candidateName: "Jane" }]));

    const result = await getOverviewData({ select } as unknown as typeof db);

    expect(result.recentJobs).toEqual([
      {
        id: "job-latest",
        title: "Communicatieadviseur",
        company: "Gemeente Veere",
        platform: "flextender",
        location: "Zeeland",
        scrapedAt: new Date("2026-03-08T09:30:00.000Z"),
      },
    ]);
    expect(result.recentScrapes).toEqual([
      {
        id: "run-linkedin",
        configId: "cfg-1",
        platform: "linkedin",
        runAt: new Date("2026-03-08T09:00:00.000Z"),
        durationMs: 1200,
        jobsFound: 10,
        jobsNew: 4,
        duplicates: 6,
        status: "success",
        errors: [],
      },
      {
        id: "run-indeed",
        configId: "cfg-2",
        platform: "indeed",
        runAt: new Date("2026-03-08T08:00:00.000Z"),
        durationMs: 1800,
        jobsFound: 8,
        jobsNew: 3,
        duplicates: 5,
        status: "partial",
        errors: ["Timeout"],
      },
    ]);
  });

  it("deduplicates recent scrapes that only differ by platform casing or whitespace", async () => {
    const select = vi
      .fn()
      .mockReturnValueOnce(createAwaitableQuery([{ platform: "linkedin", count: 3, weeklyNew: 1 }]))
      .mockReturnValueOnce(
        createAwaitableQuery([
          {
            id: "job-latest",
            title: "Communicatieadviseur",
            company: "Gemeente Veere",
            platform: "flextender",
            location: "Zeeland",
            scrapedAt: new Date("2026-03-08T09:30:00.000Z"),
            endClient: null,
            province: null,
          },
        ]),
      )
      .mockReturnValueOnce(createAwaitableQuery([{ id: "cfg-1", platform: "linkedin" }]))
      .mockReturnValueOnce(
        createAwaitableQuery([
          {
            id: "run-flextender-latest",
            config_id: "cfg-1",
            platform: " Flextender ",
            run_at: new Date("2026-03-08T09:00:00.000Z"),
            duration_ms: 1200,
            jobs_found: 10,
            jobs_new: 4,
            duplicates: 6,
            status: "success",
            errors: [],
          },
          {
            id: "run-flextender-older",
            config_id: "cfg-2",
            platform: "flextender",
            run_at: new Date("2026-03-08T08:00:00.000Z"),
            duration_ms: 1800,
            jobs_found: 8,
            jobs_new: 3,
            duplicates: 5,
            status: "partial",
            errors: ["Timeout"],
          },
          {
            id: "run-striive",
            config_id: "cfg-3",
            platform: "Striive",
            run_at: new Date("2026-03-08T07:00:00.000Z"),
            duration_ms: 900,
            jobs_found: 12,
            jobs_new: 2,
            duplicates: 10,
            status: "success",
            errors: [],
          },
        ]),
      )
      .mockReturnValueOnce(createAwaitableQuery([{ stage: "new", count: 4 }]))
      .mockReturnValueOnce(createAwaitableQuery([{ count: 2 }]))
      .mockReturnValueOnce(createAwaitableQuery([{ id: "interview-1", candidateName: "Jane" }]));

    const result = await getOverviewData({ select } as unknown as typeof db);

    expect(result.recentScrapes).toEqual([
      {
        id: "run-flextender-latest",
        configId: "cfg-1",
        platform: "flextender",
        runAt: new Date("2026-03-08T09:00:00.000Z"),
        durationMs: 1200,
        jobsFound: 10,
        jobsNew: 4,
        duplicates: 6,
        status: "success",
        errors: [],
      },
      {
        id: "run-striive",
        configId: "cfg-3",
        platform: "striive",
        runAt: new Date("2026-03-08T07:00:00.000Z"),
        durationMs: 900,
        jobsFound: 12,
        jobsNew: 2,
        duplicates: 10,
        status: "success",
        errors: [],
      },
    ]);
  });
});
