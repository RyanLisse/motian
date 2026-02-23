import { describe, expect, it } from "vitest";
import { computeMatchScore, extractKeywords } from "../src/services/scoring";

// Minimal interfaces for testing purposes
interface TestJob {
  id: string;
  title: string;
  platform: string;
  externalId: string;
  company?: string;
  location?: string;
  province?: string;
  rateMin?: number;
  rateMax?: number;
  requirements?: Array<{ description?: string }>;
  competences?: string[];
  description?: string;
  embedding?: number[] | null;
}

interface TestCandidate {
  id: string;
  name: string;
  role?: string;
  location?: string;
  province?: string;
  skills?: string[];
  hourlyRate?: number | null;
  embedding?: number[] | null;
}

// ── Scoring Algorithm Tests ──────────────────────────────────────

describe("Phase 15 — Scoring engine: computeMatchScore", () => {
  const baseJob: TestJob = {
    id: "job-1",
    title: "Senior Java Developer",
    platform: "striive",
    externalId: "EXT-001",
    company: "Belastingdienst",
    location: "Utrecht - Utrecht",
    province: "Utrecht",
    rateMin: 80,
    rateMax: 100,
    requirements: [
      { description: "Java Spring Boot ervaring" },
      { description: "Microservices architectuur" },
    ],
    competences: ["Java", "Spring Boot", "Docker", "Kubernetes"],
    description: "Senior Java Developer voor cloud migratie",
  };

  const baseCandidate: TestCandidate = {
    id: "cand-1",
    name: "Jan de Vries",
    role: "Java Developer",
    location: "Utrecht - Utrecht",
    province: "Utrecht",
    skills: ["Java", "Spring Boot", "Docker", "AWS"],
    hourlyRate: 95,
  };

  it("returns a score between 0 and 100", () => {
    const result = computeMatchScore(baseJob, baseCandidate);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("returns confidence between 0 and 100", () => {
    const result = computeMatchScore(baseJob, baseCandidate);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(100);
  });

  it("returns non-empty reasoning string", () => {
    const result = computeMatchScore(baseJob, baseCandidate);
    expect(result.reasoning).toBeTruthy();
    expect(typeof result.reasoning).toBe("string");
  });

  it("scores high for a perfect match", () => {
    const result = computeMatchScore(baseJob, baseCandidate);
    // Skills overlap (Java, Spring Boot, Docker) + province match + rate fit + role alignment
    expect(result.score).toBeGreaterThanOrEqual(60);
  });

  it("scores low when no fields match", () => {
    const noMatchCandidate: TestCandidate = {
      id: "cand-2",
      name: "Piet Bakker",
      role: "Marketing Manager",
      location: "Groningen - Groningen",
      province: "Groningen",
      skills: ["Photoshop", "SEO", "Content Writing"],
      hourlyRate: 150,
    };
    const result = computeMatchScore(baseJob, noMatchCandidate);
    expect(result.score).toBeLessThan(20);
  });

  it("awards province match points", () => {
    const sameProvince: TestCandidate = { ...baseCandidate, skills: [], role: "Manager" };
    const diffProvince: TestCandidate = {
      ...baseCandidate,
      skills: [],
      role: "Manager",
      province: "Groningen",
      location: "Groningen - Groningen",
    };
    const s1 = computeMatchScore(baseJob, sameProvince);
    const s2 = computeMatchScore(baseJob, diffProvince);
    expect(s1.score).toBeGreaterThan(s2.score);
  });

  it("awards rate fit points when within budget", () => {
    const withinBudget: TestCandidate = {
      ...baseCandidate,
      skills: [],
      role: "Manager",
      province: "Groningen",
      hourlyRate: 90,
    };
    const overBudget: TestCandidate = {
      ...baseCandidate,
      skills: [],
      role: "Manager",
      province: "Groningen",
      hourlyRate: 200,
    };
    const s1 = computeMatchScore(baseJob, withinBudget);
    const s2 = computeMatchScore(baseJob, overBudget);
    expect(s1.score).toBeGreaterThan(s2.score);
  });

  it("gives partial rate points when slightly over budget", () => {
    const slightlyOver: TestCandidate = {
      ...baseCandidate,
      skills: [],
      role: "Manager",
      province: "Groningen",
      hourlyRate: 105, // 5% over 100 max
    };
    const wayOver: TestCandidate = {
      ...baseCandidate,
      skills: [],
      role: "Manager",
      province: "Groningen",
      hourlyRate: 200,
    };
    const s1 = computeMatchScore(baseJob, slightlyOver);
    const s2 = computeMatchScore(baseJob, wayOver);
    expect(s1.score).toBeGreaterThan(s2.score);
  });

  it("awards role alignment points", () => {
    const matchingRole: TestCandidate = {
      ...baseCandidate,
      skills: [],
      province: "Groningen",
      hourlyRate: null,
      role: "Java Developer",
    };
    const nonMatchingRole: TestCandidate = {
      ...baseCandidate,
      skills: [],
      province: "Groningen",
      hourlyRate: null,
      role: "Marketing Manager",
    };
    const s1 = computeMatchScore(baseJob, matchingRole);
    const s2 = computeMatchScore(baseJob, nonMatchingRole);
    expect(s1.score).toBeGreaterThan(s2.score);
  });

  it("handles null/undefined fields gracefully", () => {
    const minimal: TestCandidate = { id: "cand-3", name: "Test" };
    const minimalJob: TestJob = {
      id: "job-2",
      title: "Test Job",
      platform: "test",
      externalId: "T-1",
    };
    const result = computeMatchScore(minimalJob, minimal);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.reasoning).toBeTruthy();
  });

  it("caps confidence at 100", () => {
    const result = computeMatchScore(baseJob, baseCandidate);
    expect(result.confidence).toBeLessThanOrEqual(100);
  });
});

describe("Phase 15 — extractKeywords", () => {
  it("extracts from competences", () => {
    const job: TestJob = { competences: ["Java", "Docker"] };
    const kw = extractKeywords(job);
    expect(kw).toContain("Java");
    expect(kw).toContain("Docker");
  });

  it("extracts from requirements descriptions", () => {
    const job: TestJob = {
      requirements: [{ description: "Spring Boot microservices" }],
      competences: [],
    };
    const kw = extractKeywords(job);
    expect(kw.some((k: string) => k.toLowerCase().includes("spring"))).toBe(true);
  });

  it("returns empty array for job with no data", () => {
    const kw = extractKeywords({});
    expect(kw).toEqual([]);
  });

  it("deduplicates keywords", () => {
    const job: TestJob = {
      competences: ["Java", "Java"],
      requirements: [{ description: "Java ervaring" }],
    };
    const kw = extractKeywords(job);
    const javaCount = kw.filter((k: string) => k.toLowerCase() === "java").length;
    expect(javaCount).toBe(1);
  });
});

// ── Candidates service: listActiveCandidates ─────────────────────

describe("Phase 15 — candidates service: listActiveCandidates", () => {
  it("is exported as a function", async () => {
    const { listActiveCandidates } = await import("../src/services/candidates.js");
    expect(typeof listActiveCandidates).toBe("function");
  });
});

// ── Candidates service: getCandidatesByIds ───────────────────────

describe("Phase 15 — candidates service: getCandidatesByIds", () => {
  it("is exported as a function", async () => {
    const { getCandidatesByIds } = await import("../src/services/candidates.js");
    expect(typeof getCandidatesByIds).toBe("function");
  });
});
