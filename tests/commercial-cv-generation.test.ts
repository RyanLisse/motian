import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCandidateById, mockGetJobById, mockGenerateText } = vi.hoisted(() => ({
  mockGetCandidateById: vi.fn(),
  mockGetJobById: vi.fn(),
  mockGenerateText: vi.fn(),
}));

vi.mock("../src/services/candidates", () => ({
  getCandidateById: mockGetCandidateById,
}));

vi.mock("../src/services/jobs/repository", () => ({
  getJobById: mockGetJobById,
}));

vi.mock("../src/lib/ai-models", () => ({
  geminiFlashLite: "gemini-flash-lite",
  tracedGenerateText: mockGenerateText,
}));

vi.mock("../src/lib/retry", () => ({
  withRetry: async <T>(fn: () => Promise<T>) => fn(),
}));

import { buildCommercialCvDraft } from "../src/services/commercial-cv-generation";

describe("buildCommercialCvDraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.OPENROUTER_API_KEY;
  });

  it("builds a deterministic recruiter-ready draft from candidate and vacancy data", async () => {
    mockGetCandidateById.mockResolvedValue({
      id: "cand-1",
      name: 'Joey "The Closer" Voogd',
      role: "Senior Projectmanager Vastgoed / Gebiedsontwikkelaar",
      location: "Julianadorp",
      province: "Noord-Holland",
      skills: ["Bouwkunde", "Vastgoedmanagement", "Stakeholdermanagement"],
      skillsStructured: {
        hard: [
          { name: "Bouwkunde", proficiency: 5, evidence: "25 jaar ervaring" },
          { name: "Vastgoedmanagement", proficiency: 5, evidence: "Meerdere projecten" },
        ],
        soft: [{ name: "Stakeholdermanagement", proficiency: 4, evidence: "Samenwerking" }],
      },
      profileSummary: "Ervaren leider in vastgoed en gebiedsontwikkeling.",
      headline: "Strategische verbinder in publiek-private projecten.",
      hourlyRate: 120,
      availability: "1_maand",
      education: [{ degree: "HBO Bouwkunde", institution: "Hogeschool X", year: "1998" }],
      certifications: ["Prince2 Practitioner"],
      languageSkills: [{ language: "Nederlands", level: "native" }],
      experience: [
        {
          title: "Senior Projectmanager Vastgoed",
          company: "Gemeente Haarlem",
          period: { start: "2020", end: "heden" },
          responsibilities: [
            "Leidde gebiedsontwikkelingen voor gemeentelijke opdrachtgevers",
            "Stuurde leveranciers en stakeholders aan",
          ],
        },
      ],
    });

    mockGetJobById.mockResolvedValue({
      id: "job-1",
      title: "Senior Projectmanager Vastgoed",
      company: "Gemeente Haarlem",
      location: "Haarlem",
      requirements: ["Vastgoedmanagement", "Gemeentelijke ervaring"],
      wishes: ["Gebiedsontwikkeling"],
      competences: ["Stakeholdermanagement"],
      workArrangement: "hybride",
      rateMin: 100,
      rateMax: 120,
    });

    const draft = await buildCommercialCvDraft({ candidateId: "cand-1", jobId: "job-1" });

    expect(draft.title).toBe('Commercieel CV — Joey "The Closer" Voogd');
    expect(draft.format).toBe("markdown");
    expect(draft.body).toContain("## Afgestemd op vacature");
    expect(draft.body).toContain("Senior Projectmanager Vastgoed");
    expect(draft.body).toContain("Vastgoedmanagement");
    expect(draft.body).toContain("Beschikbaarheid: Binnen 1 maand beschikbaar");
    expect(draft.body).toContain("Prince2 Practitioner");
    expect(draft.body).toContain("Leidde gebiedsontwikkelingen");
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it("uses AI rewriting when configured and falls back to deterministic facts otherwise", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";

    mockGetCandidateById.mockResolvedValue({
      id: "cand-2",
      name: "Maria Jansen",
      role: "Data Engineer",
      location: "Amsterdam",
      province: null,
      skills: ["Azure", "Python"],
      skillsStructured: {
        hard: [{ name: "Azure", proficiency: 5, evidence: "Platform ownership" }],
        soft: [],
      },
      profileSummary: "Data engineer voor publieke omgevingen.",
      headline: null,
      hourlyRate: 110,
      availability: "direct",
      education: [],
      certifications: [],
      languageSkills: [],
      experience: [],
    });

    mockGetJobById.mockResolvedValue(null);
    mockGenerateText.mockResolvedValue({
      text: "# Maria Jansen\n\n**Rol:** Data Engineer\n\n## Profiel\nSterke commerciële samenvatting.",
    });

    const draft = await buildCommercialCvDraft({ candidateId: "cand-2" });

    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    expect(draft.body).toContain("Sterke commerciële samenvatting.");
    expect(draft.body).toContain("# Maria Jansen");
  });

  it("throws when the candidate does not exist", async () => {
    mockGetCandidateById.mockResolvedValue(null);

    await expect(buildCommercialCvDraft({ candidateId: "missing" })).rejects.toThrow(
      "Kandidaat niet gevonden",
    );
  });
});
