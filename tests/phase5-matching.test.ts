import { describe, it, expect } from "vitest";

// ===== Phase 5: Database Schema Validation =====

describe("candidates table schema", () => {
  it("exports candidates from schema", async () => {
    const { candidates } = await import("../src/db/schema.js");
    expect(candidates).toBeDefined();
  });

  it("has required columns", async () => {
    const { candidates } = await import("../src/db/schema.js");
    const cols = Object.keys(candidates);
    const required = ["id", "name", "email", "phone", "role", "skills", "experience", "location", "province", "resumeUrl", "embedding", "tags", "gdprConsent", "source", "createdAt", "updatedAt", "deletedAt"];
    for (const col of required) {
      expect(cols).toContain(col);
    }
  });

  it("has soft-delete column", async () => {
    const { candidates } = await import("../src/db/schema.js");
    expect(Object.keys(candidates)).toContain("deletedAt");
  });
});

describe("jobMatches table schema", () => {
  it("exports jobMatches from schema", async () => {
    const { jobMatches } = await import("../src/db/schema.js");
    expect(jobMatches).toBeDefined();
  });

  it("has required columns", async () => {
    const { jobMatches } = await import("../src/db/schema.js");
    const cols = Object.keys(jobMatches);
    const required = ["id", "jobId", "candidateId", "vectorScore", "llmScore", "overallScore", "status", "knockOutPassed", "matchData", "reviewedBy", "reviewedAt", "createdAt"];
    for (const col of required) {
      expect(cols).toContain(col);
    }
  });

  it("has scoring columns for AI matching", async () => {
    const { jobMatches } = await import("../src/db/schema.js");
    const cols = Object.keys(jobMatches);
    expect(cols).toContain("vectorScore");
    expect(cols).toContain("llmScore");
    expect(cols).toContain("overallScore");
  });
});

// ===== Phase 5: Service Layer Contracts =====

describe("candidates service exports", () => {
  it("exports listCandidates", async () => {
    const mod = await import("../src/services/candidates.js");
    expect(typeof mod.listCandidates).toBe("function");
  });

  it("exports getCandidateById", async () => {
    const mod = await import("../src/services/candidates.js");
    expect(typeof mod.getCandidateById).toBe("function");
  });

  it("exports searchCandidates", async () => {
    const mod = await import("../src/services/candidates.js");
    expect(typeof mod.searchCandidates).toBe("function");
  });

  it("exports createCandidate", async () => {
    const mod = await import("../src/services/candidates.js");
    expect(typeof mod.createCandidate).toBe("function");
  });

  it("exports updateCandidate", async () => {
    const mod = await import("../src/services/candidates.js");
    expect(typeof mod.updateCandidate).toBe("function");
  });

  it("exports deleteCandidateWithGdpr", async () => {
    const mod = await import("../src/services/candidates.js");
    expect(typeof mod.deleteCandidateWithGdpr).toBe("function");
  });

  it("exports getCandidateStats", async () => {
    const mod = await import("../src/services/candidates.js");
    expect(typeof mod.getCandidateStats).toBe("function");
  });
});

describe("matches service exports", () => {
  it("exports listMatches", async () => {
    const mod = await import("../src/services/matches.js");
    expect(typeof mod.listMatches).toBe("function");
  });

  it("exports getMatchById", async () => {
    const mod = await import("../src/services/matches.js");
    expect(typeof mod.getMatchById).toBe("function");
  });

  it("exports createMatch", async () => {
    const mod = await import("../src/services/matches.js");
    expect(typeof mod.createMatch).toBe("function");
  });

  it("exports updateMatchStatus", async () => {
    const mod = await import("../src/services/matches.js");
    expect(typeof mod.updateMatchStatus).toBe("function");
  });

  it("exports getMatchStats", async () => {
    const mod = await import("../src/services/matches.js");
    expect(typeof mod.getMatchStats).toBe("function");
  });
});

// ===== Phase 5: Type Contracts =====

describe("type contracts", () => {
  it("CreateMatchData has required fields", async () => {
    // Type-level check: if this compiles, the type contract is satisfied
    const data: import("../src/services/matches.js").CreateMatchData = {
      jobId: "test-job-id",
      candidateId: "test-candidate-id",
    };
    expect(data.jobId).toBe("test-job-id");
    expect(data.candidateId).toBe("test-candidate-id");
  });

  it("CreateMatchData accepts optional scoring fields", async () => {
    const data: import("../src/services/matches.js").CreateMatchData = {
      jobId: "test-job-id",
      candidateId: "test-candidate-id",
      vectorScore: 0.85,
      llmScore: 72,
      overallScore: 78.5,
      knockOutPassed: true,
      matchData: { skills: ["Java", "Spring"] },
    };
    expect(data.overallScore).toBe(78.5);
  });

  it("CreateCandidateData has required name field", async () => {
    const data: import("../src/services/candidates.js").CreateCandidateData = {
      name: "Test Kandidaat",
    };
    expect(data.name).toBe("Test Kandidaat");
  });

  it("CreateCandidateData accepts optional fields", async () => {
    const data: import("../src/services/candidates.js").CreateCandidateData = {
      name: "Test Kandidaat",
      email: "test@example.com",
      role: "Java Developer",
      skills: ["Java", "Spring Boot"],
      location: "Utrecht",
      province: "Utrecht",
      source: "linkedin",
      gdprConsent: true,
    };
    expect(data.skills).toHaveLength(2);
  });
});
