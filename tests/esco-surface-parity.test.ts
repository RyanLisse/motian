import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("ESCO surface parity", () => {
  it("includes canonicalSkills in candidate and job API responses", () => {
    const kandidaatListRoute = readFile("app", "api", "kandidaten", "route.ts");
    const kandidaatDetailRoute = readFile("app", "api", "kandidaten", "[id]", "route.ts");
    const vacaturesListRoute = readFile("app", "api", "vacatures", "route.ts");
    const vacaturesDetailRoute = readFile("app", "api", "vacatures", "[id]", "route.ts");

    expect(kandidaatListRoute).toContain("withCandidatesSkills");
    expect(kandidaatDetailRoute).toContain("withCandidateSkills");
    // RJC-222 moved withJobsSkillsLite enrichment behind the
    // runVacaturesSearchWithSkillsLite helper so the route file no longer
    // imports it directly. Accept either form — the architectural contract
    // (skills-lite enrichment on /api/vacatures responses) is preserved.
    expect(vacaturesListRoute).toMatch(/withJobsSkillsLite|runVacaturesSearchWithSkillsLite/);
    expect(vacaturesDetailRoute).toContain("withJobSkills");
  });

  it("includes canonicalSkills in AI, MCP, and voice candidate/job outputs", () => {
    const aiKandidaten = readFile("src", "ai", "tools", "kandidaten.ts");
    const aiOpdrachten = readFile("src", "ai", "tools", "query-opdrachten.ts");
    const aiOpdrachtDetail = readFile("src", "ai", "tools", "get-opdracht-detail.ts");
    const mcpKandidaten = readFile("src", "mcp", "tools", "kandidaten.ts");
    const mcpVacatures = readFile("src", "mcp", "tools", "vacatures.ts");
    const voiceAgent = readFile("src", "voice-agent", "agent.ts");

    expect(aiKandidaten).toContain("withCandidateSkills");
    expect(aiOpdrachten).toContain("withJobsSkillsLite");
    expect(aiOpdrachtDetail).toContain("withJobSkills");
    expect(mcpKandidaten).toContain("withCandidateSkills");
    expect(mcpVacatures).toContain("withJobsSkillsLite");
    expect(mcpVacatures).toContain("withJobSkills");
    expect(voiceAgent).toContain("withCandidateSkills");
    expect(voiceAgent).toContain("withJobSkills");
    expect(voiceAgent).toContain("withJobsSkillsLite");
  });
});
