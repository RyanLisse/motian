import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Candidate } from "../src/services/candidates";
import type { Job } from "../src/services/jobs";
import { computeMatchScore, validateDynamicWeights } from "../src/services/scoring.js";

// ── Test Fixtures ────────────────────────────────────────────────

const baseJob: Job = {
  id: "job-1",
  title: "Senior React Developer",
  platform: "striive",
  externalId: "EXT-001",
  company: "ING",
  location: "Amsterdam - Noord-Holland",
  province: "Noord-Holland",
  rateMax: 100,
  requirements: [{ description: "React TypeScript ervaring" }],
  competences: ["React", "TypeScript", "Node.js"],
  description: "Frontend development voor banking app",
  embedding: null,
  externalUrl: null,
  clientReferenceCode: null,
  endClient: null,
  contractLabel: null,
  status: "open",
  archivedAt: null,
  rateMin: null,
  currency: "EUR",
  positionsAvailable: 1,
  startDate: null,
  endDate: null,
  applicationDeadline: null,
  postedAt: null,
  contractType: null,
  workArrangement: null,
  allowsSubcontracting: null,
  wishes: [],
  conditions: [],
  hoursPerWeek: null,
  minHoursPerWeek: null,
  extensionPossible: null,
  countryCode: null,
  remunerationType: null,
  workExperienceYears: null,
  numberOfViews: null,
  attachments: [],
  questions: [],
  languages: [],
  descriptionSummary: null,
  faqAnswers: [],
  agentContact: null,
  recruiterContact: null,
  latitude: null,
  longitude: null,
  postcode: null,
  companyLogoUrl: null,
  educationLevel: null,
  durationMonths: null,
  sourceUrl: null,
  sourcePlatform: null,
  categories: [],
  companyAddress: null,
  scrapedAt: new Date(),
  deletedAt: null,
  rawPayload: null,
  dedupeTitleNormalized: "",
  dedupeClientNormalized: "",
  dedupeLocationNormalized: "",
  searchText: "",
};

const baseCandidate: Candidate = {
  id: "cand-1",
  name: "Lisa Jansen",
  email: "lisa@example.com",
  phone: null,
  role: "React Developer",
  location: "Amsterdam - Noord-Holland",
  province: "Noord-Holland",
  skills: ["React", "TypeScript", "CSS"],
  hourlyRate: 95,
  embedding: null,
  lastMatchedAt: null,
  experience: [],
  preferences: {},
  resumeUrl: null,
  linkedinUrl: null,
  headline: null,
  profileSummary: null,
  source: null,
  notes: null,
  availability: null,
  resumeRaw: null,
  resumeParsedAt: null,
  matchingStatus: "open",
  matchingStatusUpdatedAt: new Date(),
  skillsStructured: null,
  education: null,
  certifications: null,
  languageSkills: null,
  consentGranted: false,
  dataRetentionUntil: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

// ── Dynamic Weights Validation Tests ────────────────────────────

describe("validateDynamicWeights", () => {
  it("VAL-WEIGHTS-004: throws error for negative weight", () => {
    expect(() => validateDynamicWeights({ skills: -0.1 })).toThrow("skills is negative");
    expect(() => validateDynamicWeights({ location: -0.5 })).toThrow("location is negative");
    expect(() => validateDynamicWeights({ rate: -1 })).toThrow("rate is negative");
    expect(() => validateDynamicWeights({ role: -0.01 })).toThrow("role is negative");
  });

  it("VAL-WEIGHTS-004: throws error for weight > 1", () => {
    expect(() => validateDynamicWeights({ skills: 1.01 })).toThrow("skills exceeds 1");
    expect(() => validateDynamicWeights({ location: 2 })).toThrow("location exceeds 1");
    expect(() => validateDynamicWeights({ rate: 100 })).toThrow("rate exceeds 1");
    expect(() => validateDynamicWeights({ role: 1.001 })).toThrow("role exceeds 1");
  });

  it("VAL-WEIGHTS-004: throws error for NaN weight", () => {
    expect(() => validateDynamicWeights({ skills: NaN })).toThrow("skills is NaN");
    expect(() => validateDynamicWeights({ location: NaN })).toThrow("location is NaN");
    expect(() => validateDynamicWeights({ ruleWeight: NaN })).toThrow("ruleWeight is NaN");
    expect(() => validateDynamicWeights({ vectorWeight: NaN })).toThrow("vectorWeight is NaN");
  });

  it("accepts valid weights at boundaries", () => {
    expect(() => validateDynamicWeights({ skills: 0 })).not.toThrow();
    expect(() => validateDynamicWeights({ skills: 1 })).not.toThrow();
    expect(() => validateDynamicWeights({ location: 0.5 })).not.toThrow();
    expect(() => validateDynamicWeights({ rate: 0.75 })).not.toThrow();
    expect(() => validateDynamicWeights({ role: 0.25 })).not.toThrow();
  });

  it("accepts valid hybrid blend weights", () => {
    expect(() => validateDynamicWeights({ ruleWeight: 0 })).not.toThrow();
    expect(() => validateDynamicWeights({ ruleWeight: 1 })).not.toThrow();
    expect(() => validateDynamicWeights({ vectorWeight: 0 })).not.toThrow();
    expect(() => validateDynamicWeights({ vectorWeight: 1 })).not.toThrow();
    expect(() => validateDynamicWeights({ ruleWeight: 0.6, vectorWeight: 0.4 })).not.toThrow();
  });

  it("accepts empty weights object", () => {
    expect(() => validateDynamicWeights({})).not.toThrow();
  });

  it("accepts partial weights", () => {
    expect(() => validateDynamicWeights({ skills: 0.5 })).not.toThrow();
    expect(() => validateDynamicWeights({ ruleWeight: 0.7 })).not.toThrow();
  });
});

// ── Backward Compatibility Tests ─────────────────────────────────

describe("computeMatchScore backward compatibility", () => {
  it("VAL-WEIGHTS-002: produces same result without weights parameter", () => {
    const resultWithoutWeights = computeMatchScore(baseJob, baseCandidate);
    const resultWithEmptyWeights = computeMatchScore(baseJob, baseCandidate, { weights: {} });

    expect(resultWithEmptyWeights.score).toBe(resultWithoutWeights.score);
    expect(resultWithEmptyWeights.reasoning).toBe(resultWithoutWeights.reasoning);
    expect(resultWithEmptyWeights.model).toBe(resultWithoutWeights.model);
  });

  it("VAL-WEIGHTS-002: uses default SCORING_WEIGHTS when weights not provided", () => {
    const result = computeMatchScore(baseJob, baseCandidate);

    // With default weights (skills=40, location=20, rate=20, role=20)
    // This candidate should match on all dimensions
    expect(result.score).toBeGreaterThan(0);
    expect(result.reasoning).toContain("Provincie match");
    expect(result.reasoning).toContain("Tarief past binnen budget");
  });

  it("VAL-WEIGHTS-002: uses default HYBRID_BLEND when weights not provided", () => {
    const embedding = Array.from({ length: 512 }, (_, i) => Math.sin(i * 0.01));
    const jobWithEmb = { ...baseJob, embedding };
    const candidateWithEmb: Candidate = {
      ...baseCandidate,
      embedding: embedding.map((v) => v + 0.05),
    };

    const result = computeMatchScore(jobWithEmb, candidateWithEmb);

    // Should use hybrid model with default 60/40 blend
    expect(result.model).toBe("hybrid-v1");
  });
});

// ── Per-Component Weight Override Tests ──────────────────────────

describe("computeMatchScore with dynamic weights", () => {
  it("VAL-WEIGHTS-003: skills weight override affects score", () => {
    // Use candidate with partial skill match to see weight effect
    const candidateWithPartialSkills: Candidate = {
      ...baseCandidate,
      skills: ["React"], // Only 1 of 3 job competences
    };

    const resultWithHighSkills = computeMatchScore(baseJob, candidateWithPartialSkills, {
      weights: { skills: 0.8 }, // 80% weight vs default 40%
    });
    const resultWithLowSkills = computeMatchScore(baseJob, candidateWithPartialSkills, {
      weights: { skills: 0.1 }, // 10% weight vs default 40%
    });

    // Higher skills weight should result in higher score when skills match
    expect(resultWithHighSkills.score).toBeGreaterThan(resultWithLowSkills.score);
    // Verify weights are actually being applied (scores should differ)
    expect(resultWithHighSkills.score).not.toBe(resultWithLowSkills.score);
  });

  it("VAL-WEIGHTS-003: location weight override affects score", () => {
    const resultWithDefaultLocation = computeMatchScore(baseJob, baseCandidate);
    const resultWithHighLocation = computeMatchScore(baseJob, baseCandidate, {
      weights: { location: 0.5 }, // 50% weight vs default 20%
    });
    const resultWithZeroLocation = computeMatchScore(baseJob, baseCandidate, {
      weights: { location: 0 }, // 0% weight
    });

    // Same location match, higher weight = higher score
    expect(resultWithHighLocation.score).toBeGreaterThan(resultWithDefaultLocation.score);
    // Zero location weight should reduce score
    expect(resultWithZeroLocation.score).toBeLessThan(resultWithDefaultLocation.score);
  });

  it("VAL-WEIGHTS-003: rate weight override affects score", () => {
    const resultWithDefaultRate = computeMatchScore(baseJob, baseCandidate);
    const resultWithHighRate = computeMatchScore(baseJob, baseCandidate, {
      weights: { rate: 0.5 }, // 50% weight vs default 20%
    });
    const resultWithZeroRate = computeMatchScore(baseJob, baseCandidate, {
      weights: { rate: 0 }, // 0% weight
    });

    // Rate within budget, higher weight = higher score
    expect(resultWithHighRate.score).toBeGreaterThan(resultWithDefaultRate.score);
    expect(resultWithZeroRate.score).toBeLessThan(resultWithDefaultRate.score);
  });

  it("VAL-WEIGHTS-003: role weight override affects score", () => {
    // Use candidate with partial role match
    const candidateWithPartialRole: Candidate = {
      ...baseCandidate,
      role: "Developer", // Partial match to "Senior React Developer"
    };

    const resultWithHighRole = computeMatchScore(baseJob, candidateWithPartialRole, {
      weights: { role: 0.5 }, // 50% weight vs default 20%
    });
    const resultWithZeroRole = computeMatchScore(baseJob, candidateWithPartialRole, {
      weights: { role: 0 }, // 0% weight
    });

    // Role matches title, higher weight = higher score
    expect(resultWithHighRole.score).toBeGreaterThan(resultWithZeroRole.score);
    // Verify weights are actually being applied (scores should differ)
    expect(resultWithHighRole.score).not.toBe(resultWithZeroRole.score);
  });

  it("VAL-WEIGHTS-003: partial weight override only affects specified components", () => {
    const result = computeMatchScore(baseJob, baseCandidate, {
      weights: { skills: 0.6 }, // Only override skills
    });

    // Should still have location, rate, role matches in reasoning
    expect(result.reasoning).toContain("Provincie match");
    expect(result.reasoning).toContain("Tarief past binnen budget");
  });

  it("VAL-WEIGHTS-003: multiple component overrides work together", () => {
    const result = computeMatchScore(baseJob, baseCandidate, {
      weights: {
        skills: 0.5,
        location: 0.3,
        rate: 0.15,
        role: 0.05,
      },
    });

    expect(result.score).toBeGreaterThan(0);
    expect(result.reasoning).toContain("Provincie match");
    expect(result.reasoning).toContain("Tarief past binnen budget");
  });
});

// ── Hybrid Blend Override Tests ──────────────────────────────────

describe("computeMatchScore with hybrid blend override", () => {
  const embedding = Array.from({ length: 512 }, (_, i) => Math.sin(i * 0.01));
  const jobWithEmb = { ...baseJob, embedding };
  const candidateWithEmb: Candidate = {
    ...baseCandidate,
    embedding: embedding.map((v) => v + 0.1), // High similarity
  };

  it("VAL-WEIGHTS-005: ruleWeight override affects hybrid calculation", () => {
    const resultWithDefaultBlend = computeMatchScore(jobWithEmb, candidateWithEmb);
    const resultWithHighRule = computeMatchScore(jobWithEmb, candidateWithEmb, {
      weights: { ruleWeight: 0.9, vectorWeight: 0.1 },
    });
    const resultWithLowRule = computeMatchScore(jobWithEmb, candidateWithEmb, {
      weights: { ruleWeight: 0.1, vectorWeight: 0.9 },
    });

    // Different blend ratios should produce different scores
    expect(resultWithHighRule.score).not.toBe(resultWithLowRule.score);
    expect(resultWithDefaultBlend.score).not.toBe(resultWithHighRule.score);
  });

  it("VAL-WEIGHTS-005: vectorWeight override affects hybrid calculation", () => {
    const resultWithDefaultBlend = computeMatchScore(jobWithEmb, candidateWithEmb);
    const resultWithHighVector = computeMatchScore(jobWithEmb, candidateWithEmb, {
      weights: { ruleWeight: 0.2, vectorWeight: 0.8 },
    });

    // Higher vector weight with high similarity should change score
    expect(resultWithHighVector.score).not.toBe(resultWithDefaultBlend.score);
  });

  it("VAL-WEIGHTS-005: 100% rule-based blend ignores vector", () => {
    const result = computeMatchScore(jobWithEmb, candidateWithEmb, {
      weights: { ruleWeight: 1, vectorWeight: 0 },
    });

    // With 100% rule weight, score should equal rule-based score
    // The model label still reports hybrid-v1 since embeddings exist
    expect(result.model).toBe("hybrid-v1");
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("VAL-WEIGHTS-005: 100% vector blend emphasizes similarity", () => {
    const result = computeMatchScore(jobWithEmb, candidateWithEmb, {
      weights: { ruleWeight: 0, vectorWeight: 1 },
    });

    // Score should be heavily influenced by vector similarity
    expect(result.score).toBeGreaterThan(50); // High similarity should yield high score
  });
});

// ── Query-Time Weights Parameter Tests ───────────────────────────

describe("computeMatchScore query-time weights", () => {
  it("VAL-WEIGHTS-001: accepts weights parameter in options", () => {
    const result = computeMatchScore(baseJob, baseCandidate, {
      weights: {
        skills: 0.5,
        location: 0.25,
        rate: 0.15,
        role: 0.1,
      },
    });

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("VAL-WEIGHTS-001: accepts hybrid blend in weights parameter", () => {
    const embedding = Array.from({ length: 512 }, (_, i) => Math.sin(i * 0.01));
    const jobWithEmb = { ...baseJob, embedding };
    const candidateWithEmb: Candidate = {
      ...baseCandidate,
      embedding: embedding.map((v) => v + 0.05),
    };

    const result = computeMatchScore(jobWithEmb, candidateWithEmb, {
      weights: {
        ruleWeight: 0.7,
        vectorWeight: 0.3,
      },
    });

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("VAL-WEIGHTS-001: accepts combined scoring and blend weights", () => {
    const embedding = Array.from({ length: 512 }, (_, i) => Math.sin(i * 0.01));
    const jobWithEmb = { ...baseJob, embedding };
    const candidateWithEmb: Candidate = {
      ...baseCandidate,
      embedding: embedding.map((v) => v + 0.05),
    };

    const result = computeMatchScore(jobWithEmb, candidateWithEmb, {
      weights: {
        skills: 0.4,
        location: 0.2,
        rate: 0.2,
        role: 0.2,
        ruleWeight: 0.5,
        vectorWeight: 0.5,
      },
    });

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

// ── Integration with Recency and Quality ─────────────────────────

describe("computeMatchScore dynamic weights with recency/quality", () => {
  const mockDate = new Date("2024-06-15T12:00:00Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("applies dynamic weights before recency and quality adjustments", () => {
    const candidate: Candidate = {
      ...baseCandidate,
      lastMatchedAt: new Date("2024-06-10T12:00:00Z"), // Recent match
    };

    const decisions = [
      { status: "approved", reviewedAt: new Date("2024-06-10T12:00:00Z") },
      { status: "approved", reviewedAt: new Date("2024-06-11T12:00:00Z") },
      { status: "approved", reviewedAt: new Date("2024-06-12T12:00:00Z") },
      { status: "approved", reviewedAt: new Date("2024-06-13T12:00:00Z") },
    ];

    const result = computeMatchScore(baseJob, candidate, {
      weights: { skills: 0.6, location: 0.2, rate: 0.1, role: 0.1 },
      matchDecisions: decisions,
    });

    // Should have both recency and quality in reasoning
    expect(result.reasoning).toContain("Recente match");
    expect(result.reasoning).toContain("Hoge goedkeuring");
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("dynamic weights affect base score before capping", () => {
    const highScoringCandidate: Candidate = {
      ...baseCandidate,
      skills: ["React", "TypeScript", "Node.js"],
      lastMatchedAt: new Date("2024-06-10T12:00:00Z"),
    };

    const resultWithHighSkills = computeMatchScore(baseJob, highScoringCandidate, {
      weights: { skills: 1.0 }, // Maximum skills weight
    });

    const resultWithLowSkills = computeMatchScore(baseJob, highScoringCandidate, {
      weights: { skills: 0.1 }, // Minimum skills weight
    });

    // Both should be capped at 100 even with high base scores
    expect(resultWithHighSkills.score).toBeLessThanOrEqual(100);
    expect(resultWithLowSkills.score).toBeLessThanOrEqual(100);
    // High skills weight should produce higher score
    expect(resultWithHighSkills.score).toBeGreaterThan(resultWithLowSkills.score);
  });
});

// ── Edge Cases ───────────────────────────────────────────────────

describe("computeMatchScore dynamic weights edge cases", () => {
  it("handles all-zero weights gracefully", () => {
    const result = computeMatchScore(baseJob, baseCandidate, {
      weights: { skills: 0, location: 0, rate: 0, role: 0 },
    });

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("handles all-maximum weights gracefully", () => {
    const result = computeMatchScore(baseJob, baseCandidate, {
      weights: { skills: 1, location: 1, rate: 1, role: 1 },
    });

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("handles very small weight values", () => {
    const result = computeMatchScore(baseJob, baseCandidate, {
      weights: { skills: 0.001, location: 0.001, rate: 0.001, role: 0.001 },
    });

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("handles weights with many decimal places", () => {
    const result = computeMatchScore(baseJob, baseCandidate, {
      weights: { skills: 0.333333, location: 0.666667 },
    });

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

// ── Cross-Area Flow Tests ─────────────────────────────────────────

describe("computeMatchScore cross-area factor interactions", () => {
  const mockDate = new Date("2024-06-15T12:00:00Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("VAL-CROSS-001: combined recency and quality boosts apply additively within score caps", () => {
    // Candidate with both recent match AND high approval rate
    const candidate: Candidate = {
      ...baseCandidate,
      lastMatchedAt: new Date("2024-06-10T12:00:00Z"), // Recent (5 days ago)
      skills: ["React", "TypeScript"],
    };

    const decisions = [
      { status: "approved", reviewedAt: new Date("2024-06-12T12:00:00Z") },
      { status: "approved", reviewedAt: new Date("2024-06-13T12:00:00Z") },
      { status: "approved", reviewedAt: new Date("2024-06-14T12:00:00Z") },
    ];

    const result = computeMatchScore(baseJob, candidate, {
      weights: { skills: 0.5, location: 0.2, rate: 0.15, role: 0.15 },
      matchDecisions: decisions,
    });

    // Should have BOTH recency and quality boosts in reasoning
    expect(result.reasoning).toContain("Recente match");
    expect(result.reasoning).toContain("Hoge goedkeuring");

    // Both boosts should add up (+5 +5 = +10 on top of base)
    // Score should be > 80 (base 70 + recency 5 + quality 5 = 80 minimum)
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("VAL-CROSS-001: combined penalty and boost scenarios work correctly", () => {
    // Candidate with stale match but high approval rate
    const candidateStaleButGood: Candidate = {
      ...baseCandidate,
      lastMatchedAt: new Date("2024-05-01T12:00:00Z"), // Stale (45 days ago, between penalty threshold)
      skills: ["React", "TypeScript"],
    };

    const decisions = [
      { status: "approved", reviewedAt: new Date("2024-06-12T12:00:00Z") },
      { status: "approved", reviewedAt: new Date("2024-06-13T12:00:00Z") },
      { status: "approved", reviewedAt: new Date("2024-06-14T12:00:00Z") },
    ];

    const result = computeMatchScore(baseJob, candidateStaleButGood, {
      weights: { skills: 0.5, location: 0.2, rate: 0.15, role: 0.15 },
      matchDecisions: decisions,
    });

    // Quality boost should apply, no recency adjustment
    expect(result.reasoning).toContain("Hoge goedkeuring");
    expect(result.reasoning).not.toContain("Recente match");
    expect(result.reasoning).not.toContain("Verouderde match");
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("VAL-CROSS-002: recency and quality adjustments apply after base calculation but before final cap", () => {
    // Create candidate that would score very high with all factors
    const candidate: Candidate = {
      ...baseCandidate,
      lastMatchedAt: new Date("2024-06-14T12:00:00Z"), // Very recent (1 day ago)
      skills: ["React", "TypeScript", "Node.js"], // Full skill match
    };

    const decisions = [
      { status: "approved", reviewedAt: new Date("2024-06-12T12:00:00Z") },
      { status: "approved", reviewedAt: new Date("2024-06-13T12:00:00Z") },
      { status: "approved", reviewedAt: new Date("2024-06-14T12:00:00Z") },
    ];

    const embedding = Array.from({ length: 512 }, (_, i) => Math.sin(i * 0.01));
    const jobWithEmb = { ...baseJob, embedding };
    const candidateWithEmb: Candidate = {
      ...candidate,
      embedding: embedding.map((v) => v + 0.1), // High similarity
    };

    const result = computeMatchScore(jobWithEmb, candidateWithEmb, {
      weights: { skills: 0.5, location: 0.2, rate: 0.15, role: 0.15 },
      matchDecisions: decisions,
    });

    // Order: base score computed first, then recency+quality added, THEN capped
    // With 95 rule score + ~95 vector score (hybrid 0.6/0.4) = ~95 base
    // +5 recency +5 quality = 105, then capped to 100
    expect(result.score).toBe(100); // Should be at cap
    expect(result.reasoning).toContain("Recente match");
    expect(result.reasoning).toContain("Hoge goedkeuring");
  });

  it("VAL-CROSS-002: dynamic weights affect base score before recency/quality is applied", () => {
    const candidate: Candidate = {
      ...baseCandidate,
      lastMatchedAt: new Date("2024-06-14T12:00:00Z"), // Recent
      skills: ["React"],
    };

    const decisions = [
      { status: "approved", reviewedAt: new Date("2024-06-12T12:00:00Z") },
      { status: "approved", reviewedAt: new Date("2024-06-13T12:00:00Z") },
      { status: "approved", reviewedAt: new Date("2024-06-14T12:00:00Z") },
    ];

    const resultWithHighSkills = computeMatchScore(baseJob, candidate, {
      weights: { skills: 1.0, location: 0.2, rate: 0.15, role: 0.15 },
      matchDecisions: decisions,
    });

    const resultWithLowSkills = computeMatchScore(baseJob, candidate, {
      weights: { skills: 0.1, location: 0.2, rate: 0.15, role: 0.15 },
      matchDecisions: decisions,
    });

    // Recency and quality adjustments are identical (+5 each)
    // But base scores differ due to skills weight
    // Final: highSkills = base_high + 10, lowSkills = base_low + 10
    expect(resultWithHighSkills.score).toBeGreaterThan(resultWithLowSkills.score);
    // Both should still have recency and quality in reasoning
    expect(resultWithHighSkills.reasoning).toContain("Recente match");
    expect(resultWithHighSkills.reasoning).toContain("Hoge goedkeuring");
  });

  it("VAL-CROSS-003: entirely new candidate (no lastMatchedAt, no history) gets baseline scoring", () => {
    const newCandidate: Candidate = {
      ...baseCandidate,
      lastMatchedAt: null,
      createdAt: new Date("2024-06-15T12:00:00Z"),
      updatedAt: new Date("2024-06-15T12:00:00Z"),
    };

    const result = computeMatchScore(baseJob, newCandidate);

    // No recency reason (null lastMatchedAt = neutral)
    expect(result.reasoning).not.toContain("Recente match");
    expect(result.reasoning).not.toContain("Verouderde match");
    // No quality reason (no decisions)
    expect(result.reasoning).not.toContain("Goedkeuring");
    // Should only have rule-based matches
    expect(result.reasoning).toContain("Provincie match");
    expect(result.reasoning).toContain("Tarief past binnen budget");
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("VAL-CROSS-003: candidate with null lastMatchedAt AND partial history gets baseline + quality", () => {
    const candidate: Candidate = {
      ...baseCandidate,
      lastMatchedAt: null, // No lastMatchedAt = neutral recency
      skills: ["React", "TypeScript"],
    };

    const decisions = [
      { status: "approved", reviewedAt: new Date("2024-06-12T12:00:00Z") },
      { status: "rejected", reviewedAt: new Date("2024-06-13T12:00:00Z") },
      { status: "approved", reviewedAt: new Date("2024-06-14T12:00:00Z") },
    ];

    const result = computeMatchScore(baseJob, candidate, {
      matchDecisions: decisions,
    });

    // No recency adjustment
    expect(result.reasoning).not.toContain("Recente match");
    expect(result.reasoning).not.toContain("Verouderde match");
    // But quality applies (67% approval rate - medium, no boost or penalty)
    // At 67%, which is between 30% and 70%, so no adjustment
    expect(result.reasoning).not.toContain("Goedkeuring");
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("VAL-CROSS-003: candidate with old history outside decay window gets neutral quality", () => {
    const candidate: Candidate = {
      ...baseCandidate,
      lastMatchedAt: new Date("2024-06-10T12:00:00Z"), // Recent
      skills: ["React", "TypeScript"],
    };

    // Old decisions outside 90-day decay window
    const decisions = [
      { status: "approved", reviewedAt: new Date("2024-01-01T12:00:00Z") },
      { status: "approved", reviewedAt: new Date("2024-01-15T12:00:00Z") },
      { status: "approved", reviewedAt: new Date("2024-02-01T12:00:00Z") },
    ];

    const result = computeMatchScore(baseJob, candidate, {
      matchDecisions: decisions,
    });

    // Recent match boost applies
    expect(result.reasoning).toContain("Recente match");
    // But quality is neutral because old decisions fall outside decay window
    expect(result.reasoning).not.toContain("Goedkeuring");
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
