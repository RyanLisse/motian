import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { db } from "../../db";
import { applications, jobs } from "../../db/schema";

/** Aantal actieve (niet-verwijderde, niet-afgewezen) sollicitaties voor een opdracht. */
export async function getActivePipelineCount(jobId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(applications)
    .where(
      and(
        eq(applications.jobId, jobId),
        isNull(applications.deletedAt),
        ne(applications.stage, "rejected"),
      ),
    );
  return result[0]?.count ?? 0;
}

/** Statistieken: aantal per platform, per provincie, gemiddeld tarief. */
export async function getJobStats(): Promise<{
  total: number;
  byPlatform: Array<{ platform: string; count: number }>;
  byProvince: Array<{ province: string | null; count: number }>;
  avgRateMin: number | null;
  avgRateMax: number | null;
}> {
  const [byPlatformRows, byProvinceRows, aggRow] = await Promise.all([
    db
      .select({
        platform: jobs.platform,
        count: sql<number>`count(*)::int`,
      })
      .from(jobs)
      .groupBy(jobs.platform)
      .orderBy(sql`count(*) desc`),
    db
      .select({
        province: jobs.province,
        count: sql<number>`count(*)::int`,
      })
      .from(jobs)
      .groupBy(jobs.province)
      .orderBy(sql`count(*) desc`)
      .limit(20),
    db
      .select({
        total: sql<number>`count(*)::int`,
        avgRateMin: sql<number | null>`avg(${jobs.rateMin})::float`,
        avgRateMax: sql<number | null>`avg(${jobs.rateMax})::float`,
      })
      .from(jobs),
  ]);

  const agg = aggRow[0];
  return {
    total: agg?.total ?? 0,
    byPlatform: byPlatformRows.map((row) => ({ platform: row.platform, count: row.count })),
    byProvince: byProvinceRows.map((row) => ({ province: row.province, count: row.count })),
    avgRateMin: agg?.avgRateMin != null ? Math.round(agg.avgRateMin) : null,
    avgRateMax: agg?.avgRateMax != null ? Math.round(agg.avgRateMax) : null,
  };
}
