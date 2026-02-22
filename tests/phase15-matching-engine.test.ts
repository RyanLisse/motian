import { describe, it, expect } from "vitest";
import {
  computeMatchScore,
  extractKeywords,
} from "../src/services/scoring.js";

// ── Scoring Algorithm Tests ──────────────────────────────────────

describe("Phase 15 — Scoring engine: computeMatchScore", () => {
  const baseJob = {
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

  const baseCandidate = {
    id: "cand-1",
    name: "Jan de Vries",
    role: "Java Developer",
    location: "Utrecht - Utrecht",
    province: "Utrecht",
    skills: ["Java", "Spring Boot", "Docker", "AWS"],
    hourlyRate: 95,
  };

  it("returns a score between 0 and 100", () => {
    const result = computeMatchScore(baseJob as any, baseCandidate as any);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("returns confidence between 0 and 100", () => {
    const result = computeMatchScore(baseJob as any, baseCandidate as any);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(100);
  });

  it("returns non-empty reasoning string", () => {
    const result = computeMatchScore(baseJob as any, baseCandidate as any);
    expect(result.reasoning).toBeTruthy();
    expect(typeof result.reasoning).toBe("string");
  });

  it("scores high for a perfect match", () => {
    const result = computeMatchScore(baseJob as any, baseCandidate as any);
    // Skills overlap (Java, Spring Boot, Docker) + province match + rate fit + role alignment
    expect(result.score).toBeGreaterThanOrEqual(60);
  });

  it("scores low when no fields match", () => {
    const noMatchCandidate = {
      id: "cand-2",
      name: "Piet Bakker",
      role: "Marketing Manager",
      location: "Groningen - Groningen",
      province: "Groningen",
      skills: ["Photoshop", "SEO", "Content Writing"],
      hourlyRate: 150,
    };
    const result = computeMatchScore(baseJob as any, noMatchCandidate as any);
    expect(result.score).toBeLessThan(20);
  });

  it("awards province match points", () => {
    const sameProvince = { ...baseCandidate, skills: [], role: "Manager" };
    const diffProvince = {
      ...baseCandidate,
      skills: [],
      role: "Manager",
      province: "Groningen",
      location: "Groningen - Groningen",
    };
    const s1 = computeMatchScore(baseJob as any, sameProvince as any);
    const s2 = computeMatchScore(baseJob as any, diffProvince as any);
    expect(s1.score).toBeGreaterThan(s2.score);
  });

  it("awards rate fit points when within budget", () => {
    const withinBudget = {
      ...baseCandidate,
      skills: [],
      role: "Manager",
      province: "Groningen",
      hourlyRate: 90,
    };
    const overBudget = {
      ...baseCandidate,
      skills: [],
      role: "Manager",
      province: "Groningen",
      hourlyRate: 200,
    };
    const s1 = computeMatchScore(baseJob as any, withinBudget as any);
    const s2 = computeMatchScore(baseJob as any, overBudget as any);
    expect(s1.score).toBeGreaterThan(s2.score);
  });

  it("gives partial rate points when slightly over budget", () => {
    const slightlyOver = {
      ...baseCandidate,
      skills: [],
      role: "Manager",
      province: "Groningen",
      hourlyRate: 105, // 5% over 100 max
    };
    const wayOver = {
      ...baseCandidate,
      skills: [],
      role: "Manager",
      province: "Groningen",
      hourlyRate: 200,
    };
    const s1 = computeMatchScore(baseJob as any, slightlyOver as any);
    const s2 = computeMatchScore(baseJob as any, wayOver as any);
    expect(s1.score).toBeGreaterThan(s2.score);
  });

  it("awards role alignment points", () => {
    const matchingRole = {
      ...baseCandidate,
      skills: [],
      province: "Groningen",
      hourlyRate: null,
      role: "Java Developer",
    };
    const nonMatchingRole = {
      ...baseCandidate,
      skills: [],
      province: "Groningen",
      hourlyRate: null,
      role: "Marketing Manager",
    };
    const s1 = computeMatchScore(baseJob as any, matchingRole as any);
    const s2 = computeMatchScore(baseJob as any, nonMatchingRole as any);
    expect(s1.score).toBeGreaterThan(s2.score);
  });

  it("handles null/undefined fields gracefully", () => {
    const minimal = { id: "cand-3", name: "Test" };
    const minimalJob = {
      id: "job-2",
      title: "Test Job",
      platform: "test",
      externalId: "T-1",
    };
    const result = computeMatchScore(minimalJob as any, minimal as any);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.reasoning).toBeTruthy();
  });

  it("caps confidence at 100", () => {
    const result = computeMatchScore(baseJob as any, baseCandidate as any);
    expect(result.confidence).toBeLessThanOrEqual(100);
  });
});

describe("Phase 15 — extractKeywords", () => {
  it("extracts from competences", () => {
    const job = { competences: ["Java", "Docker"] } as any;
    const kw = extractKeywords(job);
    expect(kw).toContain("Java");
    expect(kw).toContain("Docker");
  });

  it("extracts from requirements descriptions", () => {
    const job = {
      requirements: [{ description: "Spring Boot microservices" }],
      competences: [],
    } as any;
    const kw = extractKeywords(job);
    expect(kw.some((k: string) => k.toLowerCase().includes("spring"))).toBe(
      true,
    );
  });

  it("returns empty array for job with no data", () => {
    const kw = extractKeywords({} as any);
    expect(kw).toEqual([]);
  });

  it("deduplicates keywords", () => {
    const job = {
      competences: ["Java", "Java"],
      requirements: [{ description: "Java ervaring" }],
    } as any;
    const kw = extractKeywords(job);
    const javaCount = kw.filter(
      (k: string) => k.toLowerCase() === "java",
    ).length;
    expect(javaCount).toBe(1);
  });
});

// ── Step config export tests ─────────────────────────────────────

describe("Phase 15 — generate-matches event step config", () => {
  it("exports config and handler", async () => {
    const mod = await import(
      "../steps/jobs/generate-matches.step.js"
    );
    expect(mod.config).toBeDefined();
    expect(mod.config.name).toBe("GenerateMatches");
    expect(mod.handler).toBeDefined();
    expect(typeof mod.handler).toBe("function");
  });

  it("has correct triggers and enqueues", async () => {
    const { config } = await import(
      "../steps/jobs/generate-matches.step.js"
    );
    expect(config.triggers).toHaveLength(1);
    expect(config.triggers[0].type).toBe("queue");
    expect(config.triggers[0].topic).toBe("matches.generate");
    expect(config.enqueues).toContainEqual({ topic: "matches.completed" });
  });
});

describe("Phase 15 — generate-matches API step config", () => {
  it("exports config and handler", async () => {
    const mod = await import(
      "../steps/api/generate-matches.step.js"
    );
    expect(mod.config).toBeDefined();
    expect(mod.config.name).toBe("TriggerGenerateMatches");
    expect(mod.handler).toBeDefined();
    expect(typeof mod.handler).toBe("function");
  });

  it("has correct HTTP trigger", async () => {
    const { config } = await import(
      "../steps/api/generate-matches.step.js"
    );
    expect(config.triggers).toHaveLength(1);
    expect(config.triggers[0].type).toBe("http");
    expect(config.triggers[0].method).toBe("POST");
    expect(config.triggers[0].path).toBe("/api/matches/genereren");
  });

  it("enqueues matches.generate", async () => {
    const { config } = await import(
      "../steps/api/generate-matches.step.js"
    );
    expect(config.enqueues).toContainEqual({ topic: "matches.generate" });
  });
});

// ── Candidates service: listActiveCandidates ─────────────────────

describe("Phase 15 — candidates service: listActiveCandidates", () => {
  it("is exported as a function", async () => {
    const { listActiveCandidates } = await import(
      "../src/services/candidates.js"
    );
    expect(typeof listActiveCandidates).toBe("function");
  });
});

// ── Candidates service: getCandidatesByIds ───────────────────────

describe("Phase 15 — candidates service: getCandidatesByIds", () => {
  it("is exported as a function", async () => {
    const { getCandidatesByIds } = await import(
      "../src/services/candidates.js"
    );
    expect(typeof getCandidatesByIds).toBe("function");
  });
});
