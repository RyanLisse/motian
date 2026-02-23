import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { CriterionResult } from "../src/schemas/matching";
import { generateReport } from "../src/services/report-generator";

const ROOT = path.resolve(__dirname, "..");
function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

// ---------------------------------------------------------------------------
// Sample input matching the ReportInput interface (no email, no phone)
// ---------------------------------------------------------------------------
const sampleCriteria: CriterionResult[] = [
  {
    criterion: "5+ jaar TypeScript ervaring",
    tier: "knockout",
    passed: true,
    stars: null,
    evidence: "6 jaar TypeScript vermeld in CV",
    confidence: "high",
  },
  {
    criterion: "Kennis van React",
    tier: "gunning",
    passed: null,
    stars: 4,
    evidence: "Meerdere React-projecten in portfolio",
    confidence: "high",
  },
  {
    criterion: "Beschikbaar per 1 maart",
    tier: "process",
    passed: null,
    stars: null,
    evidence: "Kandidaat geeft aan per 1 maart beschikbaar te zijn",
    confidence: "medium",
  },
];

const sampleInput = {
  candidate: {
    name: "Jan de Vries",
    role: "Senior Developer",
    location: "Amsterdam",
  },
  job: {
    title: "Lead Engineer",
    company: "Acme BV",
    location: "Utrecht",
  },
  match: {
    criteriaBreakdown: sampleCriteria,
    overallScore: 82,
    knockoutsPassed: true,
    riskProfile: ["Beperkte beschikbaarheid in zomervakantie"],
    enrichmentSuggestions: ["Vraag naar ervaring met CI/CD pipelines"],
    recommendation: "go" as const,
    recommendationReasoning:
      "Kandidaat voldoet aan alle knock-out eisen en scoort goed op gunningscriteria.",
    recommendationConfidence: 85,
  },
};

// ---------------------------------------------------------------------------
// GDPR compliance — generated report output
// ---------------------------------------------------------------------------
describe("GDPR compliance — generated report output", () => {
  it("generated report contains AVG notice text", () => {
    const report = generateReport(sampleInput);
    expect(report).toContain("AVG");
  });

  it("generated report does not contain email addresses", () => {
    const report = generateReport(sampleInput);
    // Regex: anything@anything.tld
    expect(report).not.toMatch(/\S+@\S+\.\S+/);
  });

  it("generated report does not contain Dutch mobile phone patterns (06)", () => {
    const report = generateReport(sampleInput);
    expect(report).not.toMatch(/06[-\s]?\d{8}/);
  });

  it("generated report does not contain international Dutch phone prefix (+31)", () => {
    const report = generateReport(sampleInput);
    expect(report).not.toMatch(/\+31/);
  });
});

// ---------------------------------------------------------------------------
// GDPR compliance — ReportInput interface source comment
// ---------------------------------------------------------------------------
describe("GDPR compliance — ReportInput interface source annotations", () => {
  it("ReportInput interface comment explicitly excludes email and phone for GDPR", () => {
    const source = readFile("src/services/report-generator.ts");
    // The interface must carry an explicit GDPR exclusion comment
    expect(source).toContain("Exclude email, phone for GDPR");
  });
});

// ---------------------------------------------------------------------------
// Report section completeness — generated report output
// ---------------------------------------------------------------------------
describe("Report section completeness — generated output", () => {
  it("generated report contains Knock-out section header", () => {
    const report = generateReport(sampleInput);
    expect(report).toContain("Knock-out");
  });

  it("generated report contains Gunningscriteria section", () => {
    const report = generateReport(sampleInput);
    expect(report).toContain("Gunningscriteria");
  });

  it("generated report contains Risicoprofiel section", () => {
    const report = generateReport(sampleInput);
    expect(report).toContain("Risicoprofiel");
  });

  it("generated report contains Aanbevelingen section", () => {
    const report = generateReport(sampleInput);
    expect(report).toContain("Aanbevelingen");
  });

  it("generated report contains star characters", () => {
    const report = generateReport(sampleInput);
    // Both filled star (★ U+2605) and empty star (☆ U+2606) are used
    expect(report).toMatch(/[\u2605\u2606]/);
  });
});

// ---------------------------------------------------------------------------
// Integration assertions — import paths in source files
// ---------------------------------------------------------------------------
describe("Integration assertions — import paths", () => {
  it("reports/route.ts imports generateReport from @/src/services/report-generator", () => {
    const source = readFile("app/api/reports/route.ts");
    expect(source).toContain("@/src/services/report-generator");
  });

  it("reports/route.ts imports publishReport from @/src/lib/markdown-fast", () => {
    const source = readFile("app/api/reports/route.ts");
    expect(source).toContain("@/src/lib/markdown-fast");
    expect(source).toContain("publishReport");
  });

  it("reports/[id]/page.tsx imports getReport from @/src/lib/markdown-fast", () => {
    const source = readFile("app/reports/[id]/page.tsx");
    expect(source).toContain("@/src/lib/markdown-fast");
    expect(source).toContain("getReport");
  });
});
