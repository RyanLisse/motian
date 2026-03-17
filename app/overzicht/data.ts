import { and, asc, db, eq, gte, isNull, type SQL, sql } from "@/src/db";
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

async function getRecentJobs(database: typeof db): Promise<RecentJob[]> {
  const result = await (
    database as unknown as { execute(sql: SQL): Promise<{ rows: RecentJobRow[] }> }
  ).execute(sql`
    select id, title, company, platform, location, scraped_at
    from (
      select
        ${jobs.id} as id,
        ${jobs.title} as title,
        coalesce(${jobs.endClient}, ${jobs.company}) as company,
        ${jobs.platform} as platform,
        coalesce(${jobs.location}, ${jobs.province}) as location,
        ${jobs.scrapedAt}.mapWith(${jobs.scrapedAt}) as scraped_at,
        row_number() over (
          partition by lower(coalesce(${jobs.title}, '')),
                       lower(coalesce(${jobs.endClient}, ${jobs.company}, '')),
                       lower(coalesce(${jobs.province}, ${jobs.location}, ''))
          order by ${jobs.scrapedAt} desc, ${jobs.id} desc
        ) as rn
      from ${jobs}
      where ${jobs.deletedAt} is null
    ) where rn = 1
    order by scraped_at desc, id desc
    limit 5
  `);
  const rows = result.rows;

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    company: row.company,
    platform: row.platform,
    location: row.location,
    scrapedAt: row.scraped_at,
  }));
}

async function getRecentScrapes(database: typeof db): Promise<RecentScrape[]> {
  const result = await (
    database as unknown as { execute(sql: SQL): Promise<{ rows: RecentScrapeRow[] }> }
  ).execute(sql`
    select id, config_id, platform, run_at, duration_ms, jobs_found, jobs_new, duplicates, status, errors
    from (
      select
        ${scrapeResults.id} as id,
        ${scrapeResults.configId} as config_id,
        ${scrapeResults.platform} as platform,
        ${scrapeResults.runAt}.mapWith(${scrapeResults.runAt}) as run_at,
        ${scrapeResults.durationMs} as duration_ms,
        ${scrapeResults.jobsFound} as jobs_found,
        ${scrapeResults.jobsNew} as jobs_new,
        ${scrapeResults.duplicates} as duplicates,
        ${scrapeResults.status} as status,
        ${scrapeResults.errors}.mapWith(${scrapeResults.errors}) as errors,
        row_number() over (
          partition by lower(trim(${scrapeResults.platform}))
          order by ${scrapeResults.runAt} desc, ${scrapeResults.id} desc
        ) as rn
      from ${scrapeResults}
    ) where rn = 1
    order by run_at desc, platform asc
    limit 5
  `);
  const rows = result.rows;

  return dedupeRecentScrapes(
    rows.map((row) => ({
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

  // #region agent log
  try {
    const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : undefined;
    fetch("http://127.0.0.1:7696/ingest/807648ac-0e4a-43e7-9281-fc9626035545", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "018989",
      },
      body: JSON.stringify({
        sessionId: "018989",
        runId: "overview-initial",
        hypothesisId: "H1-H4",
        location: "app/overzicht/data.ts:getOverviewData",
        message: "getOverviewData start",
        data: {
          dbHost: url?.host,
          dbName: url?.pathname.replace(/^\//, "") ?? null,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  } catch {
    // ignore logging errors
  }
  // #endregion agent log

  // Note: We use Promise.all directly on the database object instead of
  // wrapping these in database.transaction(). The Next.js 15+ App Router
  // uses AsyncLocalStorage for Request/Response context (like cookies and headers),
  // and the pg driver's internal connection queueing mechanism used by transactions
  // loses this context during concurrent async operations in force-dynamic routes,
  // throwing "Access to storage is not allowed from this context".
  const platformCounts = await database
    .select({
      platform: jobs.platform,
      count: sql<number>`cast(count(*) as integer)`,
      weeklyNew: sql<number>`cast(count(*) filter (where ${jobs.scrapedAt} >= ${sevenDaysAgo}) as integer)`,
    })
    .from(jobs)
    .groupBy(jobs.platform)
    .orderBy(sql`count(*) desc`);

  const recentJobs = await getRecentJobs(database);

  const activeScrapers = await database
    .select()
    .from(scraperConfigs)
    .where(eq(scraperConfigs.isActive, true));

  const recentScrapes = await getRecentScrapes(database);

  const topCompanies = await database
    .select({
      company: jobs.company,
      count: sql<number>`cast(count(*) as integer)`,
    })
    .from(jobs)
    .where(sql`${jobs.company} is not null`)
    .groupBy(jobs.company)
    .orderBy(sql`count(*) desc`)
    .limit(5);

  const locationCounts = await database
    .select({
      province: jobs.province,
      count: sql<number>`cast(count(*) as integer)`,
    })
    .from(jobs)
    .where(sql`${jobs.province} is not null`)
    .groupBy(jobs.province)
    .orderBy(sql`count(*) desc`)
    .limit(5);

  const pipelineStageCounts = await database
    .select({
      stage: applications.stage,
      count: sql<number>`cast(count(*) as integer)`,
    })
    .from(applications)
    .where(isNull(applications.deletedAt))
    .groupBy(applications.stage);

  const upcomingInterviewCountResult = await database
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(interviews)
    .where(
      and(
        isNull(interviews.deletedAt),
        eq(interviews.status, "scheduled"),
        gte(interviews.scheduledAt, now),
      ),
    );

  const upcomingInterviews = await database
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
}
