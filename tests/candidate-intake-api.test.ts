import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("candidate intake and matching inbox API routes", () => {
  it("manual intake route delegates to intakeCandidate", () => {
    const source = readFile("app/api/kandidaten/intake/route.ts");
    expect(source).toContain("intakeCandidate");
    expect(source).toContain("existingCandidateId");
    expect(source).toContain("/matching");
  });

  it("manual intake route preserves 404 for missing existing candidates", () => {
    const source = readFile("app/api/kandidaten/intake/route.ts");
    expect(source).toContain("getCandidateById");
    expect(source).toContain("Kandidaat niet gevonden");
  });

  it("candidate rematch route requests top 5 results and marks in review", () => {
    const source = readFile("app/api/kandidaten/[id]/match/route.ts");
    expect(source).toContain("reviewCandidateMatches");
    expect(source).toContain("topN: 5");
    expect(source).toContain('matchingStatus: "in_review"');
  });

  it("no-match route marks the candidate as no_match", () => {
    const source = readFile("app/api/kandidaten/[id]/geen-match/route.ts");
    expect(source).toContain('updateCandidateMatchingStatus(id, "no_match")');
    expect(source).toContain("matchingStatus");
  });

  it("candidate listing route supports matching inbox filters", () => {
    const source = readFile("app/api/kandidaten/route.ts");
    expect(source).toContain("matchingStatus");
    expect(source).toContain("listMatchingInboxCandidates");
    expect(source).toContain("countMatchingInboxCandidates");
  });
});
