import { beforeEach, describe, expect, it, vi } from "vitest";

const limitMock = vi.fn();
const orderByMock = vi.fn(() => ({
  limit: limitMock,
}));
const fromMock = vi.fn(() => ({
  orderBy: orderByMock,
  where: vi.fn(() => ({ orderBy: vi.fn() })),
}));
const selectMock = vi.fn(() => ({
  from: fromMock,
}));

vi.mock("@/src/db", async (importOriginal) => ({
  ...(await importOriginal()),
  db: {
    select: selectMock,
  },
  desc: vi.fn((value) => value),
  eq: vi.fn((left, right) => ({ left, right })),
}));

vi.mock("@/src/db/schema", () => ({
  autopilotRuns: {
    startedAt: "startedAt",
    runId: "runId",
  },
}));

describe("autopilot dashboard fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a degraded empty state instead of throwing when the run query fails", async () => {
    limitMock.mockRejectedValueOnce(new Error("timeout exceeded when trying to connect"));

    const { getAutopilotDashboardData } = await import("@/app/autopilot/data");
    const data = await getAutopilotDashboardData();

    expect(data.runs).toEqual([]);
    expect(data.loadError).toBe("timeout exceeded when trying to connect");
  });
});
