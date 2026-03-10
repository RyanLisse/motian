import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockListJobs, mockHybridSearch, mockHybridSearchWithTotal } = vi.hoisted(() => ({
  mockListJobs: vi.fn(),
  mockHybridSearch: vi.fn(),
  mockHybridSearchWithTotal: vi.fn(),
}));

vi.mock("../src/services/jobs/list", () => ({
  listActiveJobs: vi.fn(),
  listJobs: mockListJobs,
}));

vi.mock("../src/services/jobs/search", () => ({
  hybridSearch: mockHybridSearch,
  hybridSearchWithTotal: mockHybridSearchWithTotal,
  searchJobs: vi.fn(),
  searchJobsByTitle: vi.fn(),
}));

import { searchJobsUnified, type UnifiedJobSearchResult } from "../src/services/jobs";

describe("searchJobsUnified", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListJobs.mockResolvedValue({
      data: [{ id: "job-1", title: "Test job", platform: "opdrachtoverheid" }],
      total: 1,
    });
    mockHybridSearch.mockResolvedValue([
      { id: "job-2", title: "Hybrid job", platform: "opdrachtoverheid", score: 0.88 },
    ]);
    mockHybridSearchWithTotal.mockResolvedValue({
      data: [{ id: "job-2", title: "Hybrid job", platform: "opdrachtoverheid", score: 0.88 }],
      total: 7,
    });
  });

  it("returns { data, total } with data array and number total", async () => {
    const result = await searchJobsUnified({ limit: 2, offset: 0 });
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("total");
    expect(result).not.toHaveProperty("telemetry");
    expect(Array.isArray(result.data)).toBe(true);
    expect(typeof result.total).toBe("number");
  });

  it("no q: filtered listing shape (no score on items)", async () => {
    const result = await searchJobsUnified({ limit: 2 });
    const first = result.data[0] as UnifiedJobSearchResult["data"][number] | undefined;
    expect(mockListJobs).toHaveBeenCalledWith({
      limit: 2,
      offset: undefined,
      platform: undefined,
      company: undefined,
      endClient: undefined,
      category: undefined,
      status: undefined,
      province: undefined,
      region: undefined,
      rateMin: undefined,
      rateMax: undefined,
      contractType: undefined,
      workArrangement: undefined,
      hoursPerWeekBucket: undefined,
      radiusKm: undefined,
      postedAfter: undefined,
      deadlineBefore: undefined,
      startDateAfter: undefined,
      sortBy: undefined,
    });
    expect(first).toMatchObject({
      id: "job-1",
      title: "Test job",
      platform: "opdrachtoverheid",
    });
    expect(result).not.toHaveProperty("telemetry");
    expect(first).not.toHaveProperty("score");
  });

  it("forwards endClient on the non-search listing path", async () => {
    await searchJobsUnified({ endClient: "Gemeente Utrecht", limit: 5 });
    expect(mockListJobs).toHaveBeenCalledWith(
      expect.objectContaining({
        endClient: "Gemeente Utrecht",
        limit: 5,
      }),
    );
  });

  it("with q: hybrid search shape (items have score)", async () => {
    const result = await searchJobsUnified({ q: "test", limit: 2 });
    expect(mockHybridSearchWithTotal).toHaveBeenCalledWith(
      "test",
      expect.objectContaining({
        limit: 2,
        offset: undefined,
        platform: undefined,
        company: undefined,
        endClient: undefined,
        category: undefined,
        categories: undefined,
        status: undefined,
        province: undefined,
        region: undefined,
        regions: undefined,
        rateMin: undefined,
        rateMax: undefined,
        contractType: undefined,
        workArrangement: undefined,
        hoursPerWeekBucket: undefined,
        minHoursPerWeek: undefined,
        maxHoursPerWeek: undefined,
        radiusKm: undefined,
        postedAfter: undefined,
        deadlineBefore: undefined,
        startDateAfter: undefined,
        sortBy: undefined,
      }),
    );
    expect(result.data[0]).toMatchObject({
      id: "job-2",
      title: "Hybrid job",
      score: 0.88,
    });
    expect(result.total).toBe(7);
    expect(result).not.toHaveProperty("telemetry");
  });

  it("accepts sortBy and returns deterministic ordering", async () => {
    await searchJobsUnified({ limit: 3, sortBy: "nieuwste" });
    expect(mockListJobs).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 3,
        sortBy: "nieuwste",
      }),
    );
  });

  it("accepts platform filter", async () => {
    const result = await searchJobsUnified({
      platform: "opdrachtoverheid",
      limit: 5,
    });
    expect(mockListJobs).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: "opdrachtoverheid",
        limit: 5,
      }),
    );
    for (const job of result.data) {
      expect((job as { platform?: string }).platform).toBe("opdrachtoverheid");
    }
  });

  it("forwards enhanced recruiter filters on both list and hybrid paths", async () => {
    await searchJobsUnified({
      endClient: "Gemeente Utrecht",
      category: "ICT",
      status: "closed",
      province: "Utrecht",
      region: "randstad",
      hoursPerWeekBucket: "24_32",
      radiusKm: 25,
      sortBy: "deadline",
      limit: 5,
    });

    expect(mockListJobs).toHaveBeenCalledWith(
      expect.objectContaining({
        endClient: "Gemeente Utrecht",
        category: "ICT",
        status: "closed",
        province: "Utrecht",
        region: "randstad",
        hoursPerWeekBucket: "24_32",
        radiusKm: 25,
        sortBy: "deadline",
        limit: 5,
      }),
    );

    await searchJobsUnified({
      q: "manager",
      endClient: "Gemeente Utrecht",
      category: "ICT",
      status: "closed",
      province: "Utrecht",
      region: "randstad",
      hoursPerWeekBucket: "24_32",
      radiusKm: 25,
      sortBy: "deadline",
      limit: 5,
    });

    expect(mockHybridSearchWithTotal).toHaveBeenCalledWith(
      "manager",
      expect.objectContaining({
        endClient: "Gemeente Utrecht",
        category: "ICT",
        status: "closed",
        province: "Utrecht",
        region: "randstad",
        hoursPerWeekBucket: "24_32",
        radiusKm: 25,
        sortBy: "deadline",
        limit: 5,
      }),
    );
  });

  it("forwards company and offset to hybrid search and preserves the full total", async () => {
    const result = await searchJobsUnified({
      q: "manager",
      company: "Motian",
      endClient: "Gemeente Utrecht",
      limit: 5,
      offset: 10,
    });

    expect(mockHybridSearchWithTotal).toHaveBeenCalledWith(
      "manager",
      expect.objectContaining({
        company: "Motian",
        endClient: "Gemeente Utrecht",
        limit: 5,
        offset: 10,
      }),
    );
    expect(result.total).toBe(7);
  });

  it("preserves the public total-and-offset contract for short queries", async () => {
    const result = await searchJobsUnified({ q: "in", limit: 2, offset: 4 });

    expect(mockHybridSearchWithTotal).toHaveBeenCalledWith(
      "in",
      expect.objectContaining({ limit: 2, offset: 4 }),
    );
    expect(result).toMatchObject({ total: 7 });
    expect(Array.isArray(result.data)).toBe(true);
  });
});
