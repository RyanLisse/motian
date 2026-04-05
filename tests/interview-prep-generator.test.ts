import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  tracedGenerateObject,
  getJobById,
  getCandidateById,
  getMatchById,
  generateScreeningQuestions,
} = vi.hoisted(() => ({
  tracedGenerateObject: vi.fn(),
  getJobById: vi.fn(),
  getCandidateById: vi.fn(),
  getMatchById: vi.fn(),
  generateScreeningQuestions: vi.fn(),
}));

vi.mock("../src/lib/ai-models", () => ({
  gemini31FlashLite: "gemini-3.1-flash-lite",
  tracedGenerateObject,
  embeddingModel: "openai-embedding-model",
}));

vi.mock("../src/services/jobs", () => ({
  getJobById,
}));

vi.mock("../src/services/candidates", () => ({
  getCandidateById,
}));

vi.mock("../src/services/matches", () => ({
  getMatchById,
}));

vi.mock("../src/services/screening-calls", () => ({
  generateScreeningQuestions,
}));

vi.mock("../src/services/applications", () => ({
  getApplicationStats: vi.fn().mockResolvedValue({
    byStage: { new: 0, screening: 0, interview: 0, offer: 0, hired: 0 },
  }),
}));

vi.mock("../src/services/settings", () => ({
  getAllSettings: vi.fn().mockResolvedValue({
    minimumScoreThreshold: 60,
    autoEnrichmentEnabled: true,
    gdprRetentionDays: 365,
    scoringSkillWeight: 40,
    scoringLocationWeight: 20,
    scoringRateWeight: 20,
    scoringRoleWeight: 20,
    autoMatchTopN: 3,
    autoMatchMinScore: 25,
  }),
}));

vi.mock("../src/services/workspace", () => ({
  getWorkspaceSummary: vi.fn().mockResolvedValue({
    jobs: { total: 10, withEmbedding: 5 },
    candidates: { total: 4 },
    matches: { total: 3, pending: 1 },
    scraperHealth: {
      overall: "gezond",
      configuredPlatforms: 1,
      supportedPlatforms: 1,
      pendingOnboarding: 0,
      platforms: [],
      catalog: [],
    },
  }),
}));

vi.mock("../src/ai/user-context", () => ({
  getUserContext: vi.fn().mockResolvedValue(null),
}));

import { buildSystemPrompt, getRecruitmentTools } from "../src/ai/agent";
import { generateInterviewPrep } from "../src/services/interview-prep-generator";

describe("generateInterviewPrep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns clarification output when core interview context is missing", async () => {
    const result = await generateInterviewPrep({
      request: "Maak interviewvoorbereiding voor een recruiter",
      interviewGoal: "Toets motivatie en beschikbaarheid",
    });

    expect(result.status).toBe("needs_clarification");
    if (result.status === "needs_clarification") {
      expect(result.missingInformation).toContain("vacature-, kandidaat- of matchcontext");
      expect(result.recommendedQuestions.length).toBeGreaterThanOrEqual(3);
      expect(result.nextStep).toContain("3-5 verduidelijkende vragen");
    }
    expect(tracedGenerateObject).not.toHaveBeenCalled();
  });

  it("uses live recruitment context and screening questions when enough detail is available", async () => {
    getJobById.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      title: "Senior Recruiter",
      company: "Motian",
      location: "Amsterdam",
      requirements: ["Stakeholdermanagement", "Sourcing"],
    });
    getCandidateById.mockResolvedValue({
      id: "22222222-2222-4222-8222-222222222222",
      name: "Jane Doe",
      role: "Recruiter",
      location: "Utrecht",
      skills: ["Stakeholdermanagement", "ATS"],
    });
    getMatchById.mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
      jobId: "11111111-1111-4111-8111-111111111111",
      candidateId: "22222222-2222-4222-8222-222222222222",
      matchScore: 72,
      riskProfile: { risks: [{ label: "Sourcing diepgang nog onduidelijk" }] },
    });
    generateScreeningQuestions.mockResolvedValue([
      {
        id: "q-1",
        question: "Kunt u uw sourcing-aanpak toelichten?",
        category: "ai_generated",
        priority: 0,
      },
    ]);
    tracedGenerateObject.mockResolvedValue({
      object: {
        prepSummary: {
          interviewType: "screening",
          interviewGoal: "Toets sourcingdiepgang en stakeholderfit",
          recommendedDuration: "30 minuten",
          contextSummary: "Senior Recruiter bij Motian met matchscore 72%.",
        },
        openingPrompt: "Bedank de kandidaat en schets kort de rol en de focus van het gesprek.",
        mustAskQuestions: [
          "Kunt u uw sourcing-aanpak toelichten?",
          "Hoe stemt u met hiring managers af?",
          "Hoe prioriteert u vacatures met meerdere stakeholders?",
          "Welke signalen gebruikt u om pipeline-risico vroeg te zien?",
        ],
        scorecardCriteria: [
          {
            criterion: "Sourcingdiepgang",
            whatGoodLooksLike: "Concreet proces met voorbeelden en metrics",
            redFlag: "Blijft te algemeen of noemt geen eigen aanpak",
          },
          {
            criterion: "Stakeholdermanagement",
            whatGoodLooksLike: "Beschrijft verwachtingsmanagement en escalatie",
            redFlag: "Geen voorbeelden van alignment met hiring managers",
          },
          {
            criterion: "Tempo en prioritering",
            whatGoodLooksLike: "Kan afwegingen onder druk helder uitleggen",
            redFlag: "Onhelder over keuzes en trade-offs",
          },
        ],
        evidenceToCapture: [
          "Voorbeeld van een lastige vacature",
          "Concrete sourcingmetrics",
          "Beschikbaarheid en tariefverwachting",
        ],
        recruiterNotes: [
          "Check of sourcingvoorbeelden echt eigen werk zijn.",
          "Let op hoe de kandidaat stakeholderconflicten beschrijft.",
          "Valideer of beschikbaarheid aansluit bij de vacature.",
        ],
        humanGuardrails: [
          "AI vat alleen samen en adviseert.",
          "Hiring-beslissingen blijven menselijk.",
          "Eindbeoordeling wordt niet door AI vastgesteld.",
        ],
        writebackPayload: {
          type: "interview_prep_template",
          interviewType: "screening",
          linkedJobId: null,
          linkedCandidateId: null,
          linkedMatchId: null,
          mustAskQuestions: [
            "Kunt u uw sourcing-aanpak toelichten?",
            "Hoe stemt u met hiring managers af?",
          ],
          evidenceToCapture: ["Concrete sourcingmetrics", "Beschikbaarheid en tariefverwachting"],
        },
      },
    });

    const result = await generateInterviewPrep({
      request: "Maak screeningvoorbereiding voor deze match",
      jobId: "11111111-1111-4111-8111-111111111111",
      candidateId: "22222222-2222-4222-8222-222222222222",
      matchId: "33333333-3333-4333-8333-333333333333",
      interviewType: "screening",
      interviewGoal: "Toets sourcingdiepgang en stakeholderfit",
      focusAreas: ["Sourcing", "Stakeholdermanagement"],
      answersSummary: "Recruiter wil een compacte prep voor een eerste screening.",
    });

    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("Expected ready status");
    expect(generateScreeningQuestions).toHaveBeenCalledTimes(1);
    expect(tracedGenerateObject).toHaveBeenCalledTimes(1);
    expect(result.artifact.writebackPayload.linkedJobId).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
    expect(result.artifact.writebackPayload.linkedCandidateId).toBe(
      "22222222-2222-4222-8222-222222222222",
    );
    expect(result.artifact.mustAskQuestions[0]).toContain("sourcing");
  });
});

describe("interview prep tool wiring", () => {
  it("registers the interview prep tool in the recruitment tool map", () => {
    const tools = getRecruitmentTools();
    expect(tools).toHaveProperty("genereerInterviewPrep");
  });

  it("includes clarify-first recruiter interview guidance in the system prompt", async () => {
    const prompt = await buildSystemPrompt({ sessionId: "sessie-1", turnCount: 1 });

    expect(prompt).toContain("screeningvragen");
    expect(prompt).toContain("genereerInterviewPrep");
    expect(prompt).toContain("definitieve hiring-beslissing");
  });

  it("exports the interview prep tool from the AI tool index", () => {
    const source = readFileSync(new URL("../src/ai/tools/index.ts", import.meta.url), "utf8");
    expect(source).toContain('export { genereerInterviewPrep } from "./interview-prep";');
  });
});
