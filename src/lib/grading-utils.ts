import type { CriterionResult } from "../schemas/matching";

export type GradedCandidate = {
  matchId: string;
  matchScore: number;
  confidence: number | null;
  reasoning: string | null;
  criteriaBreakdown: CriterionResult[] | null;
  enrichmentSuggestions: string[] | null;
  recommendation: string | null;
  candidateId: string;
  candidateName: string;
  candidateRole: string | null;
  candidateSkills: unknown;
  candidateSkillsStructured: unknown;
  jobId: string | null;
  jobTitle: string | null;
  jobCompany: string | null;
};

export function computeGradeBuckets(scores: number[]) {
  return {
    excellent: scores.filter((s) => s >= 90).length,
    strong: scores.filter((s) => s >= 80 && s < 90).length,
    good: scores.filter((s) => s >= 70 && s < 80).length,
    below: scores.filter((s) => s < 70).length,
  };
}

export function extractRadarData(breakdown: CriterionResult[] | null): {
  subject: string;
  value: number;
}[] {
  if (!breakdown || breakdown.length === 0) {
    return [
      { subject: "Skill Match", value: 0 },
      { subject: "Relevantie", value: 0 },
      { subject: "Ervaring", value: 0 },
      { subject: "Opleiding", value: 0 },
      { subject: "CV Kwaliteit", value: 0 },
    ];
  }

  const knockoutCriteria = breakdown.filter((c) => c.tier === "knockout");
  const gunningCriteria = breakdown.filter((c) => c.tier === "gunning");
  const processCriteria = breakdown.filter((c) => c.tier === "process");

  function avgStars(criteria: CriterionResult[]): number {
    const withStars = criteria.filter((c) => c.stars != null);
    if (withStars.length === 0) {
      const passRate = criteria.filter((c) => c.passed).length / Math.max(1, criteria.length);
      return passRate * 100;
    }
    return (withStars.reduce((sum, c) => sum + (c.stars ?? 0), 0) / withStars.length) * 20;
  }

  return [
    { subject: "Skill Match", value: Math.round(avgStars(gunningCriteria.slice(0, 3))) },
    { subject: "Relevantie", value: Math.round(avgStars(gunningCriteria.slice(3))) },
    { subject: "Ervaring", value: Math.round(avgStars(knockoutCriteria)) },
    { subject: "Opleiding", value: Math.round(avgStars(processCriteria.slice(0, 2))) },
    { subject: "CV Kwaliteit", value: Math.round(avgStars(processCriteria.slice(2))) },
  ];
}

/** Heuristic CV quality score (0-100) and Dutch label for the grading step. */
export function computeGradeFromParsed(parsed: {
  skills?: { hard?: { name: string }[]; soft?: { name: string }[] };
  experience?: unknown[];
  education?: unknown[];
}): { score: number; label: string } {
  const skillCount = (parsed.skills?.hard?.length ?? 0) + (parsed.skills?.soft?.length ?? 0);
  const expCount = Array.isArray(parsed.experience) ? parsed.experience.length : 0;
  const eduCount = Array.isArray(parsed.education) ? parsed.education.length : 0;
  let score = Math.min(
    100,
    20 + skillCount * 3 + Math.min(expCount, 5) * 8 + Math.min(eduCount, 3) * 5,
  );
  score = Math.round(Math.max(0, score));
  if (score >= 80) return { score, label: "Sterk profiel" };
  if (score >= 60) return { score, label: "Goed profiel" };
  if (score >= 40) return { score, label: "Basis profiel" };
  return { score, label: "Beperkt profiel" };
}
