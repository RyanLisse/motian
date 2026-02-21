import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");

// ===== Embedding Service =====

describe("embedding service exports", () => {
  it("exports generateEmbedding", async () => {
    const mod = await import("../src/services/embeddings.js");
    expect(typeof mod.generateEmbedding).toBe("function");
  });

  it("exports cosineSimilarity", async () => {
    const mod = await import("../src/services/embeddings.js");
    expect(typeof mod.cosineSimilarity).toBe("function");
  });

  it("exports serializeEmbedding / deserializeEmbedding", async () => {
    const mod = await import("../src/services/embeddings.js");
    expect(typeof mod.serializeEmbedding).toBe("function");
    expect(typeof mod.deserializeEmbedding).toBe("function");
  });

  it("exports buildJobEmbeddingText", async () => {
    const mod = await import("../src/services/embeddings.js");
    expect(typeof mod.buildJobEmbeddingText).toBe("function");
  });

  it("exports buildCandidateEmbeddingText", async () => {
    const mod = await import("../src/services/embeddings.js");
    expect(typeof mod.buildCandidateEmbeddingText).toBe("function");
  });

  it("exports findSimilarJobs", async () => {
    const mod = await import("../src/services/embeddings.js");
    expect(typeof mod.findSimilarJobs).toBe("function");
  });

  it("exports findSimilarCandidates", async () => {
    const mod = await import("../src/services/embeddings.js");
    expect(typeof mod.findSimilarCandidates).toBe("function");
  });
});

// ===== Cosine Similarity Math =====

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", async () => {
    const { cosineSimilarity } = await import("../src/services/embeddings.js");
    const vec = [1, 2, 3, 4, 5];
    expect(cosineSimilarity(vec, vec)).toBeCloseTo(1.0, 5);
  });

  it("returns 0 for orthogonal vectors", async () => {
    const { cosineSimilarity } = await import("../src/services/embeddings.js");
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0.0, 5);
  });

  it("returns -1 for opposite vectors", async () => {
    const { cosineSimilarity } = await import("../src/services/embeddings.js");
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1.0, 5);
  });

  it("returns 0 for empty vectors", async () => {
    const { cosineSimilarity } = await import("../src/services/embeddings.js");
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it("returns 0 for mismatched lengths", async () => {
    const { cosineSimilarity } = await import("../src/services/embeddings.js");
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  it("handles zero vectors gracefully", async () => {
    const { cosineSimilarity } = await import("../src/services/embeddings.js");
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
  });
});

// ===== Serialization =====

describe("embedding serialization", () => {
  it("round-trips a vector", async () => {
    const { serializeEmbedding, deserializeEmbedding } = await import(
      "../src/services/embeddings.js"
    );
    const vec = [0.1, 0.2, 0.3, -0.5, 0.999];
    const serialized = serializeEmbedding(vec);
    const deserialized = deserializeEmbedding(serialized);
    expect(deserialized).toEqual(vec);
  });

  it("serializes to valid JSON string", async () => {
    const { serializeEmbedding } = await import("../src/services/embeddings.js");
    const result = serializeEmbedding([1, 2, 3]);
    expect(() => JSON.parse(result)).not.toThrow();
  });
});

// ===== Text Building =====

describe("buildJobEmbeddingText", () => {
  it("includes title at minimum", async () => {
    const { buildJobEmbeddingText } = await import(
      "../src/services/embeddings.js"
    );
    const text = buildJobEmbeddingText({ title: "Java Developer" });
    expect(text).toContain("Java Developer");
  });

  it("includes all provided fields", async () => {
    const { buildJobEmbeddingText } = await import(
      "../src/services/embeddings.js"
    );
    const text = buildJobEmbeddingText({
      title: "Senior Developer",
      company: "Motian",
      location: "Utrecht",
      description: "Building great things",
      requirements: [{ description: "5 jaar ervaring" }],
      competences: ["Teamwork", "Communicatie"],
    });
    expect(text).toContain("Motian");
    expect(text).toContain("Utrecht");
    expect(text).toContain("Building great things");
    expect(text).toContain("5 jaar ervaring");
    expect(text).toContain("Teamwork");
  });
});

describe("buildCandidateEmbeddingText", () => {
  it("includes role and skills", async () => {
    const { buildCandidateEmbeddingText } = await import(
      "../src/services/embeddings.js"
    );
    const text = buildCandidateEmbeddingText({
      name: "Jan",
      role: "Backend Developer",
      skills: ["Java", "Spring Boot"],
      location: "Amsterdam",
    });
    expect(text).toContain("Backend Developer");
    expect(text).toContain("Java");
    expect(text).toContain("Amsterdam");
  });

  it("handles empty optional fields gracefully", async () => {
    const { buildCandidateEmbeddingText } = await import(
      "../src/services/embeddings.js"
    );
    const text = buildCandidateEmbeddingText({ name: "Test" });
    // Should not throw, returns empty or minimal string
    expect(typeof text).toBe("string");
  });
});

// ===== Motia Step Configs =====

describe("EmbedJobs step config", () => {
  it("exists as a step file", () => {
    expect(existsSync(join(ROOT, "steps/jobs/embed-jobs.step.ts"))).toBe(true);
  });

  it("has correct trigger topic", async () => {
    const { config } = await import("../steps/jobs/embed-jobs.step.js");
    expect(config.name).toBe("EmbedJobs");
    expect(config.triggers[0].topic).toBe("scrape.completed");
    expect(config.triggers[0].type).toBe("queue");
  });

  it("enqueues to jobs.embedded", async () => {
    const { config } = await import("../steps/jobs/embed-jobs.step.js");
    expect(config.enqueues).toContainEqual({ topic: "jobs.embedded" });
  });

  it("is in recruitment-scraper flow", async () => {
    const { config } = await import("../steps/jobs/embed-jobs.step.js");
    expect(config.flows).toContain("recruitment-scraper");
  });

  it("exports a handler function", async () => {
    const { handler } = await import("../steps/jobs/embed-jobs.step.js");
    expect(typeof handler).toBe("function");
  });
});

describe("EmbedCandidate step config", () => {
  it("exists as a step file", () => {
    expect(existsSync(join(ROOT, "steps/candidates/embed-candidate.step.ts"))).toBe(true);
  });

  it("has correct trigger topic", async () => {
    const { config } = await import("../steps/candidates/embed-candidate.step.js");
    expect(config.name).toBe("EmbedCandidate");
    expect(config.triggers[0].topic).toBe("candidate.created");
    expect(config.triggers[0].type).toBe("queue");
  });

  it("enqueues to candidate.embedded", async () => {
    const { config } = await import("../steps/candidates/embed-candidate.step.js");
    expect(config.enqueues).toContainEqual({ topic: "candidate.embedded" });
  });

  it("is in recruitment-matching flow", async () => {
    const { config } = await import("../steps/candidates/embed-candidate.step.js");
    expect(config.flows).toContain("recruitment-matching");
  });
});

describe("RetrieveMatches step config", () => {
  it("exists as a step file", () => {
    expect(existsSync(join(ROOT, "steps/matching/retrieve-matches.step.ts"))).toBe(true);
  });

  it("has correct trigger topic", async () => {
    const { config } = await import("../steps/matching/retrieve-matches.step.js");
    expect(config.name).toBe("RetrieveMatches");
    expect(config.triggers[0].topic).toBe("match.request");
    expect(config.triggers[0].type).toBe("queue");
  });

  it("enqueues to match.grade", async () => {
    const { config } = await import("../steps/matching/retrieve-matches.step.js");
    expect(config.enqueues).toContainEqual({ topic: "match.grade" });
  });

  it("is in recruitment-matching flow", async () => {
    const { config } = await import("../steps/matching/retrieve-matches.step.js");
    expect(config.flows).toContain("recruitment-matching");
  });
});

describe("GradeJob step config", () => {
  it("exists as a step file", () => {
    expect(existsSync(join(ROOT, "steps/matching/grade-job.step.ts"))).toBe(true);
  });

  it("has correct trigger topic", async () => {
    const { config } = await import("../steps/matching/grade-job.step.js");
    expect(config.name).toBe("GradeJob");
    expect(config.triggers[0].topic).toBe("match.grade");
    expect(config.triggers[0].type).toBe("queue");
  });

  it("enqueues to match.completed", async () => {
    const { config } = await import("../steps/matching/grade-job.step.js");
    expect(config.enqueues).toContainEqual({ topic: "match.completed" });
  });

  it("is in recruitment-matching flow", async () => {
    const { config } = await import("../steps/matching/grade-job.step.js");
    expect(config.flows).toContain("recruitment-matching");
  });
});

// ===== Pipeline Flow Topology =====

describe("pipeline flow topology", () => {
  it("scrape → embed → retrieve → grade → complete chain is valid", async () => {
    const embed = (await import("../steps/jobs/embed-jobs.step.js")).config;
    const retrieve = (await import("../steps/matching/retrieve-matches.step.js")).config;
    const grade = (await import("../steps/matching/grade-job.step.js")).config;

    // embed listens to scrape.completed, emits jobs.embedded
    expect(embed.triggers[0].topic).toBe("scrape.completed");
    expect(embed.enqueues[0].topic).toBe("jobs.embedded");

    // retrieve listens to match.request, emits match.grade
    expect(retrieve.triggers[0].topic).toBe("match.request");
    expect(retrieve.enqueues[0].topic).toBe("match.grade");

    // grade listens to match.grade (what retrieve emits), emits match.completed
    expect(grade.triggers[0].topic).toBe("match.grade");
    expect(grade.enqueues[0].topic).toBe("match.completed");
  });

  it("candidate embed listens to candidate.created", async () => {
    const { config } = await import("../steps/candidates/embed-candidate.step.js");
    expect(config.triggers[0].topic).toBe("candidate.created");
    expect(config.enqueues[0].topic).toBe("candidate.embedded");
  });
});

// ===== API Routes =====

describe("match API endpoints", () => {
  it("GET /api/matches route exists", () => {
    expect(existsSync(join(ROOT, "app/api/matches/route.ts"))).toBe(true);
  });

  it("PATCH /api/matches/[id]/approve route exists", () => {
    expect(existsSync(join(ROOT, "app/api/matches/[id]/approve/route.ts"))).toBe(true);
  });

  it("PATCH /api/matches/[id]/reject route exists", () => {
    expect(existsSync(join(ROOT, "app/api/matches/[id]/reject/route.ts"))).toBe(true);
  });

  it("GET /api/candidates route exists", () => {
    expect(existsSync(join(ROOT, "app/api/candidates/route.ts"))).toBe(true);
  });

  it("matches route exports GET and POST handlers", async () => {
    const content = readFileSync(
      join(ROOT, "app/api/matches/route.ts"),
      "utf-8",
    );
    expect(content).toContain("export async function GET");
    expect(content).toContain("export async function POST");
  });

  it("approve route exports PATCH handler", async () => {
    const content = readFileSync(
      join(ROOT, "app/api/matches/[id]/approve/route.ts"),
      "utf-8",
    );
    expect(content).toContain("export async function PATCH");
  });
});

// ===== UI Integration =====

describe("UI wired to database", () => {
  it("matching page fetches from /api/matches", () => {
    const content = readFileSync(
      join(ROOT, "app/matching/page.tsx"),
      "utf-8",
    );
    expect(content).toContain("/api/matches");
  });

  it("professionals page fetches from /api/candidates", () => {
    const content = readFileSync(
      join(ROOT, "app/professionals/page.tsx"),
      "utf-8",
    );
    expect(content).toContain("/api/candidates");
  });

  it("matching page has approve/reject functionality", () => {
    const content = readFileSync(
      join(ROOT, "app/matching/page.tsx"),
      "utf-8",
    );
    expect(content).toContain("approve");
    expect(content).toContain("reject");
  });
});
