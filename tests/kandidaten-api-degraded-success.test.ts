import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCountCandidates,
  mockGetCandidateById,
  mockListCandidates,
  mockRevalidatePath,
  mockSearchCandidates,
  mockWithCandidateCanonicalSkills,
  mockWithCandidatesCanonicalSkills,
} = vi.hoisted(() => ({
  mockCountCandidates: vi.fn(),
  mockGetCandidateById: vi.fn(),
  mockListCandidates: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockSearchCandidates: vi.fn(),
  mockWithCandidateCanonicalSkills: vi.fn(),
  mockWithCandidatesCanonicalSkills: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));

vi.mock(
  "@/src/lib/api-handler",
  () => ({
    withApiHandler: (handler: unknown) => handler,
  }),
  { virtual: true },
);

vi.mock(
  "@/src/lib/pagination",
  () => ({
    parsePagination: (params: URLSearchParams) => {
      const page = Number(params.get("page") ?? params.get("pagina") ?? "1");
      const limit = Number(params.get("limit") ?? params.get("perPage") ?? "50");
      return { page, limit, offset: (page - 1) * limit };
    },
    paginatedResponse: (data: unknown[], total: number, params: { page: number; limit: number }) => ({
      data,
      total,
      page: params.page,
      perPage: params.limit,
      totalPages: Math.ceil(total / params.limit),
    }),
  }),
  { virtual: true },
);

vi.mock("@/src/services/candidates", () => ({
  countCandidates: mockCountCandidates,
  createCandidate: vi.fn(),
  deleteCandidate: vi.fn(),
  getCandidateById: mockGetCandidateById,
  listCandidates: mockListCandidates,
  searchCandidates: mockSearchCandidates,
  updateCandidate: vi.fn(),
}));

vi.mock("@/src/services/esco", () => ({
  withCandidateCanonicalSkills: mockWithCandidateCanonicalSkills,
  withCandidatesCanonicalSkills: mockWithCandidatesCanonicalSkills,
}));

import { GET as candidateDetailGet } from "../app/api/kandidaten/[id]/route";
import { GET as candidatesGet } from "../app/api/kandidaten/route";

describe("Kandidaten API degraded success", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns /api/kandidaten list data when the service degrades without profileSummary", async () => {
    const degradedCandidates = [
      {
        id: "cand-1",
        name: "Jane Doe",
        headline: "Senior recruiter",
        profileSummary: null,
      },
    ];

    mockListCandidates.mockResolvedValue(degradedCandidates);
    mockCountCandidates.mockResolvedValue(1);
    mockWithCandidatesCanonicalSkills.mockImplementation(async (candidates: unknown[]) =>
      candidates.map((candidate) => ({ ...candidate, canonicalSkills: [] })),
    );

    const response = await candidatesGet(new Request("http://test.local/api/kandidaten"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockListCandidates).toHaveBeenCalledOnce();
    expect(mockSearchCandidates).not.toHaveBeenCalled();
    expect(json.data).toHaveLength(1);
    expect(json.data[0]).toMatchObject({
      id: "cand-1",
      headline: "Senior recruiter",
      profileSummary: null,
      canonicalSkills: [],
    });
    expect(json.total).toBe(1);
  });

  it("returns /api/kandidaten search results when degraded candidates are returned from search", async () => {
    const degradedCandidates = [{ id: "cand-2", name: "John Doe", profileSummary: null }];

    mockSearchCandidates.mockResolvedValue(degradedCandidates);
    mockCountCandidates.mockResolvedValue(1);
    mockWithCandidatesCanonicalSkills.mockResolvedValue(degradedCandidates);

    const response = await candidatesGet(
      new Request("http://test.local/api/kandidaten?q=java&locatie=Utrecht"),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockSearchCandidates).toHaveBeenCalledOnce();
    expect(mockListCandidates).not.toHaveBeenCalled();
    expect(json.data[0]).toMatchObject({ id: "cand-2", profileSummary: null });
  });

  it("returns /api/kandidaten/[id] detail data when the service degrades without profileSummary", async () => {
    const degradedCandidate = {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Jane Doe",
      headline: "Platform engineer",
      profileSummary: null,
    };

    mockGetCandidateById.mockResolvedValue(degradedCandidate);
    mockWithCandidateCanonicalSkills.mockImplementation(async (candidate: unknown) => ({
      ...((candidate ?? {}) as Record<string, unknown>),
      canonicalSkills: [],
    }));

    const response = await candidateDetailGet(new Request("http://test.local/api/kandidaten/id"), {
      params: Promise.resolve({ id: degradedCandidate.id }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockGetCandidateById).toHaveBeenCalledWith(degradedCandidate.id);
    expect(json.data).toMatchObject({
      id: degradedCandidate.id,
      headline: "Platform engineer",
      profileSummary: null,
      canonicalSkills: [],
    });
  });
});