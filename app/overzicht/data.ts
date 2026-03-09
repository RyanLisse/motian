import { and, asc, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from "@/src/db";
import {
  applications,
  candidates,
  interviews,
  jobs,
  scrapeResults,
  scraperConfigs,
} from "@/src/db/schema";

type RecentScrapeRow = {
  id: string;
  config_id: string | null;
  platform: string;
  run_at: Date | null;
  duration_ms: number | null;
  jobs_found: number | null;
  jobs_new: number | null;
  duplicates: number | null;
  status: string;
  errors: unknown;
};

type RecentScrape = {
  id: string;
  configId: string | null;
  platform: string;
  runAt: Date | null;
  durationMs: number | null;
  jobsFound: number | null;
  jobsNew: number | null;
  duplicates: number | null;
  status: string;
  errors: string[];
};

function normalizeOverviewPlatform(platform: string | null | undefined) {
  return platform?.trim().toLowerCase() ?? "";
}

function dedupeRecentScrapes(rows: RecentScrape[]): RecentScrape[] {
  const seen = new Set<string>();

  return rows.flatMap((row) => {
    const platform = normalizeOverviewPlatform(row.platform);
    if (!platform || seen.has(platform)) return [];

    seen.add(platform);
    return [{ ...row, platform }];
  });
}

type RecentJobRow = {
  id: string;
  title: string;
  company: string | null;
  platform: string;
  location: string | null;
  scraped_at: Date | null;
};

type RecentJob = {
  id: string;
  title: string;
  company: string | null;
  platform: string;
  location: string | null;
  scrapedAt: Date | null;
};

async function getRecentJobs(database: Pick<typeof db, "execute">): Promise<RecentJob[]> {
  const result = await database.execute(sql<RecentJobRow>`
    select *
    from (
      select distinct on (
        trim(regexp_replace(lower(coalesce(${jobs.title}, '')), '[^[:alnum:]]+', ' ', 'g')),
        trim(regexp_replace(lower(coalesce(${jobs.endClient}, ${jobs.company}, '')), '[^[:alnum:]]+', ' ', 'g')),
        trim(regexp_replace(lower(coalesce(${jobs.province}, ${jobs.location}, '')), '[^[:alnum:]]+', ' ', 'g'))
      )
        ${jobs.id} as id,
        ${jobs.title} as title,
        coalesce(${jobs.endClient}, ${jobs.company}) as company,
        ${jobs.platform} as platform,
        coalesce(${jobs.location}, ${jobs.province}) as location,
        ${jobs.scrapedAt} as scraped_at
      from ${jobs}
      where ${jobs.deletedAt} is null
      order by
        trim(regexp_replace(lower(coalesce(${jobs.title}, '')), '[^[:alnum:]]+', ' ', 'g')) asc,
        trim(regexp_replace(lower(coalesce(${jobs.endClient}, ${jobs.company}, '')), '[^[:alnum:]]+', ' ', 'g')) asc,
        trim(regexp_replace(lower(coalesce(${jobs.province}, ${jobs.location}, '')), '[^[:alnum:]]+', ' ', 'g')) asc,
        ${jobs.scrapedAt} desc nulls last,
        ${jobs.id} desc
    ) latest_job_groups
    order by scraped_at desc nulls last, id desc
    limit 5
  `);

  return (result.rows as RecentJobRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    company: row.company,
    platform: row.platform,
    location: row.location,
    scrapedAt: row.scraped_at,
  }));
}

async function getRecentScrapes(database: Pick<typeof db, "execute">): Promise<RecentScrape[]> {
  const result = await database.execute(sql<RecentScrapeRow>`
    select *
    from (
      select distinct on (${scrapeResults.platform})
        ${scrapeResults.id} as id,
        ${scrapeResults.configId} as config_id,
        ${scrapeResults.platform} as platform,
        ${scrapeResults.runAt} as run_at,
        ${scrapeResults.durationMs} as duration_ms,
        ${scrapeResults.jobsFound} as jobs_found,
        ${scrapeResults.jobsNew} as jobs_new,
        ${scrapeResults.duplicates} as duplicates,
        ${scrapeResults.status} as status,
        ${scrapeResults.errors} as errors
      from ${scrapeResults}
      order by ${scrapeResults.platform} asc, ${scrapeResults.runAt} desc nulls last, ${scrapeResults.id} desc
    ) latest_platform_runs
    order by run_at desc nulls last, platform asc
    limit 5
  `);

  return dedupeRecentScrapes(
    (result.rows as RecentScrapeRow[]).map((row) => ({
      id: row.id,
      configId: row.config_id,
      platform: row.platform,
      runAt: row.run_at,
      durationMs: row.duration_ms,
      jobsFound: row.jobs_found,
      jobsNew: row.jobs_new,
      duplicates: row.duplicates,
      status: row.status,
      errors: Array.isArray(row.errors)
        ? row.errors.filter((value): value is string => typeof value === "string")
        : [],
    })),
  );
}

export async function getOverviewData(database: typeof db = db) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const now = new Date();

  return database.transaction(async (tx) => {
    // Reuse one pooled client for all dashboard reads to avoid repeated
    // pg-pool.connect spans on a single /overzicht render.
    const platformCounts = await tx
      .select({
        platform: jobs.platform,
        count: sql<number>`count(*)::int`,
        weeklyNew: sql<number>`count(*) filter (where ${jobs.scrapedAt} >= ${sevenDaysAgo})::int`,
      })
      .from(jobs)
      .groupBy(jobs.platform)
      .orderBy(sql`count(*) desc`);

    const recentJobs = await getRecentJobs(tx);

    const activeScrapers = await tx
      .select()
      .from(scraperConfigs)
      .where(eq(scraperConfigs.isActive, true));

    const recentScrapes = await getRecentScrapes(tx);

    const topCompanies = await tx
      .select({
        company: jobs.company,
        count: sql<number>`count(*)::int`,
      })
      .from(jobs)
      .where(sql`${jobs.company} is not null`)
      .groupBy(jobs.company)
      .orderBy(sql`count(*) desc`)
      .limit(5);

    const locationCounts = await tx
      .select({
        province: jobs.province,
        count: sql<number>`count(*)::int`,
      })
      .from(jobs)
      .where(sql`${jobs.province} is not null`)
      .groupBy(jobs.province)
      .orderBy(sql`count(*) desc`)
      .limit(5);

    const pipelineStageCounts = await tx
      .select({
        stage: applications.stage,
        count: sql<number>`count(*)::int`,
      })
      .from(applications)
      .where(isNull(applications.deletedAt))
      .groupBy(applications.stage);

    const upcomingInterviewCountResult = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(interviews)
      .where(
        and(
          isNull(interviews.deletedAt),
          eq(interviews.status, "scheduled"),
          gte(interviews.scheduledAt, now),
        ),
      );

    const upcomingInterviews = await tx
      .select({
        id: interviews.id,
        scheduledAt: interviews.scheduledAt,
        type: interviews.type,
        candidateName: candidates.name,
        jobTitle: jobs.title,
        jobCompany: jobs.company,
      })
      .from(interviews)
      .innerJoin(applications, eq(interviews.applicationId, applications.id))
      .leftJoin(candidates, eq(applications.candidateId, candidates.id))
      .leftJoin(jobs, eq(applications.jobId, jobs.id))
      .where(
        and(
          isNull(interviews.deletedAt),
          eq(interviews.status, "scheduled"),
          gte(interviews.scheduledAt, now),
        ),
      )
      .orderBy(asc(interviews.scheduledAt))
      .limit(4);

    return {
      activeScrapers,
      locationCounts,
      pipelineStageCounts,
      platformCounts,
      recentJobs,
      recentScrapes,
      topCompanies,
      upcomingInterviewCountResult,
      upcomingInterviews,
    };
  });
}
