import { desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { jobs, scrapeResults } from "../db/schema";

// ========== Types ==========

export type ScrapeResult = typeof scrapeResults.$inferSelect;

export type GetHistoryOptions = {
  platform?: string;
  limit?: number;
};

export type PlatformStats = {
  platform: string;
  totalRuns: number;
  successCount: number;
  failedCount: number;
  successRate: number;
  totalJobsFound: number;
  totalJobsNew: number;
  totalDuplicates: number;
  avgDurationMs: number;
};

export type ScrapeAnalytics = {
  totalRuns: number;
  totalJobsFound: number;
  totalJobsNew: number;
  totalDuplicates: number;
  totalUniqueJobs: number;
  overallSuccessRate: number;
  avgDurationMs: number;
  byPlatform: PlatformStats[];
};

// ========== Service Functions ==========

/** Scrape resultaten ophalen, optioneel gefilterd op platform en gelimiteerd */
export async function getHistory(opts: GetHistoryOptions = {}): Promise<ScrapeResult[]> {
  const limit = Math.min(opts.limit ?? 50, 100);

  const baseQuery = db.select().from(scrapeResults);
  const filtered = opts.platform
    ? baseQuery.where(eq(scrapeResults.platform, opts.platform))
    : baseQuery;

  return filtered.orderBy(desc(scrapeResults.runAt)).limit(limit);
}

/** Bereken analytics per platform over alle scrape resultaten */
export async function getAnalytics(): Promise<ScrapeAnalytics> {
  const [rows, uniqueJobsResult] = await Promise.all([
    db
      .select({
        platform: scrapeResults.platform,
        totalRuns: sql<number>`count(*)::int`,
        successCount: sql<number>`count(*) filter (where ${scrapeResults.status} = 'success')::int`,
        failedCount: sql<number>`count(*) filter (where ${scrapeResults.status} = 'failed')::int`,
        totalJobsFound: sql<number>`coalesce(sum(${scrapeResults.jobsFound}), 0)::int`,
        totalJobsNew: sql<number>`coalesce(sum(${scrapeResults.jobsNew}), 0)::int`,
        totalDuplicates: sql<number>`coalesce(sum(${scrapeResults.duplicates}), 0)::int`,
        avgDurationMs: sql<number>`coalesce(avg(${scrapeResults.durationMs}), 0)::int`,
      })
      .from(scrapeResults)
      .groupBy(scrapeResults.platform),
    db.select({ count: sql<number>`count(*)::int` }).from(jobs).where(isNull(jobs.deletedAt)),
  ]);

  const byPlatform: PlatformStats[] = rows.map((r) => ({
    ...r,
    successRate: r.totalRuns > 0 ? Math.round((r.successCount / r.totalRuns) * 100) : 0,
  }));

  const totalRuns = byPlatform.reduce((s, p) => s + p.totalRuns, 0);
  const totalSuccess = byPlatform.reduce((s, p) => s + p.successCount, 0);

  return {
    totalRuns,
    totalJobsFound: byPlatform.reduce((s, p) => s + p.totalJobsFound, 0),
    totalJobsNew: byPlatform.reduce((s, p) => s + p.totalJobsNew, 0),
    totalDuplicates: byPlatform.reduce((s, p) => s + p.totalDuplicates, 0),
    totalUniqueJobs: uniqueJobsResult[0]?.count ?? 0,
    overallSuccessRate: totalRuns > 0 ? Math.round((totalSuccess / totalRuns) * 100) : 0,
    avgDurationMs:
      byPlatform.length > 0
        ? Math.round(byPlatform.reduce((s, p) => s + p.avgDurationMs, 0) / byPlatform.length)
        : 0,
    byPlatform,
  };
}
