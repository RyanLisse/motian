import { describe, expect, it } from "vitest";

import type { CandidateCanonicalSkill, JobCanonicalSkill } from "../src/services/esco.js";
import { computeEscoSkillScore } from "../src/services/esco-scoring.js";

const jobSkill = (
  uri: string,
  opts: { critical?: boolean; required?: boolean; weight?: number; label?: string } = {},
): JobCanonicalSkill => ({
  escoUri: uri,
  label: opts.label ?? null,
  confidence: 0.9,
  required: opts.required ?? true,
  critical: opts.critical ?? false,
  weight: opts.weight ?? 1,
});

const candidateSkill = (uri: string, confidence = 0.9): CandidateCanonicalSkill => ({
  escoUri: uri,
  label: null,
  confidence,
  critical: false,
});

describe("computeEscoSkillScore", () => {
  it("returns score 0 and guardrailFallback false when job skills are empty", () => {
    const result = computeEscoSkillScore(
      [candidateSkill("http://data.europa.eu/esco/skill/react")],
      [],
    );
    expect(result.skillScore).toBe(0);
    expect(result.guardrailFallback).toBe(false);
    expect(result.reasoning).toContain("Geen ESCO-vaardigheden voor opdracht");
  });

  it("returns score 0 and guardrailFallback true when candidate skills are empty", () => {
    const result = computeEscoSkillScore([], [jobSkill("http://data.europa.eu/esco/skill/react")]);
    expect(result.skillScore).toBe(0);
    expect(result.guardrailFallback).toBe(true);
    expect(result.reasoning).toMatch(/kandidaat|fallback|legacy/i);
  });

  it("returns positive score when candidate URIs match job skill URIs", () => {
    const uri = "http://data.europa.eu/esco/skill/react";
    const result = computeEscoSkillScore(
      [candidateSkill(uri)],
      [jobSkill(uri, { label: "React" })],
    );
    expect(result.skillScore).toBeGreaterThan(0);
    expect(result.guardrailFallback).toBe(false);
    expect(result.reasoning).toMatch(/match|ESCO/i);
  });

  it("returns score 0 and guardrailFallback true when critical job skill has no candidate match", () => {
    const jobUri = "http://data.europa.eu/esco/skill/critical-skill";
    const otherUri = "http://data.europa.eu/esco/skill/other";
    const result = computeEscoSkillScore(
      [candidateSkill(otherUri)],
      [jobSkill(jobUri, { critical: true, label: "CriticalSkill" }), jobSkill(otherUri)],
    );
    expect(result.skillScore).toBe(0);
    expect(result.guardrailFallback).toBe(true);
    expect(result.reasoning).toMatch(/kritieke|ontbrekende|guardrail/i);
  });
});
