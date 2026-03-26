import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockListJobsPage, mockHybridSearchPageWithTotal } = vi.hoisted(() => ({
  mockListJobsPage: vi.fn(),
  mockHybridSearchPageWithTotal: vi.fn(),
}));

vi.mock("../src/services/jobs/page-query", () => ({
  hybridSearchPageWithTotal: mockHybridSearchPageWithTotal,
  listJobsPage: mockListJobsPage,
}));

import { searchJobsPageUnified, type UnifiedJobPageSearchResult } from "../src/services/jobs";

describe("searchJobsPageUnified", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListJobsPage.mockResolvedValue({
      data: [
        {
          id: "job-1",
          title: "Manager Inhuur",
          company: "Gemeente Utrecht",
          location: "Utrecht",
          platform: "opdrachtoverheid",
          workArrangement: "hybride",
          contractType: "interim",
          applicationDeadline: null,
          hasPipeline: true,
          pipelineCount: 3,
        },
      ],
      total: 11,
    } satisfies UnifiedJobPageSearchResult);
    mockHybridSearchPageWithTotal.mockResolvedValue({
      data: [
        {
          id: "job-2",
          title: "Data Architect",
          company: "Motian",
          location: "Amsterdam",
          platform: "opdrachtoverheid",
          workArrangement: "remote",
          contractType: "interim",
          applicationDeadline: null,
          hasPipeline: false,
          pipelineCount: 0,
        },
      ],
      total: 7,
    } satisfies UnifiedJobPageSearchResult);
  });

  it("uses the list page path when no query is present and preserves totals with pipeline data", async () => {
    const result = await searchJobsPageUnified({
      endClient: "Gemeente Utrecht",
      sortBy: "deadline_desc",
      limit: 25,
      offset: 25,
    });

    expect(mockListJobsPage).toHaveBeenCalledWith({
      platform: undefined,
      company: undefined,
      endClient: "Gemeente Utrecht",
      escoUri: undefined,
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
      sortBy: "deadline_desc",
      limit: 25,
      offset: 25,
    });
    expect(result).toEqual({
      data: [
        expect.objectContaining({
          id: "job-1",
          hasPipeline: true,
          pipelineCount: 3,
        }),
      ],
      total: 11,
    });
    expect(mockHybridSearchPageWithTotal).not.toHaveBeenCalled();
  });

  it("uses the hybrid page path when a query is present and keeps offset and sort stable", async () => {
    const result = await searchJobsPageUnified({
      q: "architect",
      company: "Motian",
      endClient: "Gemeente Utrecht",
      sortBy: "nieuwste",
      limit: 5,
      offset: 10,
    });

    expect(mockHybridSearchPageWithTotal).toHaveBeenCalledWith(
      "architect",
      expect.objectContaining({
        company: "Motian",
        endClient: "Gemeente Utrecht",
        sortBy: "nieuwste",
        limit: 5,
        offset: 10,
      }),
    );
    expect(result).toEqual({
      data: [
        expect.objectContaining({
          id: "job-2",
          hasPipeline: false,
          pipelineCount: 0,
        }),
      ],
      total: 7,
    });
    expect(mockListJobsPage).not.toHaveBeenCalled();
  });
});
