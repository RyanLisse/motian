import { describe, expect, it } from "vitest";
import type { Candidate } from "../src/services/candidates";
import { buildCandidateEmbeddingText, buildJobEmbeddingText } from "../src/services/embedding.js";

import type { Job } from "../src/services/jobs";
import { computeMatchScore } from "../src/services/scoring.js";

// ── Hybrid Scoring Integration Tests ─────────────────────────────

describe("Hybrid scoring — rule + vector blend", () => {
  const job: Partial<Job> = {
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
    embedding: null as number[] | null,
  };

  const candidate: Partial<Candidate> = {
    id: "cand-1",
    name: "Lisa Jansen",
    role: "React Developer",
    location: "Amsterdam - Noord-Holland",
    province: "Noord-Holland",
    skills: ["React", "TypeScript", "CSS"],
    hourlyRate: 95,
    embedding: null as number[] | null,
  };

  it("uses rule-based-v1 model when no embeddings present", () => {
    const result = computeMatchScore(job as unknown as Job, candidate as unknown as Candidate);
    expect(result.model).toBe("rule-based-v1");
  });

  it("uses hybrid-v1 model when both embeddings present", () => {
    // Create fake 512-dim embeddings — similar direction
    const embedding = Array.from({ length: 512 }, (_, i) => Math.sin(i * 0.01));
    const jobWithEmb = { ...job, embedding };
    const candWithEmb = { ...candidate, embedding: embedding.map((v) => v + 0.05) };

    const result = computeMatchScore(
      jobWithEmb as unknown as Job,
      candWithEmb as unknown as Candidate,
    );
    expect(result.model).toBe("hybrid-v1");
    expect(result.reasoning).toContain("Semantische match");
  });

  it("falls back to rule-based when only job has embedding", () => {
    const embedding = Array.from({ length: 512 }, () => Math.random());
    const jobWithEmb = { ...job, embedding };

    const result = computeMatchScore(
      jobWithEmb as unknown as Job,
      candidate as unknown as Candidate,
    );
    expect(result.model).toBe("rule-based-v1");
  });

  it("hybrid score is bounded 0-100", () => {
    const embedding = Array.from({ length: 512 }, () => 1.0);
    const jobWithEmb = { ...job, embedding };
    const candWithEmb = { ...candidate, embedding };

    const result = computeMatchScore(
      jobWithEmb as unknown as Job,
      candWithEmb as unknown as Candidate,
    );
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.confidence).toBeLessThanOrEqual(100);
  });

  it("uses esco-rule-v1 when canonical skills are provided without embeddings", () => {
    const result = computeMatchScore(job as unknown as Job, candidate as unknown as Candidate, {
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

    expect(result.model).toBe("esco-rule-v1");
    expect(result.reasoning).toContain("ESCO");
  });

  it("falls back to legacy scoring when a critical canonical skill has low confidence", () => {
    const result = computeMatchScore(job as unknown as Job, candidate as unknown as Candidate, {
      candidateEscoSkills: [
        {
          escoUri: "skill:react",
          label: "React",
          confidence: 0.95,
          critical: false,
        },
      ],
      jobEscoSkills: [
        {
          escoUri: "skill:react",
          label: "React",
          confidence: 0.2,
          required: true,
          critical: true,
          weight: 1,
        },
      ],
    });

    expect(result.model).toBe("rule-based-v1");
    expect(result.reasoning).toContain("skills match");
  });
});

// ── Embedding Text Builder Tests ─────────────────────────────────

describe("buildJobEmbeddingText", () => {
  it("includes title and description summary", () => {
    const text = buildJobEmbeddingText({
      title: "Data Engineer",
      descriptionSummary: { nl: "Data pipeline bouwen", en: "Build data pipeline" },
      categories: ["ICT", "Data & Analytics"],
      requirements: [{ description: "Python Spark ervaring" }],
    });

    expect(text).toContain("Data Engineer");
    expect(text).toContain("Data pipeline bouwen");
    expect(text).toContain("Build data pipeline");
    expect(text).toContain("Categorieën: ICT, Data & Analytics");
    expect(text).toContain("Python Spark ervaring");
  });

  it("handles missing optional fields", () => {
    const text = buildJobEmbeddingText({
      title: "Tester",
      descriptionSummary: null,
      categories: [],
      requirements: [],
    });

    expect(text).toBe("Tester");
  });
});

describe("buildCandidateEmbeddingText", () => {
  it("includes role, skills, experience, and location", () => {
    const text = buildCandidateEmbeddingText({
      name: "Jan",
      role: "Python Developer",
      skills: ["Python", "Django", "PostgreSQL"],
      experience: [{ title: "Backend Developer at Acme" }],
      location: "Utrecht",
    });

    expect(text).toContain("Python Developer");
    expect(text).toContain("Skills: Python, Django, PostgreSQL");
    expect(text).toContain("Backend Developer at Acme");
    expect(text).toContain("Utrecht");
  });

  it("returns minimal text for candidate with no data", () => {
    const text = buildCandidateEmbeddingText({
      name: "Empty",
      role: null,
      skills: [],
      experience: [],
      location: null,
    });

    expect(text).toBe("");
  });

  it("handles experience as strings", () => {
    const text = buildCandidateEmbeddingText({
      name: "Jan",
      role: null,
      skills: [],
      experience: ["5 jaar Python development"],
      location: null,
    });

    expect(text).toContain("5 jaar Python development");
  });
});

// ── Normalize Contract Tests ─────────────────────────────────────

describe("Job schema validation", () => {
  it("validates a complete job listing", async () => {
    const { unifiedJobSchema } = await import("../src/schemas/job.js");

    const validJob = {
      externalId: "EXT-123",
      externalUrl: "https://example.com/job/123",
      title: "DevOps Engineer",
      company: "Rabobank",
      location: "Utrecht - Utrecht",
      description: "Een ervaren DevOps engineer gezocht voor cloud migratie",
      rateMax: 110,
      requirements: [{ description: "Kubernetes ervaring", isKnockout: true }],
      competences: ["Kubernetes", "Terraform", "AWS"],
    };

    const result = unifiedJobSchema.safeParse(validJob);
    expect(result.success).toBe(true);
  });

  it("rejects a job without required fields", async () => {
    const { unifiedJobSchema } = await import("../src/schemas/job.js");

    const invalidJob = { company: "Test" };
    const result = unifiedJobSchema.safeParse(invalidJob);
    expect(result.success).toBe(false);
  });

  it("rejects invalid URL format", async () => {
    const { unifiedJobSchema } = await import("../src/schemas/job.js");

    const badUrl = {
      externalId: "EXT-1",
      externalUrl: "not-a-url",
      title: "Test",
    };
    const result = unifiedJobSchema.safeParse(badUrl);
    expect(result.success).toBe(false);
  });
});
