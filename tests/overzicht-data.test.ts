import { describe, expect, it, vi } from "vitest";
import { getOverviewData } from "../app/overzicht/data";
import type { db } from "../src/db";

function createAwaitableQuery<T>(result: T) {
  const promise = Promise.resolve(result);
  const chain = Object.assign(promise, {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    groupBy: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
  });

  return chain;
}

describe("getOverviewData", () => {
  it("executes dashboard reads through one transaction-backed connection", async () => {
    const select = vi
      .fn()
      .mockReturnValueOnce(createAwaitableQuery([{ platform: "linkedin", count: 3, weeklyNew: 1 }]))
      .mockReturnValueOnce(createAwaitableQuery([{ id: "job-1", title: "Engineer" }]))
      .mockReturnValueOnce(createAwaitableQuery([{ id: "cfg-1", platform: "linkedin" }]))
      .mockReturnValueOnce(createAwaitableQuery([{ id: "run-1", platform: "linkedin" }]))
      .mockReturnValueOnce(createAwaitableQuery([{ company: "Motian", count: 2 }]))
      .mockReturnValueOnce(createAwaitableQuery([{ province: "Utrecht", count: 2 }]))
      .mockReturnValueOnce(createAwaitableQuery([{ stage: "new", count: 4 }]))
      .mockReturnValueOnce(createAwaitableQuery([{ count: 2 }]))
      .mockReturnValueOnce(createAwaitableQuery([{ id: "interview-1", candidateName: "Jane" }]));

    const transaction = vi.fn(async (callback: (tx: { select: typeof select }) => unknown) =>
      callback({ select }),
    );

    const result = await getOverviewData({ transaction } as unknown as typeof db);

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(select).toHaveBeenCalledTimes(9);
    expect(result.platformCounts).toEqual([{ platform: "linkedin", count: 3, weeklyNew: 1 }]);
    expect(result.pipelineStageCounts).toEqual([{ stage: "new", count: 4 }]);
    expect(result.upcomingInterviewCountResult).toEqual([{ count: 2 }]);
  });
});
