import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { structuredMatchOutputSchema } from "../src/schemas/matching.js";

const ROOT = path.resolve(__dirname, "..");
function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("Structured matching service", () => {
  it("exports runStructuredMatch function", () => {
    const source = readFile("src/services/structured-matching.ts");
    expect(source).toContain("export async function runStructuredMatch");
  });

  it("uses Gemini 3.1 Pro model", () => {
    const source = readFile("src/services/structured-matching.ts");
    expect(source).toContain("gemini-3.1-pro");
  });

  it("uses generateObject with structuredMatchOutputSchema", () => {
    const source = readFile("src/services/structured-matching.ts");
    expect(source).toContain("generateObject");
    expect(source).toContain("structuredMatchOutputSchema");
  });

  it("contains Mariënne methodology system prompt", () => {
    const source = readFile("src/services/structured-matching.ts");
    expect(source).toContain("KNOCK-OUT");
    expect(source).toContain("GUNNINGSCRITERIA");
    expect(source).toContain("PROCESEISEN");
  });

  it("uses withRetry for resilience", () => {
    const source = readFile("src/services/structured-matching.ts");
    expect(source).toContain("withRetry");
  });

  it("structuredMatchOutputSchema validates a well-formed object", () => {
    const sample = {
      criteriaBreakdown: [
        {
          criterion: "Minimaal 5 jaar projectmanagement ervaring",
          tier: "knockout",
          passed: true,
          stars: null,
          evidence: "12 jaar ervaring bij Heijmans als senior projectmanager",
          confidence: "high",
        },
        {
          criterion: "Kennis van Prince2 methodologie",
          tier: "gunning",
          passed: null,
          stars: 4,
          evidence: "Prince2 Practitioner gecertificeerd sinds 2018",
          confidence: "high",
        },
      ],
      overallScore: 78,
      knockoutsPassed: true,
      riskProfile: ["Geen SAP ervaring gevonden"],
      enrichmentSuggestions: ["SAP basis-certificering zou match versterken"],
      recommendation: "go",
      recommendationReasoning:
        "Kandidaat voldoet aan alle knock-outs en scoort goed op gunningscriteria.",
      recommendationConfidence: 82,
    };
    const result = structuredMatchOutputSchema.safeParse(sample);
    expect(result.success).toBe(true);
  });
});
