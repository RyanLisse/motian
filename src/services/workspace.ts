import { isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { candidates, jobMatches, jobs } from "../db/schema";
import { getHealth } from "./scrapers";

export type WorkspaceSummary = {
  jobs: { total: number; withEmbedding: number };
  candidates: { total: number };
  matches: { total: number; pending: number };
  scraperHealth: {
    overall: string;
    platforms: Array<{ platform: string; status: string; lastRunAt: Date | null }>;
  };
};

/** Lightweight workspace overview for system prompt injection. */
export async function getWorkspaceSummary(): Promise<WorkspaceSummary> {
  const [jobCounts, matchCounts, candidateCount, health] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        withEmbedding: sql<number>`count(embedding)::int`,
      })
      .from(jobs)
      .where(isNull(jobs.deletedAt)),
    db
      .select({
        pending: sql<number>`count(*) filter (where status = 'pending')::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(jobMatches),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(candidates)
      .where(isNull(candidates.deletedAt)),
    getHealth(),
  ]);

  return {
    jobs: { total: jobCounts[0]?.total ?? 0, withEmbedding: jobCounts[0]?.withEmbedding ?? 0 },
    candidates: { total: candidateCount[0]?.total ?? 0 },
    matches: { total: matchCounts[0]?.total ?? 0, pending: matchCounts[0]?.pending ?? 0 },
    scraperHealth: {
      overall: health.overall,
      platforms: health.data.map((h) => ({
        platform: h.platform,
        status: h.status,
        lastRunAt: h.lastRunAt,
      })),
    },
  };
}
