import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]) {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("kandidaten shared service wiring", () => {
  it("routes the kandidaten page through shared candidate services", () => {
    const pageSource = readFile("app", "kandidaten", "page.tsx");
    const dataSource = readFile("app", "kandidaten", "data.ts");

    expect(pageSource).toContain('import { loadKandidatenPageData } from "./data"');
    expect(pageSource).toContain("await loadKandidatenPageData({");
    expect(dataSource).toContain(
      'import {\n  type Candidate,\n  countCandidates,\n  listCandidates,\n  searchCandidates,\n} from "@/src/services/candidates"',
    );
    expect(dataSource).toContain("deps.searchCandidates(searchOptions)");
    expect(dataSource).toContain("deps.listCandidates({ limit, offset })");
    expect(dataSource).toContain("deps.countCandidates({");
  });

  it("queues candidate embedding sync instead of awaiting it inline", () => {
    const source = readFile("src", "services", "candidates.ts");

    expect(source).not.toContain("setTimeout");
    expect(source).not.toContain("runCandidateDerivedSync");
    expect(source).toContain("void queueDeferredEmbeddingSync({");
    expect(source).toContain('entityType: "candidate"');
  });
});
