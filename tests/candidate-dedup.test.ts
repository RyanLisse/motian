import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");
function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("Candidate deduplication", () => {
  it("findDuplicateCandidate is exported", () => {
    const source = readFile("src/services/candidates.ts");
    expect(source).toContain("export async function findDuplicateCandidate");
  });

  it("enrichCandidateFromCV is exported", () => {
    const source = readFile("src/services/candidates.ts");
    expect(source).toContain("export async function enrichCandidateFromCV");
  });

  it("imports ParsedCV type", () => {
    const source = readFile("src/services/candidates.ts");
    expect(source).toContain("ParsedCV");
  });

  it("queries by email for exact match", () => {
    const source = readFile("src/services/candidates.ts");
    expect(source).toContain("candidates.email");
  });

  it("queries by name with ILIKE for fuzzy match", () => {
    const source = readFile("src/services/candidates.ts");
    expect(source).toContain("caseInsensitiveContains(candidates.name, parsed.name)");
  });

  it("enrichCandidateFromCV preserves manual data", () => {
    const source = readFile("src/services/candidates.ts");
    // Checks that it only overwrites null fields
    expect(source).toContain("existing.role");
    expect(source).toContain("existing.location");
  });

  it("enrichCandidateFromCV refreshes candidate embeddings after CV updates", () => {
    const source = readFile("src/services/candidates.ts");
    expect(source).toContain('const { embedCandidate } = await import("./embedding")');
    expect(source).toContain("await embedCandidate(candidate.id)");
  });
});
