import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockListJobsImpl, mockHybridSearchImpl } = vi.hoisted(() => ({
  mockListJobsImpl: vi.fn(),
  mockHybridSearchImpl: vi.fn(),
}));

vi.mock("../src/services/jobs/list", () => ({
  listActiveJobs: vi.fn(),
  listJobs: mockListJobsImpl,
}));

vi.mock("../src/services/jobs/search", () => ({
  hybridSearch: mockHybridSearchImpl,
  searchJobs: vi.fn(),
  searchJobsByTitle: vi.fn(),
}));

import { hybridSearch, listJobs } from "../src/services/jobs";

describe("search/ranking API shape regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListJobsImpl.mockResolvedValue({
      data: [{ id: "job-1", title: "Ranked listing", platform: "opdrachtoverheid" }],
      total: 1,
    });
    mockHybridSearchImpl.mockResolvedValue([
      { id: "job-2", title: "Hybrid ranked", platform: "opdrachtoverheid", score: 0.61 },
    ]);
  });

  it("listJobs returns { data: Job[], total: number }", async () => {
    const result = await listJobs({ limit: 2, offset: 0 });
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.data)).toBe(true);
    expect(typeof result.total).toBe("number");
    expect(result.data[0]).toMatchObject({
      id: "job-1",
      title: "Ranked listing",
      platform: "opdrachtoverheid",
    });
  });

  it("hybridSearch returns array of Job & { score }", async () => {
    const result = await hybridSearch("test", { limit: 2 });
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toMatchObject({
      id: "job-2",
      title: "Hybrid ranked",
      score: 0.61,
    });
  });
});
