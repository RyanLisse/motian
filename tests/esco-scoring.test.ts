import { describe, expect, it } from "vitest";

import type { CandidateSkill, JobSkill } from "../src/services/skills.js";
import { computeSkillScore } from "../src/services/skills-scoring.js";

const jobSkill = (
  slug: string,
  opts: { importance?: "must" | "nice"; label?: string } = {},
): JobSkill => ({
  skillId: slug,
  slug,
  escoUri: slug,
  label: opts.label ?? slug,
  confidence: 1,
  required: (opts.importance ?? "must") === "must",
  critical: (opts.importance ?? "must") === "must",
  weight: (opts.importance ?? "must") === "must" ? 1 : 0.6,
  importance: opts.importance ?? "must",
});

const candidateSkill = (slug: string): CandidateSkill => ({
  skillId: slug,
  slug,
  escoUri: slug,
  label: slug,
  confidence: 1,
  critical: false,
});

describe("computeSkillScore", () => {
  it("returns score 0 when job skills are empty", () => {
    const result = computeSkillScore([candidateSkill("react")], []);
    expect(result.skillScore).toBe(0);
    expect(result.guardrailFallback).toBe(false);
    expect(result.reasoning).toContain("Geen skills opgegeven voor vacature");
  });

  it("returns score 0 when candidate skills are empty", () => {
    const result = computeSkillScore([], [jobSkill("react")]);
    expect(result.skillScore).toBe(0);
    expect(result.guardrailFallback).toBe(false);
    expect(result.reasoning).toContain("0 van 1 vereiste skills matchen");
  });

  it("returns positive score when candidate skill IDs match job skill IDs", () => {
    const result = computeSkillScore(
      [candidateSkill("react")],
      [jobSkill("react", { label: "React" })],
    );
    expect(result.skillScore).toBeGreaterThan(0);
    expect(result.guardrailFallback).toBe(false);
    expect(result.reasoning).toMatch(/vereiste skills matchen/i);
  });

  it("penalizes missing must-have skills while still counting nice-to-have overlap", () => {
    const result = computeSkillScore(
      [candidateSkill("typescript")],
      [jobSkill("react", { label: "React" }), jobSkill("typescript", { importance: "nice" })],
    );
    expect(result.skillScore).toBeLessThan(SKILL_MATCH_MAX);
    expect(result.guardrailFallback).toBe(false);
    expect(result.reasoning).toContain("ontbreekt: React");
  });
});

const SKILL_MATCH_MAX = 50;
