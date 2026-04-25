import { unstable_cache } from "next/cache";
import { and, db, isNull, ne, sql } from "@/src/db";
import { candidates, jobs } from "@/src/db/schema";

export type EnrichmentStatus = {
  jobs: {
    missingSummary: number;
    missingEmbedding: number;
    total: number;
  };
  candidates: {
    missingEmbedding: number;
    total: number;
  };
  timestamp: string;
};

/**
 * Compute live enrichment debt counts (missing description summaries and
 * missing pgvector embeddings) for jobs and candidates. Used by
 * `/api/enrichment-status` and the future 7-day delta dashboard to verify
 * that the `embeddings-batch` and `ai-enrichment-batch` crons are draining
 * the backlog over time.
 *
 * Soft-delete and archive filtering matches `app/overzicht/data.ts` so the
 * counts here line up with the pipeline-health snapshot rendered on the
 * overview page.
 */
async function getEnrichmentStatusUncached(database: typeof db = db): Promise<EnrichmentStatus> {
  const visibleJobsCondition = and(ne(jobs.status, "archived"), isNull(jobs.deletedAt));
  const visibleCandidatesCondition = isNull(candidates.deletedAt);

  const [
    jobsTotalResult,
    jobsMissingSummaryResult,
    jobsMissingEmbeddingResult,
    candidatesTotalResult,
    candidatesMissingEmbeddingResult,
  ] = await Promise.all([
    database
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(jobs)
      .where(visibleJobsCondition),
    database
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(jobs)
      .where(and(visibleJobsCondition, sql`${jobs.descriptionSummary} is null`)),
    database
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(jobs)
      .where(and(visibleJobsCondition, sql`${jobs.embedding} is null`)),
    database
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(candidates)
      .where(visibleCandidatesCondition),
    database
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(candidates)
      .where(and(visibleCandidatesCondition, sql`${candidates.embedding} is null`)),
  ]);

  return {
    jobs: {
      missingSummary: jobsMissingSummaryResult[0]?.count ?? 0,
      missingEmbedding: jobsMissingEmbeddingResult[0]?.count ?? 0,
      total: jobsTotalResult[0]?.count ?? 0,
    },
    candidates: {
      missingEmbedding: candidatesMissingEmbeddingResult[0]?.count ?? 0,
      total: candidatesTotalResult[0]?.count ?? 0,
    },
    timestamp: new Date().toISOString(),
  };
}

const getCachedEnrichmentStatus = unstable_cache(
  async () => getEnrichmentStatusUncached(db),
  ["enrichment-status", "v1"],
  { revalidate: 300, tags: ["jobs", "candidates"] },
);

export async function getEnrichmentStatus(database: typeof db = db): Promise<EnrichmentStatus> {
  if (database === db) {
    return getCachedEnrichmentStatus();
  }
  return getEnrichmentStatusUncached(database);
}
