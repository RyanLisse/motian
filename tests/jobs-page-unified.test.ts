import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockListJobsPage, mockHybridSearchPageWithTotal } = vi.hoisted(() => ({
  mockListJobsPage: vi.fn(),
  mockHybridSearchPageWithTotal: vi.fn(),
}));

vi.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: any[]) => any>(fn: T) => fn,
}));

vi.mock("../src/services/jobs/page-query", () => ({
  hybridSearchPageWithTotal: mockHybridSearchPageWithTotal,
  listJobsPage: mockListJobsPage,
}));

vi.mock("../src/services/sidebar-metadata", () => ({
  getSidebarMetadata: vi.fn(),
}));

import { searchJobsPageUnified, type UnifiedJobPageSearchResult } from "../src/services/jobs";
import { getSidebarMetadata } from "../src/services/sidebar-metadata";

describe("searchJobsPageUnified", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSidebarMetadata).mockResolvedValue(null);
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
      endClient: "Gemeente Utrecht",
      sortBy: "deadline_desc",
      limit: 25,
      offset: 25,
      status: "open",
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
      ["architect"],
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

  it("forwards multi-platform filters on both page paths", async () => {
    await searchJobsPageUnified({
      platforms: ["opdrachtoverheid", "nationalevacaturebank"],
      limit: 25,
      offset: 0,
    });

    expect(mockListJobsPage).toHaveBeenCalledWith(
      expect.objectContaining({
        platforms: ["opdrachtoverheid", "nationalevacaturebank"],
        limit: 25,
        offset: 0,
      }),
    );

    await searchJobsPageUnified({
      q: "architect",
      platforms: ["opdrachtoverheid", "nationalevacaturebank"],
      limit: 5,
      offset: 10,
    });

    expect(mockHybridSearchPageWithTotal).toHaveBeenCalledWith(
      ["architect"],
      expect.objectContaining({
        platforms: ["opdrachtoverheid", "nationalevacaturebank"],
        limit: 5,
        offset: 10,
      }),
    );
  });

  it("reuses precomputed sidebar totals for the default open page listing", async () => {
    vi.mocked(getSidebarMetadata).mockResolvedValue({
      totalCount: 41140,
      platforms: [],
      endClients: [],
      categories: [],
      skillOptions: [],
      skillEmptyText: "Geen skills gevonden.",
      computedAt: new Date(),
    });

    await searchJobsPageUnified({
      limit: 20,
      offset: 0,
      sortBy: "nieuwste",
    });

    expect(mockListJobsPage).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 20,
        offset: 0,
        sortBy: "nieuwste",
        knownTotal: 41140,
      }),
    );
  });

  it("routes the default open page listing through the cached default-open page path", async () => {
    await searchJobsPageUnified({
      limit: 20,
      offset: 0,
      sortBy: "nieuwste",
    });

    expect(mockListJobsPage).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 20,
        offset: 0,
        sortBy: "nieuwste",
        status: "open",
      }),
    );
  });
});
