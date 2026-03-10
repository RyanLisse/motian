import { afterEach, describe, expect, it, vi } from "vitest";

const { mockRunsList } = vi.hoisted(() => ({
  mockRunsList: vi.fn(),
}));

vi.mock("@trigger.dev/sdk", () => ({
  runs: {
    list: mockRunsList,
  },
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
    expect(singlePlatformDb.database.transaction).toHaveBeenCalledTimes(1);
    expect(multiPlatformDb.database.transaction).toHaveBeenCalledTimes(1);
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
});
