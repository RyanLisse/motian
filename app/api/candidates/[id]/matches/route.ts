import { db, desc, eq } from "@/src/db";
import { jobMatches, jobs } from "@/src/db/schema";
import type { StructuredMatchOutput } from "@/src/schemas/matching";
import type { AutoMatchResult } from "@/src/services/auto-matching";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type MatchRow = {
  matchId: string;
  jobId: string | null;
  matchScore: number;
  reasoning: string | null;
  criteriaBreakdown: unknown;
  riskProfile: unknown;
  enrichmentSuggestions: unknown;
  recommendation: string | null;
  recommendationConfidence: number | null;
  jobTitle: string;
  company: string | null;
  location: string | null;
};

type MatchCriterion = {
  tier: string;
  passed: boolean;
};

/** GET /api/candidates/[id]/matches — fetch persisted match results */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return Response.json({ error: "Ongeldig ID" }, { status: 400 });
  }

  const rows = await db
    .select({
      matchId: jobMatches.id,
      jobId: jobMatches.jobId,
      matchScore: jobMatches.matchScore,
      confidence: jobMatches.confidence,
      reasoning: jobMatches.reasoning,
      criteriaBreakdown: jobMatches.criteriaBreakdown,
      riskProfile: jobMatches.riskProfile,
      enrichmentSuggestions: jobMatches.enrichmentSuggestions,
      recommendation: jobMatches.recommendation,
      recommendationConfidence: jobMatches.recommendationConfidence,
      jobTitle: jobs.title,
      company: jobs.company,
      location: jobs.location,
    })
    .from(jobMatches)
    .innerJoin(jobs, eq(jobs.id, jobMatches.jobId))
    .where(eq(jobMatches.candidateId, id))
    .orderBy(desc(jobMatches.matchScore));

  const matches: AutoMatchResult[] = rows.map((row: MatchRow) => {
    const criteriaBreakdown = Array.isArray(row.criteriaBreakdown)
      ? (row.criteriaBreakdown as StructuredMatchOutput["criteriaBreakdown"])
      : null;

    const knockoutsPassed = criteriaBreakdown
      ? (criteriaBreakdown as MatchCriterion[])
          .filter((criterion) => criterion.tier === "knockout")
          .every((criterion) => criterion.passed === true)
      : false;

    const structuredResult: StructuredMatchOutput | null = criteriaBreakdown
      ? {
          criteriaBreakdown,
          overallScore: row.matchScore,
          knockoutsPassed,
          riskProfile: Array.isArray(row.riskProfile) ? (row.riskProfile as string[]) : [],
          enrichmentSuggestions: Array.isArray(row.enrichmentSuggestions)
            ? (row.enrichmentSuggestions as string[])
            : [],
          recommendation:
            row.recommendation === "go" ||
            row.recommendation === "no-go" ||
            row.recommendation === "conditional"
              ? row.recommendation
              : "conditional",
          recommendationReasoning: row.reasoning ?? "",
          recommendationConfidence: row.recommendationConfidence ?? 0,
        }
      : null;

    return {
      jobId: row.jobId ?? "",
      jobTitle: row.jobTitle,
      company: row.company,
      location: row.location,
      candidateId: id,
      candidateName: "",
      quickScore: row.matchScore,
      structuredResult,
      judgeVerdict: null,
      matchId: row.matchId,
      matchSaveError: false,
    };
  });

  return Response.json(matches);
}
