import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("ESCO ingestion wiring", () => {
  it("syncs canonical candidate skills on candidate service writes", () => {
    const source = readFile("src", "services", "candidates.ts");

    expect(source).toContain("syncCandidateEscoSkills");
    expect(source).toContain("await syncCandidateEscoSkills({");
  });

  it("syncs canonical job skills after normalization upserts", () => {
    const source = readFile("src", "services", "normalize.ts");

    expect(source).toContain("syncJobEscoSkills");
    expect(source).toContain("await syncJobEscoSkills({");
  });
});
