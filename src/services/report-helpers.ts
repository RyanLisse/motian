import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { candidates, jobMatches, jobs } from "@/src/db/schema";
import type { CriterionResult } from "@/src/schemas/matching";
import { generateReport } from "@/src/services/report-generator";

export type MatchReportRow = {
  match: typeof jobMatches.$inferSelect;
  job: {
    title: string;
    company: string | null;
    location: string | null;
  } | null;
  candidate: {
    name: string;
    role: string | null;
    location: string | null;
  } | null;
};

export type FetchMatchReportResult =
  | { ok: true; markdown: string; row: MatchReportRow }
  | { ok: false; status: 404 | 422; body: { error: string } };

/**
 * Load match with job and candidate, build report markdown. Shared by GET and POST /api/reports.
 */
export async function fetchMatchReport(matchId: string): Promise<FetchMatchReportResult> {
  const rows = await db
    .select({
      match: jobMatches,
      job: {
        title: jobs.title,
        company: jobs.company,
        location: jobs.location,
      },
      candidate: {
        name: candidates.name,
        role: candidates.role,
        location: candidates.location,
      },
    })
    .from(jobMatches)
    .leftJoin(jobs, eq(jobMatches.jobId, jobs.id))
    .leftJoin(candidates, eq(jobMatches.candidateId, candidates.id))
    .where(eq(jobMatches.id, matchId))
    .limit(1);

  const row = rows[0] as MatchReportRow | undefined;
  if (!row) {
    return { ok: false, status: 404, body: { error: "Match niet gevonden" } };
  }
  if (!row.candidate || !row.job) {
    return {
      ok: false,
      status: 422,
      body: { error: "Kandidaat of opdracht niet meer beschikbaar" },
    };
  }

  const criteriaBreakdown = (row.match.criteriaBreakdown as CriterionResult[]) ?? [];
  const riskProfile = (row.match.riskProfile as string[]) ?? [];
  const enrichmentSuggestions = (row.match.enrichmentSuggestions as string[]) ?? [];

  const markdown = generateReport({
    candidate: {
      name: row.candidate.name,
      role: row.candidate.role,
      location: row.candidate.location,
    },
    job: {
      title: row.job.title,
      company: row.job.company,
      location: row.job.location,
    },
    match: {
      criteriaBreakdown,
      overallScore: row.match.matchScore,
      knockoutsPassed: !riskProfile.some((r) => r.toLowerCase().includes("knock")),
      riskProfile,
      enrichmentSuggestions,
      recommendation: (row.match.recommendation as string) ?? "conditional",
      recommendationReasoning: row.match.reasoning ?? "",
      recommendationConfidence: (row.match.recommendationConfidence as number) ?? 0,
    },
  });

  return { ok: true, markdown, row };
}
