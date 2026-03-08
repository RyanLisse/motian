import { sql } from "drizzle-orm";
import { db } from "../db";
import { jobs } from "../db/schema";
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
  // Single query with scalar subqueries replaces 3 separate count queries (fixes N+1)
  const [allCounts, health] = await Promise.all([
    db
      .select({
        jobsTotal: sql<number>`(select count(*)::int from jobs)`,
        jobsWithEmbedding: sql<number>`(select count(embedding)::int from jobs)`,
        candidatesTotal: sql<number>`(select count(*)::int from candidates where deleted_at is null)`,
        matchesTotal: sql<number>`(select count(*)::int from job_matches)`,
        matchesPending: sql<number>`(select count(*) filter (where status = 'pending')::int from job_matches)`,
      })
      .from(jobs)
      .limit(1),
    getHealth(),
  ]);

  const c = allCounts[0];
  return {
    jobs: { total: c?.jobsTotal ?? 0, withEmbedding: c?.jobsWithEmbedding ?? 0 },
    candidates: { total: c?.candidatesTotal ?? 0 },
    matches: { total: c?.matchesTotal ?? 0, pending: c?.matchesPending ?? 0 },
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
