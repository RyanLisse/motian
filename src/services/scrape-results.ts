import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { jobs, scrapeResults } from "../db/schema";

type ScrapeResultsReader = Pick<typeof db, "select">;

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

const scrapeResultColumns = {
  id: scrapeResults.id,
  configId: scrapeResults.configId,
  platform: scrapeResults.platform,
  runAt: scrapeResults.runAt,
  durationMs: scrapeResults.durationMs,
  jobsFound: scrapeResults.jobsFound,
  jobsNew: scrapeResults.jobsNew,
  duplicates: scrapeResults.duplicates,
  status: scrapeResults.status,
  errors: scrapeResults.errors,
  jobIds: scrapeResults.jobIds,
} as const;

/** Eén scrape-run ophalen op id */
export async function getRunById(id: string): Promise<ScrapeResult | null> {
  const rows = await db
    .select(scrapeResultColumns)
    .from(scrapeResults)
    .where(eq(scrapeResults.id, id))
    .limit(1);
  return (rows[0] ?? null) as ScrapeResult | null;
}

/** Jobs ophalen die bij een run horen (summary: id, title, company, etc.; full: inclusief rawPayload) */
export async function getJobsForRun(
  jobIds: string[] | unknown[] | null,
  opts: { includeRawPayload?: boolean } = {},
): Promise<
  Array<{
    id: string;
    title: string;
    company: string | null;
    externalId: string;
    externalUrl: string | null;
    location: string | null;
    rawPayload?: Record<string, unknown> | null;
  }>
> {
  const ids = Array.isArray(jobIds)
    ? jobIds.reduce<string[]>((accumulator, id) => {
        if (typeof id === "string") {
          accumulator.push(id);
        }
        return accumulator;
      }, [])
    : [];
  if (ids.length === 0) return [];
  const baseCols = {
    id: jobs.id,
    title: jobs.title,
    company: jobs.company,
    externalId: jobs.externalId,
    externalUrl: jobs.externalUrl,
    location: jobs.location,
  };
  const rows = opts.includeRawPayload
    ? await db
        .select({ ...baseCols, rawPayload: jobs.rawPayload })
        .from(jobs)
        .where(inArray(jobs.id, ids))
    : await db.select(baseCols).from(jobs).where(inArray(jobs.id, ids));
  return rows as Array<{
    id: string;
    title: string;
    company: string | null;
    externalId: string;
    externalUrl: string | null;
    location: string | null;
    rawPayload?: Record<string, unknown> | null;
  }>;
}

/** Scrape resultaten ophalen, optioneel gefilterd op platform en gelimiteerd */
export async function getHistory(opts: GetHistoryOptions = {}): Promise<ScrapeResult[]> {
  const limit = Math.min(opts.limit ?? 50, 100);

  const baseQuery = db.select(scrapeResultColumns).from(scrapeResults);
  const filtered = opts.platform
    ? baseQuery.where(eq(scrapeResults.platform, opts.platform))
    : baseQuery;

  return filtered.orderBy(desc(scrapeResults.runAt)).limit(limit);
}

/** Bereken analytics per platform over alle scrape resultaten */
export async function getAnalytics(database: ScrapeResultsReader = db): Promise<ScrapeAnalytics> {
  const [rows, uniqueJobsResult, overallDuration] = await Promise.all([
    database
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
      .groupBy(scrapeResults.platform),
    database.select({ count: sql<number>`count(*)::int` }).from(jobs),
    database
      .select({
        avgMs: sql<number>`(coalesce(round(avg(${scrapeResults.durationMs})), 0))::int`,
      })
      .from(scrapeResults),
  ]);

  const totalUniqueJobs = uniqueJobsResult?.[0]?.count ?? 0;
  const overallAvgDurationMs = overallDuration?.[0]?.avgMs ?? 0;

  const byPlatform: PlatformStats[] = rows.map((r) => {
    const statusSum = r.successCount + r.partialCount + r.failedCount;
    if (statusSum !== r.totalRuns) {
      console.warn(
        `[scrape-results] Platform ${r.platform}: success+partial+failed (${statusSum}) !== totalRuns (${r.totalRuns})`,
      );
    }
    return {
      ...r,
      successRate:
        r.totalRuns > 0 ? Math.round(((r.successCount + r.partialCount) / r.totalRuns) * 100) : 0,
    };
  });

  const totalRuns = byPlatform.reduce((s, p) => s + p.totalRuns, 0);
  const totalNotFailed = byPlatform.reduce((s, p) => s + p.successCount + p.partialCount, 0);

  return {
    totalRuns,
    totalJobsFound: byPlatform.reduce((s, p) => s + p.totalJobsFound, 0),
    totalJobsNew: byPlatform.reduce((s, p) => s + p.totalJobsNew, 0),
    totalDuplicates: byPlatform.reduce((s, p) => s + p.totalDuplicates, 0),
    totalUniqueJobs,
    overallSuccessRate: totalRuns > 0 ? Math.round((totalNotFailed / totalRuns) * 100) : 0,
    avgDurationMs: totalRuns > 0 ? overallAvgDurationMs : 0,
    byPlatform,
  };
}

export async function getTimeSeriesAnalytics(
  opts: GetTimeSeriesOptions = {},
  database: ScrapeResultsReader = db,
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

  const rows = await database
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
