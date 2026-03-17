import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Candidate } from "../src/services/candidates";
import type { Job } from "../src/services/jobs";
import { computeMatchScore, computeRecencyScore, RECENCY_CONFIG } from "../src/services/scoring.js";

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

// ── Recency Score Unit Tests ─────────────────────────────────────

describe("computeRecencyScore", () => {
  const mockDate = new Date("2024-06-15T12:00:00Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("VAL-RECENCY-001: returns boost for recent match within boost days", () => {
    const lastMatchedAt = new Date("2024-06-10T12:00:00Z"); // 5 days ago
    const result = computeRecencyScore(lastMatchedAt);

    expect(result.adjustment).toBe(RECENCY_CONFIG.boostAmount);
    expect(result.reasoning).toContain("Recente match");
    expect(result.reasoning).toContain("5");
  });

  it("VAL-RECENCY-002: returns penalty for stale match beyond penalty days", () => {
    const lastMatchedAt = new Date("2024-03-15T12:00:00Z"); // 92 days ago
    const result = computeRecencyScore(lastMatchedAt);

    expect(result.adjustment).toBe(-RECENCY_CONFIG.penaltyAmount);
    expect(result.reasoning).toContain("Verouderde match");
    expect(result.reasoning).toContain("92");
  });

  it("VAL-RECENCY-003: returns neutral for null lastMatchedAt", () => {
    const result = computeRecencyScore(null);

    expect(result.adjustment).toBe(0);
    expect(result.reasoning).toBeNull();
  });

  it("VAL-RECENCY-003: returns neutral for undefined lastMatchedAt", () => {
    const result = computeRecencyScore(undefined);

    expect(result.adjustment).toBe(0);
    expect(result.reasoning).toBeNull();
  });

  it("returns neutral for match between boost and penalty window", () => {
    const lastMatchedAt = new Date("2024-05-01T12:00:00Z"); // 45 days ago (between 30 and 60)
    const result = computeRecencyScore(lastMatchedAt);

    expect(result.adjustment).toBe(0);
    expect(result.reasoning).toBeNull();
  });

  it("handles edge case: exactly at boost days boundary", () => {
    const lastMatchedAt = new Date("2024-05-16T12:00:00Z"); // exactly 30 days ago
    const result = computeRecencyScore(lastMatchedAt);

    expect(result.adjustment).toBe(RECENCY_CONFIG.boostAmount);
  });

  it("handles edge case: exactly at penalty days boundary", () => {
    const lastMatchedAt = new Date("2024-04-16T12:00:00Z"); // exactly 60 days ago
    const result = computeRecencyScore(lastMatchedAt);

    // At exactly 60 days, it's not > 60, so it should be neutral
    expect(result.adjustment).toBe(0);
    expect(result.reasoning).toBeNull();
  });

  it("handles edge case: just over penalty days boundary", () => {
    const lastMatchedAt = new Date("2024-04-15T11:59:00Z"); // just over 60 days ago
    const result = computeRecencyScore(lastMatchedAt);

    expect(result.adjustment).toBe(-RECENCY_CONFIG.penaltyAmount);
  });
});

// ── Match Score Integration Tests ────────────────────────────────

describe("computeMatchScore with recency", () => {
  const mockDate = new Date("2024-06-15T12:00:00Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("VAL-RECENCY-001: boosts score for recent match", () => {
    const candidate: Candidate = {
      ...baseCandidate,
      lastMatchedAt: new Date("2024-06-10T12:00:00Z"), // 5 days ago
    };

    const resultWithoutRecency = computeMatchScore(baseJob, {
      ...baseCandidate,
      lastMatchedAt: null,
    });
    const resultWithRecency = computeMatchScore(baseJob, candidate);

    expect(resultWithRecency.score).toBe(resultWithoutRecency.score + RECENCY_CONFIG.boostAmount);
    expect(resultWithRecency.reasoning).toContain("Recente match");
  });

  it("VAL-RECENCY-002: penalizes score for stale match", () => {
    const candidate: Candidate = {
      ...baseCandidate,
      lastMatchedAt: new Date("2024-03-15T12:00:00Z"), // 92 days ago
    };

    const resultWithoutRecency = computeMatchScore(baseJob, {
      ...baseCandidate,
      lastMatchedAt: null,
    });
    const resultWithRecency = computeMatchScore(baseJob, candidate);

    expect(resultWithRecency.score).toBe(resultWithoutRecency.score - RECENCY_CONFIG.penaltyAmount);
    expect(resultWithRecency.reasoning).toContain("Verouderde match");
  });

  it("VAL-RECENCY-003: neutral scoring for null lastMatchedAt", () => {
    const candidate: Candidate = {
      ...baseCandidate,
      lastMatchedAt: null,
    };

    const result = computeMatchScore(baseJob, candidate);

    expect(result.reasoning).not.toContain("Recente match");
    expect(result.reasoning).not.toContain("Verouderde match");
  });

  it("VAL-RECENCY-005: caps final score at 100 maximum", () => {
    // Create a candidate that would score very high without cap
    const highScoringCandidate: Candidate = {
      ...baseCandidate,
      skills: ["React", "TypeScript", "Node.js"], // All match job competences
      lastMatchedAt: new Date("2024-06-10T12:00:00Z"), // Recent match for boost
    };

    const result = computeMatchScore(baseJob, highScoringCandidate);

    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("VAL-RECENCY-005: caps final score at 0 minimum", () => {
    // Create a candidate that would score very low
    const lowScoringCandidate: Candidate = {
      ...baseCandidate,
      skills: [], // No skills
      hourlyRate: 200, // Way over budget
      province: "Limburg", // Different province
      lastMatchedAt: new Date("2024-01-01T12:00:00Z"), // Very old match for penalty
    };

    const result = computeMatchScore(baseJob, lowScoringCandidate);

    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("VAL-RECENCY-006: includes recency explanation in reasoning for recent match", () => {
    const candidate: Candidate = {
      ...baseCandidate,
      lastMatchedAt: new Date("2024-06-10T12:00:00Z"), // 5 days ago
    };

    const result = computeMatchScore(baseJob, candidate);

    expect(result.reasoning.toLowerCase()).toMatch(/recen|dagen geleden/);
  });

  it("VAL-RECENCY-006: includes recency explanation in reasoning for stale match", () => {
    const candidate: Candidate = {
      ...baseCandidate,
      lastMatchedAt: new Date("2024-03-15T12:00:00Z"), // 92 days ago
    };

    const result = computeMatchScore(baseJob, candidate);

    expect(result.reasoning.toLowerCase()).toMatch(/verouderd|dagen geleden/);
  });

  it("applies recency adjustment to hybrid (rule + vector) scores", () => {
    const embedding = Array.from({ length: 512 }, (_, i) => Math.sin(i * 0.01));
    const jobWithEmb = { ...baseJob, embedding };
    const candidateWithEmb: Candidate = {
      ...baseCandidate,
      embedding: embedding.map((v) => v + 0.05),
      lastMatchedAt: new Date("2024-06-10T12:00:00Z"), // 5 days ago
    };

    const result = computeMatchScore(jobWithEmb, candidateWithEmb);

    expect(result.model).toBe("hybrid-v1");
    expect(result.reasoning).toContain("Recente match");
  });

  it("applies recency adjustment to ESCO-based scores", () => {
    const candidate: Candidate = {
      ...baseCandidate,
      lastMatchedAt: new Date("2024-06-10T12:00:00Z"), // 5 days ago
    };

    const result = computeMatchScore(baseJob, candidate, {
      candidateEscoSkills: [
        {
          escoUri: "skill:react",
          label: "React",
          confidence: 0.98,
          critical: false,
        },
      ],
      jobEscoSkills: [
        {
          escoUri: "skill:react",
          label: "React",
          confidence: 0.99,
          required: true,
          critical: true,
          weight: 1,
        },
      ],
    });

    expect(result.reasoning).toContain("Recente match");
  });
});

// ── Environment Configuration Tests ──────────────────────────────

describe("RECENCY_CONFIG environment variables", () => {
  it("VAL-RECENCY-004: verifies expected default configuration values", () => {
    // The RECENCY_CONFIG is loaded at module import time from env vars
    // We verify the defaults are as documented
    expect(RECENCY_CONFIG.boostDays).toBe(30);
    expect(RECENCY_CONFIG.penaltyDays).toBe(60);
    expect(RECENCY_CONFIG.boostAmount).toBe(5);
    expect(RECENCY_CONFIG.penaltyAmount).toBe(5);
  });

  it("VAL-RECENCY-004: configuration affects computeRecencyScore behavior", () => {
    const mockDate = new Date("2024-06-15T12:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);

    // With default config (30 days boost window)
    const recentMatch = new Date("2024-05-20T12:00:00Z"); // 26 days ago
    const result = computeRecencyScore(recentMatch);

    // Should get boost since 26 <= 30
    expect(result.adjustment).toBe(5);
    expect(result.reasoning).toContain("Recente match");

    vi.useRealTimers();
  });
});
