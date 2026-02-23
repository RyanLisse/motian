import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  criterionResultSchema,
  structuredMatchOutputSchema,
  tierSchema,
} from "../src/schemas/matching.js";

const ROOT = path.resolve(__dirname, "..");
function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

// ============================================================
// Schema column completeness — jobMatches table in schema.ts
// ============================================================
describe("jobMatches schema columns", () => {
  it("has criteriaBreakdown column", () => {
    const source = readFile("src/db/schema.ts");
    expect(source).toContain("criteriaBreakdown");
  });

  it("has riskProfile column", () => {
    const source = readFile("src/db/schema.ts");
    expect(source).toContain("riskProfile");
  });

  it("has recommendation column", () => {
    const source = readFile("src/db/schema.ts");
    expect(source).toContain("recommendation");
  });

  it("has assessmentModel column", () => {
    const source = readFile("src/db/schema.ts");
    expect(source).toContain("assessmentModel");
  });

  it("has recommendationConfidence column", () => {
    const source = readFile("src/db/schema.ts");
    expect(source).toContain("recommendationConfidence");
  });

  it("has enrichmentSuggestions column", () => {
    const source = readFile("src/db/schema.ts");
    expect(source).toContain("enrichmentSuggestions");
  });
});

// ============================================================
// tierSchema — accepted and rejected values
// ============================================================
describe("tierSchema", () => {
  it("accepts knockout", () => {
    expect(tierSchema.safeParse("knockout").success).toBe(true);
  });

  it("accepts gunning", () => {
    expect(tierSchema.safeParse("gunning").success).toBe(true);
  });

  it("accepts process", () => {
    expect(tierSchema.safeParse("process").success).toBe(true);
  });

  it("rejects an unknown tier value", () => {
    expect(tierSchema.safeParse("unknown").success).toBe(false);
  });

  it("rejects empty string", () => {
    expect(tierSchema.safeParse("").success).toBe(false);
  });
});

// ============================================================
// criterionResultSchema — field-level validation
// ============================================================
describe("criterionResultSchema", () => {
  const base = {
    criterion: "Minimaal 5 jaar ervaring",
    tier: "knockout",
    passed: true,
    stars: null,
    evidence: "Kandidaat heeft 8 jaar ervaring",
    confidence: "high",
  };

  it("validates a well-formed knockout result", () => {
    expect(criterionResultSchema.safeParse(base).success).toBe(true);
  });

  it("validates a gunning result with stars and passed: null", () => {
    const gunning = { ...base, tier: "gunning", passed: null, stars: 4 };
    expect(criterionResultSchema.safeParse(gunning).success).toBe(true);
  });

  it("rejects stars value above 5", () => {
    const invalid = { ...base, tier: "gunning", passed: null, stars: 6 };
    expect(criterionResultSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects stars value below 1 when not null", () => {
    const invalid = { ...base, tier: "gunning", passed: null, stars: 0 };
    expect(criterionResultSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects invalid confidence value", () => {
    const invalid = { ...base, confidence: "very-high" };
    expect(criterionResultSchema.safeParse(invalid).success).toBe(false);
  });

  it("requires criterion field", () => {
    const { criterion: _c, ...without } = base;
    expect(criterionResultSchema.safeParse(without).success).toBe(false);
  });

  it("requires evidence field", () => {
    const { evidence: _e, ...without } = base;
    expect(criterionResultSchema.safeParse(without).success).toBe(false);
  });
});

// ============================================================
// structuredMatchOutputSchema — field presence assertions
// ============================================================
describe("structuredMatchOutputSchema field requirements", () => {
  const validMatch = {
    criteriaBreakdown: [
      {
        criterion: "HBO diploma",
        tier: "knockout",
        passed: true,
        stars: null,
        evidence: "Bachelor informatica",
        confidence: "high",
      },
    ],
    overallScore: 75,
    knockoutsPassed: true,
    riskProfile: [],
    enrichmentSuggestions: [],
    recommendation: "go",
    recommendationReasoning: "Kandidaat voldoet aan alle eisen.",
    recommendationConfidence: 80,
  };

  it("validates complete valid object", () => {
    expect(structuredMatchOutputSchema.safeParse(validMatch).success).toBe(true);
  });

  it("rejects recommendation value outside enum", () => {
    const invalid = { ...validMatch, recommendation: "maybe" };
    expect(structuredMatchOutputSchema.safeParse(invalid).success).toBe(false);
  });

  it("accepts recommendation: no-go", () => {
    const nogo = { ...validMatch, recommendation: "no-go" };
    expect(structuredMatchOutputSchema.safeParse(nogo).success).toBe(true);
  });

  it("accepts recommendation: conditional", () => {
    const cond = { ...validMatch, recommendation: "conditional" };
    expect(structuredMatchOutputSchema.safeParse(cond).success).toBe(true);
  });

  it("rejects overallScore above 100", () => {
    const invalid = { ...validMatch, overallScore: 101 };
    expect(structuredMatchOutputSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects recommendationConfidence above 100", () => {
    const invalid = { ...validMatch, recommendationConfidence: 105 };
    expect(structuredMatchOutputSchema.safeParse(invalid).success).toBe(false);
  });

  it("requires criteriaBreakdown array", () => {
    const { criteriaBreakdown: _cb, ...without } = validMatch;
    expect(structuredMatchOutputSchema.safeParse(without).success).toBe(false);
  });

  it("requires knockoutsPassed boolean", () => {
    const { knockoutsPassed: _kp, ...without } = validMatch;
    expect(structuredMatchOutputSchema.safeParse(without).success).toBe(false);
  });
});

// ============================================================
// Service import assertions
// ============================================================
describe("requirement-extraction.ts imports", () => {
  it("imports classifiedRequirementSchema from matching schemas", () => {
    const source = readFile("src/services/requirement-extraction.ts");
    expect(source).toContain("classifiedRequirementSchema");
    expect(source).toContain("schemas/matching");
  });

  it("imports ClassifiedRequirement type from matching schemas", () => {
    const source = readFile("src/services/requirement-extraction.ts");
    expect(source).toContain("ClassifiedRequirement");
  });
});

describe("structured-matching.ts imports", () => {
  it("imports classifiedRequirementSchema or ClassifiedRequirement from matching schemas", () => {
    const source = readFile("src/services/structured-matching.ts");
    const importsSchema =
      source.includes("classifiedRequirementSchema") || source.includes("ClassifiedRequirement");
    expect(importsSchema).toBe(true);
  });

  it("imports structuredMatchOutputSchema from matching schemas", () => {
    const source = readFile("src/services/structured-matching.ts");
    expect(source).toContain("structuredMatchOutputSchema");
    expect(source).toContain("schemas/matching");
  });
});

// ============================================================
// Pipeline wiring in actions.ts
// ============================================================
describe("actions.ts pipeline wiring", () => {
  it("imports both extractRequirements and runStructuredMatch", () => {
    const source = readFile("app/matching/actions.ts");
    expect(source).toContain("extractRequirements");
    expect(source).toContain("runStructuredMatch");
  });

  it("calls extractRequirements before runStructuredMatch in runStructuredMatchAction", () => {
    const source = readFile("app/matching/actions.ts");
    const extractPos = source.indexOf("extractRequirements");
    const matchPos = source.indexOf("runStructuredMatch");
    expect(extractPos).toBeGreaterThan(-1);
    expect(matchPos).toBeGreaterThan(-1);
    expect(extractPos).toBeLessThan(matchPos);
  });

  it("stores assessmentModel as marienne-v1", () => {
    const source = readFile("app/matching/actions.ts");
    expect(source).toContain('"marienne-v1"');
  });

  it("stores criteriaBreakdown from match result", () => {
    const source = readFile("app/matching/actions.ts");
    expect(source).toContain("criteriaBreakdown");
  });

  it("stores riskProfile from match result", () => {
    const source = readFile("app/matching/actions.ts");
    expect(source).toContain("riskProfile");
  });

  it("stores enrichmentSuggestions from match result", () => {
    const source = readFile("app/matching/actions.ts");
    expect(source).toContain("enrichmentSuggestions");
  });

  it("stores recommendation from match result", () => {
    const source = readFile("app/matching/actions.ts");
    expect(source).toContain("recommendation");
  });

  it("stores recommendationConfidence from match result", () => {
    const source = readFile("app/matching/actions.ts");
    expect(source).toContain("recommendationConfidence");
  });
});

// ============================================================
// match-detail.tsx — all 3 recommendation types handled
// ============================================================
describe("match-detail.tsx recommendation type handling", () => {
  it("handles go recommendation type in recColors", () => {
    const source = readFile("app/matching/match-detail.tsx");
    // go is an unquoted object key in the source
    expect(source).toMatch(/go:\s*["']/);
  });

  it("handles no-go recommendation type in recColors", () => {
    const source = readFile("app/matching/match-detail.tsx");
    expect(source).toContain('"no-go"');
  });

  it("handles conditional recommendation type in recColors", () => {
    const source = readFile("app/matching/match-detail.tsx");
    // conditional is an unquoted object key in the source
    expect(source).toMatch(/conditional:\s*["']/);
  });

  it("maps go to Dutch label Doorgaan", () => {
    const source = readFile("app/matching/match-detail.tsx");
    const goLabelPos = source.indexOf("Doorgaan");
    // go appears as an unquoted key: "go:"
    const goKeyPos = source.indexOf("go:");
    expect(goLabelPos).toBeGreaterThan(-1);
    expect(goKeyPos).toBeGreaterThan(-1);
  });

  it("maps no-go to Dutch label Niet doorgaan", () => {
    const source = readFile("app/matching/match-detail.tsx");
    expect(source).toContain("Niet doorgaan");
  });

  it("maps conditional to Dutch label Voorwaardelijk", () => {
    const source = readFile("app/matching/match-detail.tsx");
    expect(source).toContain("Voorwaardelijk");
  });

  it("renders process tier section (Proceseisen)", () => {
    const source = readFile("app/matching/match-detail.tsx");
    expect(source).toContain("process");
    expect(source).toContain("Proceseisen");
  });
});
