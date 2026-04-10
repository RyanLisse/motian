import { describe, expect, it } from "vitest";
import {
  buildCandidateIntakeScorecard,
  buildCandidateOfferReadiness,
  buildMatchBrief,
  buildPipelineHealthSnapshot,
  buildVacatureTriageScorecard,
} from "../src/services/recruiter-insights";

describe("recruiter-insights service", () => {
  it("builds a recruiter-friendly match brief from structured and commercial signals", () => {
    const brief = buildMatchBrief({
      match: {
        matchScore: 82,
        reasoning: "Sterke semantische match op data engineering en publieke sector.",
        recommendation: "go",
        recommendationConfidence: 88,
        criteriaBreakdown: [
          { criterion: "Azure ervaring", tier: "knockout", passed: true },
          { criterion: "Beschikbaar binnen 1 maand", tier: "knockout", passed: false },
        ],
      },
      candidate: {
        skills: ["Azure", "Python", "Data Engineering"],
        hourlyRate: 110,
        availability: "1_maand",
        location: "Amsterdam",
      },
      job: {
        title: "Senior Data Engineer",
        requirements: ["Azure", "Dataplatformen"],
        wishes: ["Publieke sector"],
        rateMax: 100,
        location: "Utrecht",
      },
      candidateCanonicalSkills: [{ uri: "esco:azure", preferredLabel: "Azure" }],
      jobCanonicalSkills: [
        { uri: "esco:azure", preferredLabel: "Azure" },
        { uri: "esco:data-platforms", preferredLabel: "Dataplatformen" },
      ],
    });

    expect(brief.mustHavesMet).toContain("Azure ervaring");
    expect(brief.mustHavesMissing).toContain("Beschikbaar binnen 1 maand");
    expect(brief.escoOverlap.sharedCount).toBe(1);
    expect(brief.rawSkillOverlap.sharedCount).toBeGreaterThan(0);
    expect(brief.commercialBlockers.length).toBeGreaterThan(0);
    expect(brief.recommendation.label).toBe("Go");
  });

  it("flags enrichment-first candidate intake profiles when structure is sparse", () => {
    const scorecard = buildCandidateIntakeScorecard({
      candidate: {
        role: null,
        location: null,
        skills: [],
        skillsStructured: { hard: [], soft: [] },
        resumeUrl: null,
        resumeRaw: null,
        experience: [],
        education: [],
        languageSkills: [],
      },
      candidateCanonicalSkills: [],
    });

    expect(scorecard.completenessScore).toBeLessThan(50);
    expect(scorecard.parsedSkillsQuality.tone).toBe("actie");
    expect(scorecard.escoCoverage.tone).toBe("actie");
    expect(scorecard.nextAction.key).toBe("verrijk");
  });

  it("derives offer readiness from real availability data instead of a hardcoded default", () => {
    expect(
      buildCandidateOfferReadiness({
        candidate: { availability: "direct" },
        activeApplicationCount: 0,
      }),
    ).toMatchObject({
      percentage: 92,
      statusLabel: "Direct beschikbaar",
    });

    expect(
      buildCandidateOfferReadiness({
        candidate: { availability: null },
        activeApplicationCount: 2,
      }),
    ).toMatchObject({
      percentage: null,
      statusLabel: "Beschikbaarheid onbekend",
      detail: "2 actieve sollicitaties maar geen beschikbaarheid ingevuld",
    });
  });

  it("marks a well-enriched vacature as ready for matching", () => {
    const scorecard = buildVacatureTriageScorecard({
      job: {
        title: "Senior Azure Data Engineer",
        description: "Je bouwt dataplatformen op Azure voor publieke klanten.",
        descriptionSummary: { nl: "Azure data engineering rol." },
        requirements: ["Azure", "Dataplatformen", "ETL"],
        wishes: ["Overheid"],
        workArrangement: "hybride",
        contractType: "freelance",
        rateMax: 120,
      },
      jobCanonicalSkills: [
        { uri: "esco:azure", preferredLabel: "Azure" },
        { uri: "esco:etl", preferredLabel: "ETL" },
      ],
    });

    expect(scorecard.mustHaveCount).toBe(3);
    expect(scorecard.readiness.value).toBe("Klaar voor matching");
    expect(scorecard.sourcingDifficulty.tone).not.toBe("actie");
  });

  it("builds a pipeline health snapshot from persisted operational gaps", () => {
    const snapshot = buildPipelineHealthSnapshot({
      activeScrapers: [
        { platform: "striive", lastRunAt: new Date("2026-04-01T08:00:00Z") },
        { platform: "flextender", lastRunAt: new Date() },
      ],
      recentScrapes: [
        { platform: "striive", runAt: new Date(), status: "failed", errors: ["timeout"] },
        { platform: "flextender", runAt: new Date(), status: "success", errors: [] },
      ],
      jobsMissingSummary: 5,
      jobsMissingEmbedding: 11,
      candidatesMissingEmbedding: 2,
      matchesMissingStructuredReview: 0,
    });

    expect(snapshot.status).toBe("actie");
    expect(snapshot.items).toHaveLength(6);
    expect(snapshot.items.find((item) => item.key === "jobs_missing_embedding")?.tone).toBe(
      "actie",
    );
    expect(
      snapshot.items.find((item) => item.key === "matches_missing_structured_review")?.tone,
    ).toBe("goed");
  });
});
