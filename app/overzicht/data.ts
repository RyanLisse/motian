import { and, asc, db, desc, eq, gte, isNull, ne, sql } from "@/src/db";
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

type RecentJob = {
  id: string;
  title: string;
  company: string | null;
  platform: string;
  location: string | null;
  scrapedAt: Date | null;
};

async function getRecentJobs(database: typeof db): Promise<RecentJob[]> {
  const rows = await database
    .select({
      id: jobs.id,
      title: jobs.title,
      company: sql<string | null>`coalesce(${jobs.endClient}, ${jobs.company})`,
      platform: jobs.platform,
      location: sql<string | null>`coalesce(${jobs.location}, ${jobs.province})`,
      scrapedAt: jobs.scrapedAt,
      endClient: jobs.endClient,
      province: jobs.province,
    })
    .from(jobs)
    .where(and(ne(jobs.status, "archived"), isNull(jobs.deletedAt)))
    .orderBy(desc(jobs.scrapedAt), desc(jobs.id))
    .limit(200);

  const seen = new Set<string>();
  const deduped: RecentJob[] = [];

  for (const row of rows) {
    const key = [
      row.title?.trim().toLowerCase() ?? "",
      (row.endClient ?? row.company ?? "").trim().toLowerCase(),
      (row.province ?? row.location ?? "").trim().toLowerCase(),
    ].join("|");

    if (seen.has(key)) continue;
    seen.add(key);

    deduped.push({
      id: row.id,
      title: row.title,
      company: row.company,
      platform: row.platform,
      location: row.location,
      scrapedAt: row.scrapedAt,
    });

    if (deduped.length >= 5) break;
  }

  return deduped;
}

async function getRecentScrapes(database: typeof db): Promise<RecentScrape[]> {
  const rows: RecentScrapeRow[] = await database
    .select({
      id: scrapeResults.id,
      config_id: scrapeResults.configId,
      platform: scrapeResults.platform,
      run_at: scrapeResults.runAt,
      duration_ms: scrapeResults.durationMs,
      jobs_found: scrapeResults.jobsFound,
      jobs_new: scrapeResults.jobsNew,
      duplicates: scrapeResults.duplicates,
      status: scrapeResults.status,
      errors: scrapeResults.errors,
    })
    .from(scrapeResults)
    .orderBy(desc(scrapeResults.runAt), desc(scrapeResults.id))
    .limit(200);

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

  // Note: We use Promise.all directly on the database object instead of
  // wrapping these in database.transaction(). The Next.js 15+ App Router
  // uses AsyncLocalStorage for Request/Response context (like cookies and headers),
  // and the pg driver's internal connection queueing mechanism used by transactions
  // loses this context during concurrent async operations in force-dynamic routes,
  // throwing "Access to storage is not allowed from this context".
  const visibleCondition = and(ne(jobs.status, "archived"), isNull(jobs.deletedAt));
  const openCondition = and(eq(jobs.status, "open"), isNull(jobs.deletedAt));

  const platformCounts = await database
    .select({
      platform: jobs.platform,
      count: sql<number>`cast(count(*) as integer)`,
      weeklyNew: sql<number>`cast(count(*) filter (where ${jobs.scrapedAt} >= ${sevenDaysAgo}) as integer)`,
    })
    .from(jobs)
    .where(visibleCondition)
    .groupBy(jobs.platform)
    .orderBy(sql`count(*) desc`);

  // Deduplicated total matching the vacatures page count
  let dedupedTotal = 0;
  try {
    const dedupedTotalResult = await (
      database as unknown as { execute(query: unknown): Promise<{ rows: Array<{ cnt: number }> }> }
    ).execute(sql`
      with ranked as (
        select ${jobs.id},
          row_number() over (
            partition by ${jobs.dedupeTitleNormalized}, ${jobs.dedupeClientNormalized}, ${jobs.dedupeLocationNormalized}
            order by ${jobs.scrapedAt} desc nulls last, ${jobs.id} desc
          ) as rn
        from ${jobs}
        where ${openCondition}
      )
      select cast(count(*) as integer) as cnt from ranked where rn = 1
    `);
    dedupedTotal = dedupedTotalResult.rows[0]?.cnt ?? 0;
  } catch {
    // execute may not be available in all environments; fall back to 0
  }

  const recentJobs = await getRecentJobs(database);

  const activeScrapers = await database
    .select({
      id: scraperConfigs.id,
      platform: scraperConfigs.platform,
      isActive: scraperConfigs.isActive,
      cronExpression: scraperConfigs.cronExpression,
      consecutiveFailures: scraperConfigs.consecutiveFailures,
      lastRunAt: scraperConfigs.lastRunAt,
      lastRunStatus: scraperConfigs.lastRunStatus,
      updatedAt: scraperConfigs.updatedAt,
    })
    .from(scraperConfigs)
    .where(eq(scraperConfigs.isActive, true));

  const recentScrapes = await getRecentScrapes(database);

  const topCompanies = await database
    .select({
      company: jobs.company,
      count: sql<number>`cast(count(*) as integer)`,
    })
    .from(jobs)
    .where(
      and(sql`${jobs.company} is not null`, ne(jobs.status, "archived"), isNull(jobs.deletedAt)),
    )
    .groupBy(jobs.company)
    .orderBy(sql`count(*) desc`)
    .limit(5);

  const locationCounts = await database
    .select({
      province: jobs.province,
      count: sql<number>`cast(count(*) as integer)`,
    })
    .from(jobs)
    .where(
      and(sql`${jobs.province} is not null`, ne(jobs.status, "archived"), isNull(jobs.deletedAt)),
    )
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
    dedupedTotal,
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
