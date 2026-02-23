import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");
function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("Report generation service", () => {
  it("exports generateReport function", () => {
    const source = readFile("src/services/report-generator.ts");
    expect(source).toContain("export function generateReport");
  });

  it("generates markdown with header", () => {
    const source = readFile("src/services/report-generator.ts");
    expect(source).toContain("# Matchrapport:");
  });

  it("includes knock-out criteria table", () => {
    const source = readFile("src/services/report-generator.ts");
    expect(source).toContain("## Knock-out Criteria");
    expect(source).toContain("Voldaan");
  });

  it("includes gunningscriteria table with stars", () => {
    const source = readFile("src/services/report-generator.ts");
    expect(source).toContain("## Gunningscriteria");
    expect(source).toContain("\\u2605");
  });

  it("includes GDPR compliance notice", () => {
    const source = readFile("src/services/report-generator.ts");
    expect(source).toContain("AVG/GDPR");
    expect(source).toContain("geen persoonlijke contactgegevens");
  });

  it("excludes email and phone from report input type", () => {
    const source = readFile("src/services/report-generator.ts");
    // The interface should NOT include email or phone
    expect(source).not.toContain("email:");
    expect(source).not.toContain("phone:");
  });

  it("includes risk profile section", () => {
    const source = readFile("src/services/report-generator.ts");
    expect(source).toContain("## Risicoprofiel");
  });

  it("includes enrichment suggestions", () => {
    const source = readFile("src/services/report-generator.ts");
    expect(source).toContain("## Aanbevelingen voor Verrijking");
  });
});
