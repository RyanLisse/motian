import { describe, expect, it } from "vitest";
import {
  computeGradeBuckets,
  computeGradeFromParsed,
  extractRadarData,
} from "@/src/lib/grading-utils";
import type { CriterionResult } from "@/src/schemas/matching";

describe("computeGradeBuckets", () => {
  it("categorizes scores into correct buckets", () => {
    const result = computeGradeBuckets([95, 85, 75, 65, 55]);
    expect(result).toEqual({ excellent: 1, strong: 1, good: 1, below: 2 });
  });

  it("returns all zeros for empty scores", () => {
    expect(computeGradeBuckets([])).toEqual({ excellent: 0, strong: 0, good: 0, below: 0 });
  });

  it("handles boundary scores correctly", () => {
    const result = computeGradeBuckets([90, 80, 70, 69]);
    expect(result).toEqual({ excellent: 1, strong: 1, good: 1, below: 1 });
  });

  it("handles all excellent scores", () => {
    expect(computeGradeBuckets([100, 95, 91])).toEqual({
      excellent: 3,
      strong: 0,
      good: 0,
      below: 0,
    });
  });
});

describe("extractRadarData", () => {
  it("returns default zeros for null breakdown", () => {
    const result = extractRadarData(null);
    expect(result).toHaveLength(5);
    expect(result.every((r) => r.value === 0)).toBe(true);
  });

  it("returns default zeros for empty breakdown", () => {
    const result = extractRadarData([]);
    expect(result).toHaveLength(5);
    expect(result.every((r) => r.value === 0)).toBe(true);
  });

  it("computes radar values from criteria with stars", () => {
    const breakdown: CriterionResult[] = [
      {
        criterion: "test",
        tier: "knockout",
        passed: true,
        stars: 4,
        evidence: "ev",
        confidence: "high",
      },
      {
        criterion: "test",
        tier: "gunning",
        passed: null,
        stars: 3,
        evidence: "ev",
        confidence: "medium",
      },
      {
        criterion: "test",
        tier: "gunning",
        passed: null,
        stars: 5,
        evidence: "ev",
        confidence: "high",
      },
      {
        criterion: "test",
        tier: "process",
        passed: true,
        stars: 2,
        evidence: "ev",
        confidence: "low",
      },
    ];
    const result = extractRadarData(breakdown);
    expect(result).toHaveLength(5);
    expect(result[0].subject).toBe("Skill Match");
    expect(result[2].subject).toBe("Ervaring");
  });

  it("computes radar values from criteria without stars using pass rate", () => {
    const breakdown: CriterionResult[] = [
      {
        criterion: "test",
        tier: "knockout",
        passed: true,
        stars: null,
        evidence: "ev",
        confidence: "high",
      },
      {
        criterion: "test",
        tier: "knockout",
        passed: false,
        stars: null,
        evidence: "ev",
        confidence: "high",
      },
      {
        criterion: "test",
        tier: "gunning",
        passed: null,
        stars: null,
        evidence: "ev",
        confidence: "medium",
      },
    ];
    const result = extractRadarData(breakdown);
    expect(result).toHaveLength(5);
  });
});

describe("computeGradeFromParsed", () => {
  it("returns Beperkt profiel for empty parsed CV", () => {
    const result = computeGradeFromParsed({});
    expect(result.label).toBe("Beperkt profiel");
    expect(result.score).toBe(20);
  });

  it("returns Sterk profiel for a rich CV", () => {
    const result = computeGradeFromParsed({
      skills: {
        hard: Array(10).fill({ name: "TypeScript" }),
        soft: Array(5).fill({ name: "Communication" }),
      },
      experience: Array(5).fill({ title: "Developer" }),
      education: Array(3).fill({ degree: "MSc" }),
    });
    expect(result.label).toBe("Sterk profiel");
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it("returns Goed profiel for a moderate CV", () => {
    const result = computeGradeFromParsed({
      skills: { hard: Array(5).fill({ name: "skill" }), soft: [] },
      experience: Array(3).fill({}),
      education: Array(1).fill({}),
    });
    expect(["Sterk profiel", "Goed profiel", "Basis profiel"]).toContain(result.label);
  });

  it("caps score at 100", () => {
    const result = computeGradeFromParsed({
      skills: {
        hard: Array(50).fill({ name: "skill" }),
        soft: Array(50).fill({ name: "skill" }),
      },
      experience: Array(20).fill({}),
      education: Array(10).fill({}),
    });
    expect(result.score).toBe(100);
  });
});
