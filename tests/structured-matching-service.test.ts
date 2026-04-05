import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGenerateText, mockWithRetry } = vi.hoisted(() => ({
  mockGenerateText: vi.fn(),
  mockWithRetry: vi.fn(),
}));

vi.mock("../src/lib/ai-models", () => ({
  geminiFlash: "mock-gemini-flash",
  embeddingModel: "mock-embedding-model",
  tracedGenerateText: mockGenerateText,
  tracedEmbed: vi.fn(),
  tracedEmbedMany: vi.fn(),
}));
vi.mock("../src/lib/retry", () => ({
  withRetry: mockWithRetry,
}));

import { runStructuredMatch } from "../src/services/structured-matching";

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

const mockCvText =
  "Dit is een voldoende lang CV tekst voor de test. De kandidaat heeft ruime ervaring met Java en microservices architectuur bij diverse enterprise organisaties.";

const mockMatchOutput = {
  criteriaBreakdown: [
    {
      criterion: "5 jaar Java ervaring",
      tier: "knockout",
      passed: true,
      stars: null,
      evidence: "ruime ervaring met Java",
      confidence: "high",
    },
    {
      criterion: "Ervaring met microservices",
      tier: "gunning",
      passed: null,
      stars: 4,
      evidence: "microservices architectuur bij diverse enterprise organisaties",
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

describe("runStructuredMatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWithRetry.mockImplementation((fn: () => unknown) => fn());
    mockGenerateText.mockResolvedValue({ output: mockMatchOutput });
  });

  it("throws when requirements array is empty", async () => {
    await expect(
      runStructuredMatch({
        requirements: [],
        candidateName: "Test Kandidaat",
        cvText: mockCvText,
      }),
    ).rejects.toThrow("Requirements list is empty — cannot run structured match without criteria.");
  });

  it("throws when cvText is less than 50 characters", async () => {
    const shortCv = "Te kort CV";
    await expect(
      runStructuredMatch({
        requirements: mockRequirements,
        candidateName: "Test Kandidaat",
        cvText: shortCv,
      }),
    ).rejects.toThrow(
      `CV text is too short (${shortCv.length} chars). Minimum 50 characters required for meaningful evaluation.`,
    );
  });

  it("calls generateText with correct model and schema", async () => {
    await runStructuredMatch({
      requirements: mockRequirements,
      candidateName: "Jan de Vries",
      cvText: mockCvText,
    });

    expect(mockGenerateText).toHaveBeenCalledOnce();
    const callArgs = mockGenerateText.mock.calls[0][0];
    expect(callArgs.model).toBe("mock-gemini-flash");
    expect(callArgs.output).toBeDefined();
    expect(callArgs.system).toContain("recruitment matching specialist");
  });

  it("includes candidate name and CV text in prompt", async () => {
    await runStructuredMatch({
      requirements: mockRequirements,
      candidateName: "Jan de Vries",
      cvText: mockCvText,
    });

    const callArgs = mockGenerateText.mock.calls[0][0];
    expect(callArgs.prompt).toContain("Jan de Vries");
    expect(callArgs.prompt).toContain(mockCvText);
  });

  it("includes JSON-stringified requirements in prompt", async () => {
    await runStructuredMatch({
      requirements: mockRequirements,
      candidateName: "Jan de Vries",
      cvText: mockCvText,
    });

    const callArgs = mockGenerateText.mock.calls[0][0];
    expect(callArgs.prompt).toContain(JSON.stringify(mockRequirements, null, 2));
  });

  it("returns the structured match output", async () => {
    const result = await runStructuredMatch({
      requirements: mockRequirements,
      candidateName: "Jan de Vries",
      cvText: mockCvText,
    });

    expect(result).toEqual(mockMatchOutput);
  });

  it("uses withRetry wrapper", async () => {
    await runStructuredMatch({
      requirements: mockRequirements,
      candidateName: "Jan de Vries",
      cvText: mockCvText,
    });

    expect(mockWithRetry).toHaveBeenCalledOnce();
    expect(mockWithRetry).toHaveBeenCalledWith(expect.any(Function), {
      label: "Structured Matching",
    });
  });
});
