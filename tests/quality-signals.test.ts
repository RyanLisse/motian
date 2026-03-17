import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Candidate } from "../src/services/candidates";
import type { Job } from "../src/services/jobs";
import { computeMatchScore, computeQualityScore, QUALITY_CONFIG } from "../src/services/scoring.js";

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

// ── Quality Score Unit Tests ─────────────────────────────────────

describe("computeQualityScore", () => {
  const mockDate = new Date("2024-06-15T12:00:00Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("VAL-QUALITY-001: calculates approval rate as approved/(approved+rejected)", () => {
    const decisions = [
      { status: "approved", reviewedAt: new Date("2024-06-10T12:00:00Z") },
      { status: "approved", reviewedAt: new Date("2024-06-11T12:00:00Z") },
      { status: "rejected", reviewedAt: new Date("2024-06-12T12:00:00Z") },
    ];

    const result = computeQualityScore(decisions);

    // 2 approved / 3 total = 66.67%
    expect(result.approvalRate).toBeCloseTo(2 / 3, 2);
    expect(result.totalDecisions).toBe(3);
  });

  it("VAL-QUALITY-002: returns boost for ≥70% approval rate", () => {
    const decisions = [
      { status: "approved", reviewedAt: new Date("2024-06-10T12:00:00Z") },
      { status: "approved", reviewedAt: new Date("2024-06-11T12:00:00Z") },
      { status: "approved", reviewedAt: new Date("2024-06-12T12:00:00Z") },
      { status: "rejected", reviewedAt: new Date("2024-06-13T12:00:00Z") },
    ];

    const result = computeQualityScore(decisions);

    // 3 approved / 4 total = 75% (≥70%)
    expect(result.adjustment).toBe(QUALITY_CONFIG.highApprovalBoost);
    expect(result.reasoning).toContain("Hoge goedkeuring");
    expect(result.reasoning).toContain("75%");
  });

  it("VAL-QUALITY-002: returns boost for exactly 70% approval rate", () => {
    const decisions = [
      { status: "approved", reviewedAt: new Date("2024-06-10T12:00:00Z") },
      { status: "approved", reviewedAt: new Date("2024-06-11T12:00:00Z") },
      { status: "approved", reviewedAt: new Date("2024-06-12T12:00:00Z") },
      { status: "approved", reviewedAt: new Date("2024-06-13T12:00:00Z") },
      { status: "approved", reviewedAt: new Date("2024-06-14T12:00:00Z") },
      { status: "approved", reviewedAt: new Date("2024-06-09T12:00:00Z") },
      { status: "approved", reviewedAt: new Date("2024-06-08T12:00:00Z") },
      { status: "rejected", reviewedAt: new Date("2024-06-07T12:00:00Z") },
      { status: "rejected", reviewedAt: new Date("2024-06-06T12:00:00Z") },
      { status: "rejected", reviewedAt: new Date("2024-06-05T12:00:00Z") },
    ];

    const result = computeQualityScore(decisions);

    // 7 approved / 10 total = 70% (exactly at threshold)
    expect(result.adjustment).toBe(QUALITY_CONFIG.highApprovalBoost);
  });

  it("VAL-QUALITY-003: returns penalty for <30% approval rate", () => {
    const decisions = [
      { status: "approved", reviewedAt: new Date("2024-06-10T12:00:00Z") },
      { status: "rejected", reviewedAt: new Date("2024-06-11T12:00:00Z") },
      { status: "rejected", reviewedAt: new Date("2024-06-12T12:00:00Z") },
      { status: "rejected", reviewedAt: new Date("2024-06-13T12:00:00Z") },
    ];

    const result = computeQualityScore(decisions);

    // 1 approved / 4 total = 25% (<30%)
    expect(result.adjustment).toBe(-QUALITY_CONFIG.lowApprovalPenalty);
    expect(result.reasoning).toContain("Lage goedkeuring");
    expect(result.reasoning).toContain("25%");
  });

  it("VAL-QUALITY-003: returns penalty for 0% approval rate", () => {
    const decisions = [
      { status: "rejected", reviewedAt: new Date("2024-06-10T12:00:00Z") },
      { status: "rejected", reviewedAt: new Date("2024-06-11T12:00:00Z") },
      { status: "rejected", reviewedAt: new Date("2024-06-12T12:00:00Z") },
    ];

    const result = computeQualityScore(decisions);

    // 0 approved / 3 total = 0% (<30%)
    expect(result.adjustment).toBe(-QUALITY_CONFIG.lowApprovalPenalty);
    expect(result.reasoning).toContain("Lage goedkeuring");
    expect(result.reasoning).toContain("0%");
  });

  it("VAL-QUALITY-004: returns neutral for new candidate with no history", () => {
    const result = computeQualityScore([]);

    expect(result.adjustment).toBe(0);
    expect(result.reasoning).toBeNull();
    expect(result.approvalRate).toBeNull();
    expect(result.totalDecisions).toBe(0);
  });

  it("VAL-QUALITY-004: returns neutral for null decisions", () => {
    const result = computeQualityScore(null as unknown as []);

    expect(result.adjustment).toBe(0);
    expect(result.reasoning).toBeNull();
    expect(result.approvalRate).toBeNull();
    expect(result.totalDecisions).toBe(0);
  });

  it("VAL-QUALITY-005: returns neutral for only 1 decision", () => {
    const decisions = [{ status: "approved", reviewedAt: new Date("2024-06-10T12:00:00Z") }];

    const result = computeQualityScore(decisions);

    expect(result.adjustment).toBe(0);
    expect(result.reasoning).toBeNull();
    expect(result.totalDecisions).toBe(1);
    expect(result.approvalRate).toBe(1); // 100% but not enough decisions
  });

  it("VAL-QUALITY-005: returns neutral for only 2 decisions", () => {
    const decisions = [
      { status: "approved", reviewedAt: new Date("2024-06-10T12:00:00Z") },
      { status: "rejected", reviewedAt: new Date("2024-06-11T12:00:00Z") },
    ];

    const result = computeQualityScore(decisions);

    expect(result.adjustment).toBe(0);
    expect(result.reasoning).toBeNull();
    expect(result.totalDecisions).toBe(2);
    expect(result.approvalRate).toBe(0.5); // 50% but not enough decisions
  });

  it("VAL-QUALITY-005: applies signal for exactly 3 decisions", () => {
    const decisions = [
      { status: "approved", reviewedAt: new Date("2024-06-10T12:00:00Z") },
      { status: "approved", reviewedAt: new Date("2024-06-11T12:00:00Z") },
      { status: "approved", reviewedAt: new Date("2024-06-12T12:00:00Z") },
    ];

    const result = computeQualityScore(decisions);

    // 3 approved / 3 total = 100% (≥70%)
    expect(result.adjustment).toBe(QUALITY_CONFIG.highApprovalBoost);
    expect(result.totalDecisions).toBe(3);
  });

  it("VAL-QUALITY-006: excludes decisions older than decay period", () => {
    const decisions = [
      // Recent decisions (within 90 days)
      { status: "approved", reviewedAt: new Date("2024-06-10T12:00:00Z") }, // 5 days ago
      { status: "approved", reviewedAt: new Date("2024-06-11T12:00:00Z") }, // 4 days ago
      // Old decisions (beyond 90 days)
      { status: "rejected", reviewedAt: new Date("2024-02-01T12:00:00Z") }, // ~135 days ago
      { status: "rejected", reviewedAt: new Date("2024-02-02T12:00:00Z") }, // ~134 days ago
    ];

    const result = computeQualityScore(decisions);

    // Only 2 recent approved decisions, not enough for signal
    expect(result.adjustment).toBe(0);
    expect(result.reasoning).toBeNull();
    expect(result.totalDecisions).toBe(2); // Only recent ones count
  });

  it("VAL-QUALITY-006: includes decisions exactly at decay boundary", () => {
    const decisions = [
      { status: "approved", reviewedAt: new Date("2024-03-17T12:00:00Z") }, // exactly 90 days ago
      { status: "approved", reviewedAt: new Date("2024-03-18T12:00:00Z") }, // 89 days ago
      { status: "approved", reviewedAt: new Date("2024-06-12T12:00:00Z") }, // 3 days ago
    ];

    const result = computeQualityScore(decisions);

    // All 3 should count (90 days ago is >= cutoff, so included)
    expect(result.totalDecisions).toBe(3);
    expect(result.adjustment).toBe(QUALITY_CONFIG.highApprovalBoost);
  });

  it("VAL-QUALITY-006: excludes decisions just beyond decay boundary", () => {
    const decisions = [
      { status: "approved", reviewedAt: new Date("2024-03-16T11:59:00Z") }, // just over 90 days ago
      { status: "approved", reviewedAt: new Date("2024-06-12T12:00:00Z") }, // 3 days ago
      { status: "approved", reviewedAt: new Date("2024-06-13T12:00:00Z") }, // 2 days ago
    ];

    const result = computeQualityScore(decisions);

    // Only 2 recent decisions count
    expect(result.totalDecisions).toBe(2);
    expect(result.adjustment).toBe(0); // Not enough decisions
  });

  it("returns neutral for medium approval rate (30-69%)", () => {
    const decisions = [
      { status: "approved", reviewedAt: new Date("2024-06-10T12:00:00Z") },
      { status: "approved", reviewedAt: new Date("2024-06-11T12:00:00Z") },
      { status: "rejected", reviewedAt: new Date("2024-06-12T12:00:00Z") },
      { status: "rejected", reviewedAt: new Date("2024-06-13T12:00:00Z") },
    ];

    const result = computeQualityScore(decisions);

    // 2 approved / 4 total = 50% (between 30% and 70%)
    expect(result.adjustment).toBe(0);
    expect(result.reasoning).toBeNull();
    expect(result.approvalRate).toBe(0.5);
    expect(result.totalDecisions).toBe(4);
  });

  it("ignores pending and other non-decision statuses", () => {
    const decisions = [
      { status: "approved", reviewedAt: new Date("2024-06-10T12:00:00Z") },
      { status: "approved", reviewedAt: new Date("2024-06-11T12:00:00Z") },
      { status: "approved", reviewedAt: new Date("2024-06-12T12:00:00Z") },
      { status: "pending", reviewedAt: new Date("2024-06-13T12:00:00Z") },
      { status: "reviewing", reviewedAt: new Date("2024-06-14T12:00:00Z") },
    ];

    const result = computeQualityScore(decisions);

    // Only 3 approved count, pending/reviewing ignored
    expect(result.totalDecisions).toBe(3);
    expect(result.adjustment).toBe(QUALITY_CONFIG.highApprovalBoost);
  });

  it("ignores decisions without reviewedAt timestamp", () => {
    const decisions = [
      { status: "approved", reviewedAt: new Date("2024-06-10T12:00:00Z") },
      { status: "approved", reviewedAt: new Date("2024-06-11T12:00:00Z") },
      { status: "approved", reviewedAt: new Date("2024-06-12T12:00:00Z") },
      { status: "approved", reviewedAt: null },
    ];

    const result = computeQualityScore(decisions);

    // Only 3 with valid timestamps count
    expect(result.totalDecisions).toBe(3);
    expect(result.adjustment).toBe(QUALITY_CONFIG.highApprovalBoost);
  });
});

// ── Match Score Integration Tests ────────────────────────────────

describe("computeMatchScore with quality signals", () => {
  const mockDate = new Date("2024-06-15T12:00:00Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("VAL-QUALITY-002: boosts score for high approval rate candidate", () => {
    const decisions = [
      { status: "approved", reviewedAt: new Date("2024-06-10T12:00:00Z") },
      { status: "approved", reviewedAt: new Date("2024-06-11T12:00:00Z") },
      { status: "approved", reviewedAt: new Date("2024-06-12T12:00:00Z") },
      { status: "approved", reviewedAt: new Date("2024-06-13T12:00:00Z") },
    ];

    const resultWithoutQuality = computeMatchScore(baseJob, baseCandidate);
    const resultWithQuality = computeMatchScore(baseJob, baseCandidate, {
      matchDecisions: decisions,
    });

    expect(resultWithQuality.score).toBe(
      resultWithoutQuality.score + QUALITY_CONFIG.highApprovalBoost,
    );
    expect(resultWithQuality.reasoning).toContain("Hoge goedkeuring");
  });

  it("VAL-QUALITY-003: penalizes score for low approval rate candidate", () => {
    const decisions = [
      { status: "approved", reviewedAt: new Date("2024-06-10T12:00:00Z") },
      { status: "rejected", reviewedAt: new Date("2024-06-11T12:00:00Z") },
      { status: "rejected", reviewedAt: new Date("2024-06-12T12:00:00Z") },
      { status: "rejected", reviewedAt: new Date("2024-06-13T12:00:00Z") },
    ];

    const resultWithoutQuality = computeMatchScore(baseJob, baseCandidate);
    const resultWithQuality = computeMatchScore(baseJob, baseCandidate, {
      matchDecisions: decisions,
    });

    expect(resultWithQuality.score).toBe(
      resultWithoutQuality.score - QUALITY_CONFIG.lowApprovalPenalty,
    );
    expect(resultWithQuality.reasoning).toContain("Lage goedkeuring");
  });

  it("VAL-QUALITY-004: neutral scoring for new candidate with no history", () => {
    const result = computeMatchScore(baseJob, baseCandidate, {
      matchDecisions: [],
    });

    expect(result.reasoning).not.toContain("goedkeuring");
  });

  it("VAL-QUALITY-005: neutral scoring for insufficient decisions", () => {
    const decisions = [
      { status: "approved", reviewedAt: new Date("2024-06-10T12:00:00Z") },
      { status: "approved", reviewedAt: new Date("2024-06-11T12:00:00Z") },
    ];

    const result = computeMatchScore(baseJob, baseCandidate, {
      matchDecisions: decisions,
    });

    expect(result.reasoning).not.toContain("goedkeuring");
  });

  it("caps final score at 100 maximum with quality boost", () => {
    // Create a candidate that would score very high
    const highScoringCandidate: Candidate = {
      ...baseCandidate,
      skills: ["React", "TypeScript", "Node.js"], // All match job competences
    };

    const decisions = [
      { status: "approved", reviewedAt: new Date("2024-06-10T12:00:00Z") },
      { status: "approved", reviewedAt: new Date("2024-06-11T12:00:00Z") },
      { status: "approved", reviewedAt: new Date("2024-06-12T12:00:00Z") },
      { status: "approved", reviewedAt: new Date("2024-06-13T12:00:00Z") },
    ];

    const result = computeMatchScore(baseJob, highScoringCandidate, {
      matchDecisions: decisions,
    });

    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("caps final score at 0 minimum with quality penalty", () => {
    // Create a candidate that would score very low
    const lowScoringCandidate: Candidate = {
      ...baseCandidate,
      skills: [], // No skills
      hourlyRate: 200, // Way over budget
      province: "Limburg", // Different province
    };

    const decisions = [
      { status: "rejected", reviewedAt: new Date("2024-06-10T12:00:00Z") },
      { status: "rejected", reviewedAt: new Date("2024-06-11T12:00:00Z") },
      { status: "rejected", reviewedAt: new Date("2024-06-12T12:00:00Z") },
      { status: "rejected", reviewedAt: new Date("2024-06-13T12:00:00Z") },
    ];

    const result = computeMatchScore(baseJob, lowScoringCandidate, {
      matchDecisions: decisions,
    });

    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("combines recency and quality adjustments correctly", () => {
    const candidate: Candidate = {
      ...baseCandidate,
      lastMatchedAt: new Date("2024-06-10T12:00:00Z"), // Recent match (5 days ago)
    };

    const decisions = [
      { status: "approved", reviewedAt: new Date("2024-06-10T12:00:00Z") },
      { status: "approved", reviewedAt: new Date("2024-06-11T12:00:00Z") },
      { status: "approved", reviewedAt: new Date("2024-06-12T12:00:00Z") },
      { status: "approved", reviewedAt: new Date("2024-06-13T12:00:00Z") },
    ];

    const resultWithoutSignals = computeMatchScore(baseJob, {
      ...baseCandidate,
      lastMatchedAt: null,
    });
    const resultWithBoth = computeMatchScore(baseJob, candidate, {
      matchDecisions: decisions,
    });

    // Should get both recency boost (+5) and quality boost (+5)
    expect(resultWithBoth.score).toBe(resultWithoutSignals.score + 10);
    expect(resultWithBoth.reasoning).toContain("Recente match");
    expect(resultWithBoth.reasoning).toContain("Hoge goedkeuring");
  });
});

// ── Environment Configuration Tests ──────────────────────────────

describe("QUALITY_CONFIG environment variables", () => {
  it("VAL-QUALITY-006: verifies expected default configuration values", () => {
    // The QUALITY_CONFIG is loaded at module import time from env vars
    // We verify the defaults are as documented
    expect(QUALITY_CONFIG.decayDays).toBe(90);
    expect(QUALITY_CONFIG.highApprovalThreshold).toBe(70);
    expect(QUALITY_CONFIG.lowApprovalThreshold).toBe(30);
    expect(QUALITY_CONFIG.highApprovalBoost).toBe(5);
    expect(QUALITY_CONFIG.lowApprovalPenalty).toBe(5);
    expect(QUALITY_CONFIG.minDecisions).toBe(3);
  });
});
