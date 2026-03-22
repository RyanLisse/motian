import { db, desc, eq } from "@/src/db";
import { jobMatches, jobs } from "@/src/db/schema";
import type { CriterionResult, StructuredMatchOutput } from "@/src/schemas/matching";
import type { AutoMatchResult } from "@/src/services/auto-matching";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  const matches: AutoMatchResult[] = rows.map((row) => {
    const hasStructured = row.criteriaBreakdown && Array.isArray(row.criteriaBreakdown);

    const structuredResult: StructuredMatchOutput | null = hasStructured
      ? {
          criteriaBreakdown: row.criteriaBreakdown as StructuredMatchOutput["criteriaBreakdown"],
          overallScore: row.matchScore,
          knockoutsPassed: (row.criteriaBreakdown as CriterionResult[])
            .filter((c) => c.tier === "knockout")
            .every((c) => c.passed === true),
          riskProfile: (row.riskProfile as string[]) ?? [],
          enrichmentSuggestions: (row.enrichmentSuggestions as string[]) ?? [],
          recommendation: (row.recommendation as "go" | "no-go" | "conditional") ?? "conditional",
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
