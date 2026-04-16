import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockEmbedCandidate,
  mockCreateMatch,
  mockExtractRequirements,
  mockFindSimilarCandidatesByEmbedding,
  mockGetCandidateById,
  mockGetCandidatesByIds,
  mockGetMatchByJobAndCandidate,
  mockGetJobById,
  mockJudgeMatch,
  mockListActiveCandidates,
  mockListActiveJobs,
  mockRunStructuredMatch,
} = vi.hoisted(() => ({
  mockEmbedCandidate: vi.fn(),
  mockCreateMatch: vi.fn(),
  mockExtractRequirements: vi.fn(),
  mockFindSimilarCandidatesByEmbedding: vi.fn(),
  mockGetCandidateById: vi.fn(),
  mockGetCandidatesByIds: vi.fn(),
  mockGetMatchByJobAndCandidate: vi.fn(),
  mockGetJobById: vi.fn(),
  mockJudgeMatch: vi.fn(),
  mockListActiveCandidates: vi.fn(),
  mockListActiveJobs: vi.fn(),
  mockRunStructuredMatch: vi.fn(),
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
  isSkillScoringEnabled: vi.fn(() => false),
}));
vi.mock("../src/services/jobs", () => ({
  getJobById: mockGetJobById,
  listActiveJobs: mockListActiveJobs,
}));
vi.mock("../src/services/match-judge", () => ({ judgeMatch: mockJudgeMatch }));
vi.mock("../src/services/matches", () => ({
  createMatch: mockCreateMatch,
  getMatchByJobAndCandidate: mockGetMatchByJobAndCandidate,
}));
vi.mock("../src/services/requirement-extraction", () => ({
  extractRequirements: mockExtractRequirements,
}));
vi.mock("../src/services/scoring", () => ({ computeMatchScore: vi.fn() }));
vi.mock("../src/services/settings", () => ({
  getAllSettings: vi.fn().mockResolvedValue({
    autoMatchTopN: 3,
    autoMatchMinScore: 25,
    searchVectorMinScore: 0.3,
  }),
}));
vi.mock("../src/services/structured-matching", () => ({
  runStructuredMatch: mockRunStructuredMatch,
}));

import {
  autoMatchCandidateToJobs,
  autoMatchJobToCandidates,
} from "../src/services/auto-matching.js";

const mockRequirements = [
  {
    criterion: "5 jaar Java ervaring",
    tier: "knockout" as const,
    weight: null,
    source: "vacaturetekst",
  },
  {
    criterion: "Ervaring met microservices",
    tier: "gunning" as const,
    weight: 30,
    source: "functieprofiel",
  },
];

const mockStructuredMatchOutput = {
  criteriaBreakdown: [
    {
      criterion: "5 jaar Java ervaring",
      tier: "knockout",
      passed: true,
      stars: null,
      evidence: "ruime ervaring met Java",
      confidence: "high",
    },
  ],
  overallScore: 78,
  knockoutsPassed: true,
  riskProfile: [],
  enrichmentSuggestions: ["AWS certificering behalen"],
  recommendation: "go" as const,
  recommendationReasoning:
    "Kandidaat voldoet aan alle knock-out criteria en scoort goed op gunningscriteria.",
  recommendationConfidence: 85,
};

function createLongResume(label: string) {
  return `${label} heeft ruime ervaring met Java, microservices en enterprise delivery. `.repeat(2);
}

function createStructuredMatchJob() {
  return {
    id: "job-1",
    title: "Senior Java Developer",
    descriptionSummary: null,
    description:
      "Wij zoeken een senior Java developer met ruime ervaring in microservices, cloud-native architectuur en samenwerken in enterprise omgevingen. ".repeat(
        2,
      ),
    categories: [],
    requirements: [],
    wishes: [],
    competences: [],
  };
}

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
    mockExtractRequirements.mockResolvedValue(mockRequirements);
    mockRunStructuredMatch.mockResolvedValue(mockStructuredMatchOutput);
    mockJudgeMatch.mockResolvedValue(null);
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

  it("reuses extracted requirements across semantic top candidates for the same job", async () => {
    mockGetJobById.mockResolvedValue(createStructuredMatchJob());
    mockFindSimilarCandidatesByEmbedding.mockResolvedValue([
      { id: "cand-1", similarity: 0.91 },
      { id: "cand-2", similarity: 0.87 },
      { id: "cand-3", similarity: 0.83 },
    ]);
    mockGetCandidatesByIds.mockResolvedValue([
      { id: "cand-1", name: "Alice", resumeRaw: createLongResume("Alice") },
      { id: "cand-2", name: "Bob", resumeRaw: createLongResume("Bob") },
      { id: "cand-3", name: "Charlie", resumeRaw: createLongResume("Charlie") },
    ]);

    const results = await autoMatchJobToCandidates("job-1");

    expect(results).toHaveLength(3);
    expect(mockExtractRequirements).toHaveBeenCalledTimes(1);
    expect(mockRunStructuredMatch).toHaveBeenCalledTimes(3);
    expect(mockRunStructuredMatch).toHaveBeenNthCalledWith(1, {
      requirements: mockRequirements,
      candidateName: "Alice",
      cvText: createLongResume("Alice"),
    });
    expect(mockRunStructuredMatch).toHaveBeenNthCalledWith(2, {
      requirements: mockRequirements,
      candidateName: "Bob",
      cvText: createLongResume("Bob"),
    });
    expect(mockRunStructuredMatch).toHaveBeenNthCalledWith(3, {
      requirements: mockRequirements,
      candidateName: "Charlie",
      cvText: createLongResume("Charlie"),
    });
  });

  it("falls back to quick-score persistence for all pairs when shared requirement extraction fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      mockGetJobById.mockResolvedValue(createStructuredMatchJob());
      mockFindSimilarCandidatesByEmbedding.mockResolvedValue([
        { id: "cand-1", similarity: 0.91 },
        { id: "cand-2", similarity: 0.87 },
        { id: "cand-3", similarity: 0.83 },
      ]);
      mockGetCandidatesByIds.mockResolvedValue([
        { id: "cand-1", name: "Alice", resumeRaw: createLongResume("Alice") },
        { id: "cand-2", name: "Bob", resumeRaw: createLongResume("Bob") },
        { id: "cand-3", name: "Charlie", resumeRaw: createLongResume("Charlie") },
      ]);
      mockExtractRequirements.mockRejectedValueOnce(new Error("requirement extraction timeout"));

      const results = await autoMatchJobToCandidates("job-1");

      expect(mockExtractRequirements).toHaveBeenCalledTimes(1);
      expect(mockRunStructuredMatch).not.toHaveBeenCalled();
      expect(results).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            candidateId: "cand-1",
            quickScore: 91,
            structuredResult: null,
            matchSaveError: false,
          }),
          expect.objectContaining({
            candidateId: "cand-2",
            quickScore: 87,
            structuredResult: null,
            matchSaveError: false,
          }),
          expect.objectContaining({
            candidateId: "cand-3",
            quickScore: 83,
            structuredResult: null,
            matchSaveError: false,
          }),
        ]),
      );
      expect(mockCreateMatch).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ candidateId: "cand-1", matchScore: 91 }),
      );
      expect(mockCreateMatch).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ candidateId: "cand-2", matchScore: 87 }),
      );
      expect(mockCreateMatch).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({ candidateId: "cand-3", matchScore: 83 }),
      );
      expect(consoleErrorSpy).toHaveBeenCalledTimes(3);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
