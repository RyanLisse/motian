import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, publishMock } = vi.hoisted(() => {
  const state = {
    configId: "config-1",
    previousFailures: 0,
    // Most-recent-first history returned for the streak query.
    recentHistory: [] as Array<{ jobsFound: number; runAt: Date }>,
    historicalMax: 0,
    capturedUpdates: [] as Array<Record<string, unknown>>,
  };

  const dbMock = {
    _state: state,
    _reset() {
      state.recentHistory = [];
      state.historicalMax = 0;
      state.previousFailures = 0;
      state.capturedUpdates = [];
    },
    select(cols: Record<string, unknown>) {
      const keys = Object.keys(cols ?? {});
      // Distinguish the three select shapes by their selected columns.
      if (keys.includes("consecutiveFailures")) {
        // config row
        return {
          from: () => ({
            where: () => ({
              limit: () =>
                Promise.resolve([
                  { id: state.configId, consecutiveFailures: state.previousFailures },
                ]),
            }),
          }),
        };
      }
      if (keys.includes("jobsFound")) {
        // recent-history query
        return {
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => Promise.resolve(state.recentHistory),
              }),
            }),
          }),
        };
      }
      if (keys.includes("max")) {
        return {
          from: () => ({
            where: () => Promise.resolve([{ max: state.historicalMax }]),
          }),
        };
      }
      throw new Error(`Unhandled select shape: ${keys.join(",")}`);
    },
    insert() {
      return { values: () => Promise.resolve() };
    },
    update() {
      return {
        set: (values: Record<string, unknown>) => ({
          where: () => {
            state.capturedUpdates.push(values);
            return Promise.resolve();
          },
        }),
      };
    },
  };

  const publishMock = vi.fn();
  return { dbMock, publishMock };
});

vi.mock("../src/db", () => ({
  db: dbMock,
  // Re-export the drizzle helpers as identity-ish so the call sites compile.
  and: (...args: unknown[]) => args,
  eq: (a: unknown, b: unknown) => ({ eq: [a, b] }),
  gte: (a: unknown, b: unknown) => ({ gte: [a, b] }),
  desc: (a: unknown) => ({ desc: a }),
  sql: Object.assign((strings: TemplateStringsArray, ..._values: unknown[]) => ({ sql: strings }), {
    raw: (s: string) => ({ raw: s }),
  }),
}));

vi.mock("../src/lib/event-bus", () => ({
  publish: publishMock,
}));

import { recordScrapeResult } from "../src/services/record-scrape-result";

describe("recordScrapeResult silent-failure detection", () => {
  beforeEach(() => {
    dbMock._reset();
    publishMock.mockReset();
  });

  it("fires scrape:silent_failure at the streak transition (3 zero runs after a non-zero run)", async () => {
    const now = Date.now();
    dbMock._state.recentHistory = [
      { jobsFound: 0, runAt: new Date(now - 1_000) },
      { jobsFound: 0, runAt: new Date(now - 2_000) },
      { jobsFound: 0, runAt: new Date(now - 3_000) },
      { jobsFound: 42, runAt: new Date(now - 4_000) }, // streak-breaker
    ];
    dbMock._state.historicalMax = 42;

    await recordScrapeResult({
      platform: "werkzoeken",
      jobsFound: 0,
      jobsNew: 0,
      duplicates: 0,
      durationMs: 1000,
      status: "success",
      errors: [],
    });

    expect(publishMock).toHaveBeenCalledWith(
      "scrape:silent_failure",
      expect.objectContaining({
        platform: "werkzoeken",
        streakLength: 3,
        historicalMax: 42,
      }),
    );
    expect(dbMock._state.capturedUpdates).toContainEqual(
      expect.objectContaining({ validationStatus: "drift_suspected" }),
    );
  });

  it("stays silent when the prior run was also zero (not a transition)", async () => {
    const now = Date.now();
    dbMock._state.recentHistory = [
      { jobsFound: 0, runAt: new Date(now - 1_000) },
      { jobsFound: 0, runAt: new Date(now - 2_000) },
      { jobsFound: 0, runAt: new Date(now - 3_000) },
      { jobsFound: 0, runAt: new Date(now - 4_000) }, // streak would have fired on the earlier run
    ];
    dbMock._state.historicalMax = 42;

    await recordScrapeResult({
      platform: "werkzoeken",
      jobsFound: 0,
      jobsNew: 0,
      duplicates: 0,
      durationMs: 1000,
      status: "success",
      errors: [],
    });

    expect(publishMock).not.toHaveBeenCalledWith("scrape:silent_failure", expect.anything());
  });

  it("stays silent when the platform has no historical evidence of producing jobs", async () => {
    const now = Date.now();
    dbMock._state.recentHistory = [
      { jobsFound: 0, runAt: new Date(now - 1_000) },
      { jobsFound: 0, runAt: new Date(now - 2_000) },
      { jobsFound: 0, runAt: new Date(now - 3_000) },
      { jobsFound: 5, runAt: new Date(now - 4_000) }, // below min threshold
    ];
    dbMock._state.historicalMax = 5;

    await recordScrapeResult({
      platform: "brand-new-platform",
      jobsFound: 0,
      jobsNew: 0,
      duplicates: 0,
      durationMs: 1000,
      status: "success",
      errors: [],
    });

    expect(publishMock).not.toHaveBeenCalledWith("scrape:silent_failure", expect.anything());
  });

  it("does not check silent-failure when jobsFound is non-zero", async () => {
    dbMock._state.recentHistory = [];
    dbMock._state.historicalMax = 0;

    await recordScrapeResult({
      platform: "werkzoeken",
      jobsFound: 50,
      jobsNew: 10,
      duplicates: 40,
      durationMs: 1000,
      status: "success",
      errors: [],
    });

    expect(publishMock).not.toHaveBeenCalledWith("scrape:silent_failure", expect.anything());
  });
});
