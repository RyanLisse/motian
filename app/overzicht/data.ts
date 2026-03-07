import { and, asc, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from "@/src/db";
import {
  applications,
  candidates,
  interviews,
  jobs,
  scrapeResults,
  scraperConfigs,
} from "@/src/db/schema";

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
      .where(isNull(jobs.deletedAt))
      .groupBy(jobs.platform)
      .orderBy(sql`count(*) desc`);

    const recentJobs = await tx
      .select({
        id: jobs.id,
        title: jobs.title,
        company: jobs.company,
        platform: jobs.platform,
        location: jobs.location,
        scrapedAt: jobs.scrapedAt,
      })
      .from(jobs)
      .where(isNull(jobs.deletedAt))
      .orderBy(desc(jobs.scrapedAt))
      .limit(5);

    const activeScrapers = await tx
      .select()
      .from(scraperConfigs)
      .where(eq(scraperConfigs.isActive, true));

    const recentScrapes = await tx
      .select({
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
      })
      .from(scrapeResults)
      .orderBy(desc(scrapeResults.runAt))
      .limit(5);

    const topCompanies = await tx
      .select({
        company: jobs.company,
        count: sql<number>`count(*)::int`,
      })
      .from(jobs)
      .where(and(isNull(jobs.deletedAt), sql`${jobs.company} is not null`))
      .groupBy(jobs.company)
      .orderBy(sql`count(*) desc`)
      .limit(5);

    const locationCounts = await tx
      .select({
        province: jobs.province,
        count: sql<number>`count(*)::int`,
      })
      .from(jobs)
      .where(and(isNull(jobs.deletedAt), sql`${jobs.province} is not null`))
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
