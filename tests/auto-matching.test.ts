import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockEmbedCandidate,
  mockGetCandidateById,
  mockGetJobById,
  mockListActiveCandidates,
  mockListActiveJobs,
} = vi.hoisted(() => ({
  mockEmbedCandidate: vi.fn(),
  mockGetCandidateById: vi.fn(),
  mockGetJobById: vi.fn(),
  mockListActiveCandidates: vi.fn(),
  mockListActiveJobs: vi.fn(),
}));

vi.mock("../src/lib/notify-slack", () => ({ notifySlack: vi.fn() }));
vi.mock("../src/services/candidates", () => ({
  getCandidateById: mockGetCandidateById,
  listActiveCandidates: mockListActiveCandidates,
}));
vi.mock("../src/services/embedding", () => ({ embedCandidate: mockEmbedCandidate }));
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
  createMatch: vi.fn(),
  getMatchByJobAndCandidate: vi.fn(),
}));
vi.mock("../src/services/requirement-extraction", () => ({ extractRequirements: vi.fn() }));
vi.mock("../src/services/scoring", () => ({ computeMatchScore: vi.fn() }));
vi.mock("../src/services/structured-matching", () => ({ runStructuredMatch: vi.fn() }));

import { autoMatchCandidateToJobs, autoMatchJobToCandidates } from "../src/services/auto-matching.js";

describe("auto-matching prefilter limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCandidateById.mockResolvedValue({ id: "cand-1", name: "Test Kandidaat" });
    mockEmbedCandidate.mockResolvedValue(true);
    mockListActiveJobs.mockResolvedValue([]);
    mockGetJobById.mockResolvedValue({ id: "job-1", title: "Test Opdracht" });
    mockListActiveCandidates.mockResolvedValue([]);
  });

  it("requests up to 500 active jobs when auto-matching a candidate", async () => {
    await expect(autoMatchCandidateToJobs("cand-1")).resolves.toEqual([]);

    expect(mockListActiveJobs).toHaveBeenCalledWith(500);
  });

  it("requests up to 500 active candidates when auto-matching a job", async () => {
    await expect(autoMatchJobToCandidates("job-1")).resolves.toEqual([]);

    expect(mockListActiveCandidates).toHaveBeenCalledWith(500);
  });
});