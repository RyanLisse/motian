import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");
function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("Match detail UI component", () => {
  it("exports MatchDetail component", () => {
    const source = readFile("components/matching/match-detail.tsx");
    expect(source).toContain("export function MatchDetail");
  });

  it("displays knock-out criteria with pass/fail icons", () => {
    const source = readFile("components/matching/match-detail.tsx");
    expect(source).toContain("CheckCircle2");
    expect(source).toContain("XCircle");
    expect(source).toContain("knockout");
  });

  it("displays gunningscriteria with star ratings", () => {
    const source = readFile("components/matching/match-detail.tsx");
    expect(source).toContain("Star");
    expect(source).toContain("gunning");
  });

  it("shows risk profile section", () => {
    const source = readFile("components/matching/match-detail.tsx");
    expect(source).toContain("Risicoprofiel");
    expect(source).toContain("AlertTriangle");
  });

  it("shows enrichment suggestions", () => {
    const source = readFile("components/matching/match-detail.tsx");
    expect(source).toContain("Aanbevelingen");
    expect(source).toContain("Lightbulb");
  });

  it("uses Dutch recommendation labels", () => {
    const source = readFile("components/matching/match-detail.tsx");
    expect(source).toContain("Doorgaan");
    expect(source).toContain("Niet doorgaan");
    expect(source).toContain("Voorwaardelijk");
  });
});

describe("Candidate detail integration", () => {
  it("renders the shared match detail and report surfaces inside the matches section", () => {
    const source = readFile("app/kandidaten/[id]/page.tsx");
    expect(source).toContain("MatchDetail");
    expect(source).toContain("ReportButton");
    expect(source).toContain('<section id="matches">');
    expect(source).toContain("criteriaBreakdown");
  });
});
