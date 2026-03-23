import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockEq,
  mockExtractRequirements,
  mockGetCandidateById,
  mockGetJobById,
  mockGetMatchByJobAndCandidate,
  mockInsertValues,
  mockRevalidatePath,
  mockRunStructuredMatch,
  mockSet,
  mockUpdate,
  mockWhere,
} = vi.hoisted(() => {
  const mockWhere = vi.fn().mockResolvedValue(undefined);
  const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
  const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
  const mockInsertValues = vi.fn().mockResolvedValue(undefined);

  return {
    mockEq: vi.fn((...args: unknown[]) => args),
    mockExtractRequirements: vi.fn(),
    mockGetCandidateById: vi.fn(),
    mockGetJobById: vi.fn(),
    mockGetMatchByJobAndCandidate: vi.fn(),
    mockInsertValues,
    mockRevalidatePath: vi.fn(),
    mockRunStructuredMatch: vi.fn(),
    mockSet,
    mockUpdate,
    mockWhere,
  };
});

vi.mock("drizzle-orm", () => ({ eq: mockEq }));
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
vi.mock("@/src/db", async () => {
  const actual = await import("@/src/db");
  return {
    db: {
      insert: vi.fn(() => ({ values: mockInsertValues })),
      update: mockUpdate,
    },
    // Re-export actual Drizzle helper
    eq: actual.eq,
  };
});
vi.mock("@/src/db/schema", () => ({ jobMatches: { id: "jobMatches.id" } }));
vi.mock("@/src/services/candidates", () => ({ getCandidateById: mockGetCandidateById }));
vi.mock("@/src/services/jobs", () => ({ getJobById: mockGetJobById }));
vi.mock("@/src/services/matches", () => ({
  getMatchByJobAndCandidate: mockGetMatchByJobAndCandidate,
}));
vi.mock("@/src/services/requirement-extraction", () => ({
  extractRequirements: mockExtractRequirements,
}));
vi.mock("@/src/services/structured-matching", () => ({
  runStructuredMatch: mockRunStructuredMatch,
}));

import {
  revalidateStructuredMatchViews,
  runStructuredMatchReview,
} from "@/src/services/structured-match-review";

describe("structured-match-review service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetJobById.mockResolvedValue({
      id: "job-1",
      title: "Java Developer",
      description: "Senior opdracht",
      requirements: [{ description: "Java" }],
      wishes: [{ description: "Spring" }],
      competences: ["Java"],
    });
    mockGetCandidateById.mockResolvedValue({
      id: "candidate-1",
      name: "Jane Doe",
      role: "Developer",
      resumeRaw: "Extensive Java and Spring experience across multiple enterprise projects.",
      skills: ["Java", "Spring"],
    });
    mockExtractRequirements.mockResolvedValue([{ criterion: "Java", tier: "knockout" }]);
    mockRunStructuredMatch.mockResolvedValue({
      criteriaBreakdown: [],
      enrichmentSuggestions: [],
      knockoutsPassed: true,
      overallScore: 82,
      recommendation: "go",
      recommendationConfidence: 88,
      recommendationReasoning: "Sterke match",
      riskProfile: [],
    });
    mockGetMatchByJobAndCandidate.mockResolvedValue({ id: "match-1" });
  });

  it("runs extraction, scoring, and updates an existing match", async () => {
    const outcome = await runStructuredMatchReview("job-1", "candidate-1");

    expect(outcome).toEqual({
      ok: true,
      result: expect.objectContaining({ overallScore: 82, recommendation: "go" }),
    });
    expect(mockExtractRequirements).toHaveBeenCalledWith({
      title: "Java Developer",
      description: "Senior opdracht",
      requirements: [{ description: "Java" }],
      wishes: [{ description: "Spring" }],
      competences: ["Java"],
    });
    expect(mockRunStructuredMatch).toHaveBeenCalledWith({
      requirements: [{ criterion: "Java", tier: "knockout" }],
      candidateName: "Jane Doe",
      cvText: "Extensive Java and Spring experience across multiple enterprise projects.",
    });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        assessmentModel: "marienne-v1",
        matchScore: 82,
        recommendation: "go",
      }),
    );
    expect(mockEq).toHaveBeenCalledWith("jobMatches.id", "match-1");
    expect(mockWhere).toHaveBeenCalledTimes(1);
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it("returns a domain failure when no requirements can be extracted", async () => {
    mockExtractRequirements.mockResolvedValue([]);

    const outcome = await runStructuredMatchReview("job-1", "candidate-1");

    expect(outcome).toEqual({
      ok: false,
      reason: "requirements_not_found",
      message: "Geen eisen gevonden in opdracht",
    });
    expect(mockRunStructuredMatch).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it("revalidates the shared match surfaces with optional pipeline support", () => {
    revalidateStructuredMatchViews("job-1", "candidate-1", { includePipeline: true });

    expect(mockRevalidatePath).toHaveBeenCalledWith("/kandidaten");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/vacatures");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/overzicht");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/pipeline");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/kandidaten/candidate-1");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/vacatures/job-1");
  });
});
