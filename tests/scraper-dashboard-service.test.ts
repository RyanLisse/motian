import { afterEach, describe, expect, it, vi } from "vitest";

const { mockRunsList } = vi.hoisted(() => ({
  mockRunsList: vi.fn(),
}));

vi.mock("@trigger.dev/sdk", () => ({
  runs: {
    list: mockRunsList,
  },
}));

vi.mock("../src/services/jobs/deduplication", () => ({
  fetchDedupedJobsPage: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  loadJobsByIds: vi.fn(),
  collapseScoredJobsByVacancy: vi.fn((entries: unknown[]) => entries),
  fetchDedupedJobIds: vi.fn(),
}));

import { getScraperDashboardData } from "../src/services/scraper-dashboard";

type QueryChain = Promise<unknown[]> & {
  from: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  groupBy: ReturnType<typeof vi.fn>;
};

function createQueryChain(result: unknown[]) {
  const promise = Promise.resolve(result) as QueryChain;
  const chain = Object.assign(promise, {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    groupBy: vi.fn(() => chain),
  });

  return chain;
}

function emptyAsyncIterable() {
  return {
    [Symbol.asyncIterator]() {
      return {
        next: async () => ({ done: true as const, value: undefined }),
      };
    },
  };
}

function throwingAsyncIterable(message: string) {
  return {
    [Symbol.asyncIterator]() {
      return {
        next: async () => {
          throw new Error(message);
        },
      };
    },
  };
}

function createMockDatabase(queryResults: unknown[][]) {
  const pending = [...queryResults];
  const select = vi.fn(() => {
    const next = pending.shift();
    if (!next) {
      throw new Error("Unexpected extra select() while building scraper dashboard data");
    }
    return createQueryChain(next);
  });

  const tx = { select };
  const database = {
    select,
    transaction: vi.fn(async (callback: (input: typeof tx) => Promise<unknown>) => callback(tx)),
  };

  return { database, select, pending };
}

function createSerialMockDatabase(queryResults: unknown[][]) {
  const pending = [...queryResults];
  let activeSelects = 0;

  const select = vi.fn(() => {
    if (activeSelects > 0) {
      throw new Error("Concurrent select() is not allowed for scraper dashboard reads");
    }

    const next = pending.shift();
    if (!next) {
      throw new Error("Unexpected extra select() while building scraper dashboard data");
    }

    activeSelects += 1;

    const promise = Promise.resolve()
      .then(() => next)
      .finally(() => {
        activeSelects -= 1;
      }) as QueryChain;

    const chain = Object.assign(promise, {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      groupBy: vi.fn(() => chain),
    });

    return chain;
  });

  const tx = { select };
  const database = {
    select,
    transaction: vi.fn(async (callback: (input: typeof tx) => Promise<unknown>) => callback(tx)),
  };

  return { database, select, pending };
}

function buildQueryResults(platforms: string[]) {
  const now = new Date("2026-03-10T09:00:00Z");

  return [
    platforms.map((platform, index) => ({
      platform,
      totalRuns: index + 1,
      successCount: index + 1,
      partialCount: 0,
      failedCount: 0,
      totalJobsFound: 10,
      totalJobsNew: 4,
      totalDuplicates: 6,
      avgDurationMs: 500,
    })),
    [{ count: 12 }],
    [{ avgMs: 500 }],
    platforms.map((platform) => ({
      id: `cfg-${platform}`,
      platform,
      isActive: true,
      baseUrl: `https://${platform}.example.com`,
      cronExpression: "0 */4 * * *",
      lastRunAt: now,
      lastRunStatus: "success",
      consecutiveFailures: 0,
    })),
    platforms.map((platform, index) => ({
      id: `run-${platform}`,
      configId: `cfg-${platform}`,
      platform,
      runAt: new Date(now.getTime() - index * 60_000),
      durationMs: 500,
      jobsFound: 10,
      jobsNew: 4,
      duplicates: 6,
      status: "success",
      errors: [],
    })),
    platforms.map((platform) => ({
      platform,
      runs: 1,
      successCount: 1,
      partialCount: 0,
      failedCount: 0,
      avgDurationMs: 500,
    })),
    [],
  ];
}

describe("getScraperDashboardData", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads scraper data with a platform-count-independent batched query pattern", async () => {
    mockRunsList.mockImplementation(() => emptyAsyncIterable());
    const singlePlatformDb = createMockDatabase(buildQueryResults(["flextender"]));
    const multiPlatformDb = createMockDatabase(
      buildQueryResults(["flextender", "opdrachtoverheid", "striive"]),
    );

    const singlePlatformResult = await getScraperDashboardData(
      { includeTrigger: false, activityLimit: 5, overlapLimit: 3 },
      singlePlatformDb.database as never,
    );
    const multiPlatformResult = await getScraperDashboardData(
      { includeTrigger: false, activityLimit: 5, overlapLimit: 3 },
      multiPlatformDb.database as never,
    );

    expect(singlePlatformResult.platforms.map((platform) => platform.platform)).toEqual([
      "flextender",
    ]);
    expect(multiPlatformResult.platforms.map((platform) => platform.platform)).toEqual([
      "flextender",
      "opdrachtoverheid",
      "striive",
    ]);
    expect(singlePlatformDb.database.transaction).not.toHaveBeenCalled();
    expect(multiPlatformDb.database.transaction).not.toHaveBeenCalled();
    expect(singlePlatformDb.select).toHaveBeenCalled();
    expect(multiPlatformDb.select).toHaveBeenCalled();
    expect(multiPlatformDb.select.mock.calls.length).toBe(
      singlePlatformDb.select.mock.calls.length,
    );
    expect(singlePlatformDb.pending).toHaveLength(0);
    expect(multiPlatformDb.pending).toHaveLength(0);
  });

  it("degrades gracefully when Trigger.dev visibility times out", async () => {
    mockRunsList.mockImplementation(() =>
      throwingAsyncIterable("connect timeout while listing Trigger.dev runs"),
    );
    const mockDb = createMockDatabase(buildQueryResults(["flextender"]));

    const result = await getScraperDashboardData(
      { includeTrigger: true, activityLimit: 5, overlapLimit: 3 },
      mockDb.database as never,
    );

    expect(result.platforms).toHaveLength(1);
    expect(result.trigger.available).toBe(false);
    expect(result.trigger.reason).toContain("connect timeout");
    expect(result.trigger.tasks.map((task) => task.taskIdentifier)).toEqual([
      "scrape-pipeline",
      "scraper-health-check",
    ]);
  });

  it("serializes scraper dashboard reads to avoid request-context and connection failures", async () => {
    mockRunsList.mockImplementation(() => emptyAsyncIterable());
    const mockDb = createSerialMockDatabase(
      buildQueryResults(["flextender", "opdrachtoverheid", "striive"]),
    );

    const result = await getScraperDashboardData(
      { includeTrigger: false, activityLimit: 5, overlapLimit: 3 },
      mockDb.database as never,
    );

    expect(result.platforms.map((platform) => platform.platform)).toEqual([
      "flextender",
      "opdrachtoverheid",
      "striive",
    ]);
    expect(mockDb.pending).toHaveLength(0);
  });

  it("does not surface stale platform errors after a newer successful run", async () => {
    mockRunsList.mockImplementation(() => emptyAsyncIterable());
    const now = new Date();
    const mockDb = createMockDatabase([
      [
        {
          platform: "striive",
          totalRuns: 2,
          successCount: 1,
          partialCount: 0,
          failedCount: 1,
          totalJobsFound: 20,
          totalJobsNew: 10,
          totalDuplicates: 10,
          avgDurationMs: 500,
        },
      ],
      [{ count: 12 }],
      [{ avgMs: 500 }],
      [
        {
          id: "cfg-striive",
          platform: "striive",
          isActive: true,
          baseUrl: "https://striive.example.com",
          cronExpression: "0 */4 * * *",
          lastRunAt: now,
          lastRunStatus: "success",
          consecutiveFailures: 0,
        },
      ],
      [
        {
          id: "run-success",
          configId: "cfg-striive",
          platform: "striive",
          runAt: now,
          durationMs: 500,
          jobsFound: 10,
          jobsNew: 4,
          duplicates: 6,
          status: "success",
          errors: [],
        },
        {
          id: "run-failed",
          configId: "cfg-striive",
          platform: "striive",
          runAt: new Date(now.getTime() - 60_000),
          durationMs: 500,
          jobsFound: 0,
          jobsNew: 0,
          duplicates: 0,
          status: "failed",
          errors: ["Timeout bij import"],
        },
      ],
      [
        {
          platform: "striive",
          runs: 1,
          successCount: 1,
          partialCount: 0,
          failedCount: 0,
          avgDurationMs: 500,
        },
      ],
      [],
    ]);

    const result = await getScraperDashboardData(
      { includeTrigger: false, activityLimit: 5, overlapLimit: 3 },
      mockDb.database as never,
    );

    expect(result.platforms).toHaveLength(1);
    expect(result.platforms[0]?.latestError).toBeNull();
    expect(result.platforms[0]?.status).toBe("gezond");
    expect(result.platforms[0]?.signals.map((signal) => signal.code)).not.toContain("latest_error");
  });

  it("ignores older failed runs when config metadata points to a newer successful run outside the recent window", async () => {
    mockRunsList.mockImplementation(() => emptyAsyncIterable());
    const lastRunAt = new Date("2026-03-24T10:17:00.000Z");
    const olderFailure = new Date("2026-03-24T03:17:00.000Z");
    const mockDb = createMockDatabase([
      [
        {
          platform: "striive",
          totalRuns: 12,
          successCount: 11,
          partialCount: 0,
          failedCount: 1,
          totalJobsFound: 120,
          totalJobsNew: 40,
          totalDuplicates: 80,
          avgDurationMs: 500,
        },
      ],
      [{ count: 12 }],
      [{ avgMs: 500 }],
      [
        {
          id: "cfg-striive",
          platform: "striive",
          isActive: true,
          baseUrl: "https://striive.example.com",
          cronExpression: "0 */4 * * *",
          lastRunAt,
          lastRunStatus: "success",
          consecutiveFailures: 0,
        },
      ],
      [
        {
          id: "run-failed",
          configId: "cfg-striive",
          platform: "striive",
          runAt: olderFailure,
          durationMs: 500,
          jobsFound: 0,
          jobsNew: 0,
          duplicates: 0,
          status: "failed",
          errors: ["Oude DB-fout"],
        },
      ],
      [
        {
          platform: "striive",
          runs: 1,
          successCount: 1,
          partialCount: 0,
          failedCount: 0,
          avgDurationMs: 500,
        },
      ],
      [],
    ]);

    const result = await getScraperDashboardData(
      { includeTrigger: false, activityLimit: 5, overlapLimit: 3 },
      mockDb.database as never,
    );

    expect(result.platforms).toHaveLength(1);
    expect(result.platforms[0]?.lastRunStatus).toBe("success");
    expect(result.platforms[0]?.latestError).toBeNull();
    expect(result.platforms[0]?.signals.map((signal) => signal.code)).not.toContain("latest_error");
  });
});
