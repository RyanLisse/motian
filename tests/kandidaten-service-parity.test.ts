import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]) {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("kandidaten shared service wiring", () => {
  it("routes the kandidaten page through shared candidate services", () => {
    const source = readFile("app", "kandidaten", "page.tsx");

    expect(source).toContain(
      'import { countCandidates, listCandidates, searchCandidates } from "@/src/services/candidates";',
    );
    expect(source).toContain(
      "useSearch ? searchCandidates(searchOptions) : listCandidates({ limit, offset })",
    );
    expect(source).toContain("useSearch");
    expect(source).toContain("countCandidates({");
  });

  it("queues candidate embedding sync instead of awaiting it inline", () => {
    const source = readFile("src", "services", "candidates.ts");

    expect(source).not.toContain("setTimeout");
    expect(source).not.toContain("runCandidateDerivedSync");
    expect(source).toContain("void queueDeferredEmbeddingSync({");
    expect(source).toContain('entityType: "candidate"');
  });
});
