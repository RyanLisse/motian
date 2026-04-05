import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockEmbedCandidate,
  mockCreateMatch,
  mockFindSimilarCandidatesByEmbedding,
  mockGetCandidateById,
  mockGetCandidatesByIds,
  mockGetMatchByJobAndCandidate,
  mockGetJobById,
  mockListActiveCandidates,
  mockListActiveJobs,
} = vi.hoisted(() => ({
  mockEmbedCandidate: vi.fn(),
  mockCreateMatch: vi.fn(),
  mockFindSimilarCandidatesByEmbedding: vi.fn(),
  mockGetCandidateById: vi.fn(),
  mockGetCandidatesByIds: vi.fn(),
  mockGetMatchByJobAndCandidate: vi.fn(),
  mockGetJobById: vi.fn(),
  mockListActiveCandidates: vi.fn(),
  mockListActiveJobs: vi.fn(),
}));

vi.mock("../src/lib/notify-slack", () => ({ notifySlack: vi.fn() }));
vi.mock("../src/services/candidates", () => ({
  getCandidateById: mockGetCandidateById,
  getCandidatesByIds: mockGetCandidatesByIds,
  listActiveCandidates: mockListActiveCandidates,
}));
vi.mock("../src/services/embedding", () => ({
  buildJobEmbeddingText: vi.fn(() => "job embedding text"),
  embedCandidate: mockEmbedCandidate,
  findSimilarCandidatesByEmbedding: mockFindSimilarCandidatesByEmbedding,
  findSimilarJobsByEmbedding: vi.fn().mockResolvedValue([]),
  generateQueryEmbedding: vi.fn().mockResolvedValue([0.1, 0.2]),
  buildCandidateEmbeddingText: vi.fn(() => "candidate embedding text"),
}));
vi.mock("../src/services/esco", () => ({
  getCandidateSkills: vi.fn(),
  getCandidateSkillsForCandidateIds: vi.fn(),
  getJobSkills: vi.fn(),
  getJobSkillsForJobIds: vi.fn(),
  isEscoScoringEnabled: vi.fn(() => false),
}));
vi.mock("../src/services/jobs", () => ({
  getJobById: mockGetJobById,
  listActiveJobs: mockListActiveJobs,
}));
vi.mock("../src/services/match-judge", () => ({ judgeMatch: vi.fn() }));
vi.mock("../src/services/matches", () => ({
  createMatch: mockCreateMatch,
  getMatchByJobAndCandidate: mockGetMatchByJobAndCandidate,
}));
vi.mock("../src/services/requirement-extraction", () => ({
  extractRequirements: vi.fn(),
}));
vi.mock("../src/services/scoring", () => ({ computeMatchScore: vi.fn() }));
vi.mock("../src/services/settings", () => ({
  getAllSettings: vi.fn().mockResolvedValue({}),
}));
vi.mock("../src/services/structured-matching", () => ({ runStructuredMatch: vi.fn() }));

import {
  autoMatchCandidateToJobs,
  autoMatchJobToCandidates,
} from "../src/services/auto-matching.js";

describe("auto-matching prefilter limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCandidateById.mockResolvedValue({ id: "cand-1", name: "Test Kandidaat" });
    mockEmbedCandidate.mockResolvedValue(true);
    mockGetCandidatesByIds.mockResolvedValue([]);
    mockCreateMatch.mockResolvedValue({ id: "match-1" });
    mockGetMatchByJobAndCandidate.mockResolvedValue(null);
    mockFindSimilarCandidatesByEmbedding.mockResolvedValue([]);
    mockListActiveJobs.mockResolvedValue([]);
    mockGetJobById.mockResolvedValue({ id: "job-1", title: "Test Opdracht" });
    mockListActiveCandidates.mockResolvedValue([]);
  });

  it("requests a bounded number of active jobs when candidate auto-match falls back", async () => {
    await expect(autoMatchCandidateToJobs("cand-1")).resolves.toEqual([]);

    expect(mockListActiveJobs).toHaveBeenCalledWith(200);
  });

  it("requests a bounded number of active candidates when job auto-match falls back", async () => {
    await expect(autoMatchJobToCandidates("job-1")).resolves.toEqual([]);

    expect(mockListActiveCandidates).toHaveBeenCalledWith(200);
  });

  it("prefers semantic shortlist lookup before broad candidate fallback for jobs", async () => {
    mockGetJobById.mockResolvedValue({
      id: "job-1",
      title: "Test Opdracht",
      descriptionSummary: null,
      description: "Lange vacaturetekst",
      categories: [],
      requirements: [],
    });
    mockFindSimilarCandidatesByEmbedding.mockResolvedValue([
      { id: "cand-1", name: "Test Kandidaat", similarity: 0.88 },
    ]);
    mockGetCandidatesByIds.mockResolvedValue([
      { id: "cand-1", name: "Test Kandidaat", resumeRaw: null },
    ]);

    await expect(autoMatchJobToCandidates("job-1")).resolves.toMatchObject([
      {
        jobId: "job-1",
        candidateId: "cand-1",
        quickScore: 88,
        matchId: "match-1",
      },
    ]);

    expect(mockFindSimilarCandidatesByEmbedding).toHaveBeenCalled();
    expect(mockListActiveCandidates).not.toHaveBeenCalled();
  });
});
