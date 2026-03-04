import { desc, eq, sql } from "drizzle-orm";
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
  partialCount: number;
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

export type TimeSeriesPoint = {
  date: string;
  platform: string;
  jobsFound: number;
  jobsNew: number;
  duplicates: number;
  successCount: number;
  partialCount: number;
  failedCount: number;
  totalRuns: number;
  avgDurationMs: number;
};

export type GetTimeSeriesOptions = {
  startDate?: Date;
  endDate?: Date;
  platform?: string;
  groupBy?: "day" | "week";
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
  const rows = await db
    .select({
      platform: scrapeResults.platform,
      totalRuns: sql<number>`count(*)::int`,
      successCount: sql<number>`count(*) filter (where ${scrapeResults.status} = 'success')::int`,
      partialCount: sql<number>`count(*) filter (where ${scrapeResults.status} = 'partial')::int`,
      failedCount: sql<number>`count(*) filter (where ${scrapeResults.status} = 'failed')::int`,
      totalJobsFound: sql<number>`coalesce(sum(${scrapeResults.jobsFound}), 0)::int`,
      totalJobsNew: sql<number>`coalesce(sum(${scrapeResults.jobsNew}), 0)::int`,
      totalDuplicates: sql<number>`coalesce(sum(${scrapeResults.duplicates}), 0)::int`,
      avgDurationMs: sql<number>`coalesce(avg(${scrapeResults.durationMs}), 0)::int`,
    })
    .from(scrapeResults)
    .groupBy(scrapeResults.platform);

  const [uniqueJobsResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobs)
    .where(sql`${jobs.deletedAt} is null`);

  const totalUniqueJobs = uniqueJobsResult?.count ?? 0;

  const byPlatform: PlatformStats[] = rows.map((r) => ({
    ...r,
    successRate:
      r.totalRuns > 0 ? Math.round(((r.successCount + r.partialCount) / r.totalRuns) * 100) : 0,
  }));

  const totalRuns = byPlatform.reduce((s, p) => s + p.totalRuns, 0);
  const totalNotFailed = byPlatform.reduce((s, p) => s + p.successCount + p.partialCount, 0);

  return {
    totalRuns,
    totalJobsFound: byPlatform.reduce((s, p) => s + p.totalJobsFound, 0),
    totalJobsNew: byPlatform.reduce((s, p) => s + p.totalJobsNew, 0),
    totalDuplicates: byPlatform.reduce((s, p) => s + p.totalDuplicates, 0),
    totalUniqueJobs,
    overallSuccessRate: totalRuns > 0 ? Math.round((totalNotFailed / totalRuns) * 100) : 0,
    avgDurationMs:
      totalRuns > 0
        ? Math.round(byPlatform.reduce((s, p) => s + p.avgDurationMs * p.totalRuns, 0) / totalRuns)
        : 0,
    byPlatform,
  };
}

export async function getTimeSeriesAnalytics(
  opts: GetTimeSeriesOptions = {},
): Promise<TimeSeriesPoint[]> {
  const now = new Date();
  const startDate = opts.startDate ?? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const endDate = opts.endDate ?? now;
  const groupBy = opts.groupBy ?? "day";
  const truncFn = groupBy === "week" ? "week" : "day";

  const conditions = [
    sql`${scrapeResults.runAt} >= ${startDate}`,
    sql`${scrapeResults.runAt} <= ${endDate}`,
  ];

  if (opts.platform) {
    conditions.push(sql`${scrapeResults.platform} = ${opts.platform}`);
  }

  const rows = await db
    .select({
      date: sql<string>`date_trunc('${sql.raw(truncFn)}', ${scrapeResults.runAt})::date::text`,
      platform: scrapeResults.platform,
      jobsFound: sql<number>`coalesce(sum(${scrapeResults.jobsFound}), 0)::int`,
      jobsNew: sql<number>`coalesce(sum(${scrapeResults.jobsNew}), 0)::int`,
      duplicates: sql<number>`coalesce(sum(${scrapeResults.duplicates}), 0)::int`,
      successCount: sql<number>`count(*) filter (where ${scrapeResults.status} = 'success')::int`,
      partialCount: sql<number>`count(*) filter (where ${scrapeResults.status} = 'partial')::int`,
      failedCount: sql<number>`count(*) filter (where ${scrapeResults.status} = 'failed')::int`,
      totalRuns: sql<number>`count(*)::int`,
      avgDurationMs: sql<number>`coalesce(avg(${scrapeResults.durationMs}), 0)::int`,
    })
    .from(scrapeResults)
    .where(sql.join(conditions, sql` and `))
    .groupBy(
      sql`date_trunc('${sql.raw(truncFn)}', ${scrapeResults.runAt})::date`,
      scrapeResults.platform,
    )
    .orderBy(sql`date_trunc('${sql.raw(truncFn)}', ${scrapeResults.runAt})::date`);

  return rows;
}
