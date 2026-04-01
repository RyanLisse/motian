import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockEnsureTypesenseCollection,
  mockGetTypesenseConfig,
  mockIsTypesenseEnabled,
  mockTypesenseRequest,
} = vi.hoisted(() => ({
  mockEnsureTypesenseCollection: vi.fn(),
  mockGetTypesenseConfig: vi.fn(),
  mockIsTypesenseEnabled: vi.fn(),
  mockTypesenseRequest: vi.fn(),
}));

vi.mock("../src/lib/typesense", () => ({
  getTypesenseConfig: mockGetTypesenseConfig,
  isTypesenseEnabled: mockIsTypesenseEnabled,
}));

vi.mock("../src/services/search-index/typesense-client", () => ({
  ensureTypesenseCollection: mockEnsureTypesenseCollection,
  typesenseRequest: mockTypesenseRequest,
}));

import {
  canUseTypesenseForCandidates,
  canUseTypesenseForJobs,
  searchCandidateIdsByTypesense,
  searchJobIdsByTypesense,
} from "../src/services/search-index/typesense-search";

describe("typesense search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsTypesenseEnabled.mockReturnValue(true);
    mockGetTypesenseConfig.mockReturnValue({
      url: "https://typesense.example.com",
      apiKey: "secret-key",
      collections: {
        jobs: "motian_jobs_preview",
        candidates: "motian_candidates_preview",
      },
    });
  });

  it("rejects unsupported vacature filters for typesense", () => {
    expect(canUseTypesenseForJobs({ region: "randstad" })).toBe(false);
    expect(canUseTypesenseForJobs({ regions: ["randstad"] })).toBe(false);
    expect(canUseTypesenseForJobs({ escoUri: "esco:java" })).toBe(false);
    expect(canUseTypesenseForJobs({ radiusKm: 25 })).toBe(false);
    expect(canUseTypesenseForJobs({ platform: "opdrachtoverheid" })).toBe(true);
  });

  it("rejects kandidaat typesense search when only esco filtering is requested", () => {
    expect(canUseTypesenseForCandidates({ escoUri: "esco:java" })).toBe(false);
    expect(canUseTypesenseForCandidates({ query: "recruiter" })).toBe(true);
  });

  it("builds vacature search params and returns ids plus total", async () => {
    mockTypesenseRequest.mockResolvedValue({
      found: 2,
      hits: [{ document: { id: "job-1" } }, { document: { id: "job-2" } }],
    });

    const result = await searchJobIdsByTypesense("java developer", {
      platform: "opdrachtoverheid",
      categories: ["ICT"],
      rateMin: 90,
      rateMax: 120,
      hoursPerWeekBucket: "32_40",
      sortBy: "deadline",
      limit: 20,
      offset: 0,
    });

    expect(result).toEqual({ ids: ["job-1", "job-2"], total: 2 });
    expect(mockEnsureTypesenseCollection).toHaveBeenCalledWith("jobs");
    expect(mockTypesenseRequest).toHaveBeenCalledWith(
      "/collections/motian_jobs_preview/documents/search",
      expect.objectContaining({
        searchParams: expect.any(URLSearchParams),
      }),
    );

    const params = mockTypesenseRequest.mock.calls[0]?.[1]?.searchParams as URLSearchParams;
    expect(params.get("q")).toBe("java developer");
    // When OPENAI_API_KEY is available, hybrid search adds the embedding field
    const queryBy = params.get("query_by")!;
    expect(queryBy).toContain("title,searchText,company,endClient,province,categories");
    expect(params.get("sort_by")).toBe("applicationDeadlineTs:asc");
    expect(params.get("filter_by")).toContain("platform:=`opdrachtoverheid`");
    expect(params.get("filter_by")).toContain("categories:=[`ICT`]");
    expect(params.get("filter_by")).toContain("rateMax:>=90");
    expect(params.get("filter_by")).toContain("rateMin:<=120");
  });

  it("builds kandidaat search params and returns ids plus total", async () => {
    mockTypesenseRequest.mockResolvedValue({
      found: 1,
      hits: [{ document: { id: "candidate-1" } }],
    });

    const result = await searchCandidateIdsByTypesense({
      query: "recruiter",
      role: "Recruiter",
      location: "Amsterdam",
      skills: "sourcing",
      limit: 10,
      offset: 0,
    });

    expect(result).toEqual({ ids: ["candidate-1"], total: 1 });
    expect(mockEnsureTypesenseCollection).toHaveBeenCalledWith("candidates");

    const params = mockTypesenseRequest.mock.calls[0]?.[1]?.searchParams as URLSearchParams;
    expect(params.get("q")).toBe("recruiter Recruiter Amsterdam sourcing");
    expect(params.get("query_by")).toBe("name,role,location,skills,searchText");
    expect(params.get("sort_by")).toBe("createdAtTs:desc");
    expect(params.get("filter_by")).toContain("location:=`Amsterdam`");
    expect(params.get("filter_by")).toContain("role:=`Recruiter`");
    expect(params.get("filter_by")).toContain("skills:=[`sourcing`]");
  });
});
