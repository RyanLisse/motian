import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import { candidates, jobMatches, jobs } from "../db/schema";
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

export async function getGradedCandidates(opts?: {
  jobId?: string;
  limit?: number;
}): Promise<GradedCandidate[]> {
  const limit = opts?.limit ?? 50;

  const whereConditions = opts?.jobId
    ? and(isNull(candidates.deletedAt), eq(jobMatches.jobId, opts.jobId))
    : isNull(candidates.deletedAt);

  const rows = await db
    .select({
      matchId: jobMatches.id,
      matchScore: jobMatches.matchScore,
      confidence: jobMatches.confidence,
      reasoning: jobMatches.reasoning,
      criteriaBreakdown: jobMatches.criteriaBreakdown,
      enrichmentSuggestions: jobMatches.enrichmentSuggestions,
      recommendation: jobMatches.recommendation,
      candidateId: candidates.id,
      candidateName: candidates.name,
      candidateRole: candidates.role,
      candidateSkills: candidates.skills,
      candidateSkillsStructured: candidates.skillsStructured,
      jobId: jobs.id,
      jobTitle: jobs.title,
      jobCompany: jobs.company,
    })
    .from(jobMatches)
    .innerJoin(candidates, eq(jobMatches.candidateId, candidates.id))
    .leftJoin(jobs, eq(jobMatches.jobId, jobs.id))
    .where(whereConditions)
    .orderBy(desc(jobMatches.matchScore))
    .limit(limit);

  return rows.map((r) => ({
    ...r,
    criteriaBreakdown: r.criteriaBreakdown as CriterionResult[] | null,
    enrichmentSuggestions: r.enrichmentSuggestions as string[] | null,
    recommendation: r.recommendation as string | null,
  }));
}

/** Compute grade bucket counts from scores */
export function computeGradeBuckets(scores: number[]) {
  return {
    excellent: scores.filter((s) => s >= 90).length,
    strong: scores.filter((s) => s >= 80 && s < 90).length,
    good: scores.filter((s) => s >= 70 && s < 80).length,
    below: scores.filter((s) => s < 70).length,
  };
}

/** Extract radar chart data from criteria breakdown */
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

  // Map criteria to 5 radar axes based on tier and content
  const knockoutCriteria = breakdown.filter((c) => c.tier === "knockout");
  const gunningCriteria = breakdown.filter((c) => c.tier === "gunning");
  const processCriteria = breakdown.filter((c) => c.tier === "process");

  function avgStars(criteria: CriterionResult[]): number {
    const withStars = criteria.filter((c) => c.stars != null);
    if (withStars.length === 0) {
      // For knockout: convert pass/fail to a score
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
