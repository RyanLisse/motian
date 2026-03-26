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

    expect(kandidaatListRoute).toContain("withCandidatesCanonicalSkills");
    expect(kandidaatDetailRoute).toContain("withCandidateCanonicalSkills");
    expect(vacaturesListRoute).toContain("withJobsCanonicalSkills");
    expect(vacaturesDetailRoute).toContain("withJobCanonicalSkills");
  });

  it("includes canonicalSkills in AI, MCP, and voice candidate/job outputs", () => {
    const aiKandidaten = readFile("src", "ai", "tools", "kandidaten.ts");
    const aiOpdrachten = readFile("src", "ai", "tools", "query-opdrachten.ts");
    const aiOpdrachtDetail = readFile("src", "ai", "tools", "get-opdracht-detail.ts");
    const mcpKandidaten = readFile("src", "mcp", "tools", "kandidaten.ts");
    const mcpVacatures = readFile("src", "mcp", "tools", "vacatures.ts");
    const voiceAgent = readFile("src", "voice-agent", "agent.ts");

    expect(aiKandidaten).toContain("withCandidateCanonicalSkills");
    expect(aiOpdrachten).toContain("withJobsCanonicalSkills");
    expect(aiOpdrachtDetail).toContain("withJobCanonicalSkills");
    expect(mcpKandidaten).toContain("withCandidateCanonicalSkills");
    expect(mcpVacatures).toContain("withJobCanonicalSkills");
    expect(voiceAgent).toContain("withCandidateCanonicalSkills");
    expect(voiceAgent).toContain("withJobCanonicalSkills");
  });
});
