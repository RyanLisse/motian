import { and, db, desc, eq, isNull } from "../db";
import { candidates, jobMatches, jobs } from "../db/schema";
import type { GradedCandidate } from "../lib/grading-utils";
import type { CriterionResult } from "../schemas/matching";

export type { GradedCandidate } from "../lib/grading-utils";

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
