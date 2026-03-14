import { and, db, eq } from "../db";
import { scraperConfigs } from "../db/schema";
import { findExpiredRetentionCandidates } from "./gdpr";
import { listActiveJobs } from "./jobs";
import { generateMatchesForJob } from "./match-generation";
import { runScrapePipelinesWithConcurrency } from "./scrape-pipeline";

export type ImportJobsBatchSummary = {
  totalPlatforms: number;
  successfulPlatforms: number;
  failedPlatforms: number;
  jobsNew: number;
  platforms: Array<{
    platform: string;
    status: "success" | "partial" | "failed";
    jobsNew: number;
    duplicates: number;
    errors?: string[];
  }>;
};

export type RunCandidateScoringBatchSummary = {
  jobsProcessed: number;
  candidatesConsidered: number;
  matchesCreated: number;
  duplicateMatches: number;
  errors: number;
};

export type GdprRetentionSummary = {
  expiredCandidates: number;
  oldestRetentionDate: Date | null;
};

function computeOldestDate(dates: Date[]): Date | null {
  if (dates.length === 0) return null;
  return dates.reduce((oldest, current) =>
    current.getTime() < oldest.getTime() ? current : oldest,
  );
}

/**
 * Run scraping for all active platforms (or a single active platform if provided).
 */
export async function importJobsFromActiveScrapers(
  platform?: string,
): Promise<ImportJobsBatchSummary> {
  const conditions = platform
    ? and(eq(scraperConfigs.isActive, true), eq(scraperConfigs.platform, platform))
    : eq(scraperConfigs.isActive, true);

  const activeConfigs = await db
    .select({
      platform: scraperConfigs.platform,
      baseUrl: scraperConfigs.baseUrl,
    })
    .from(scraperConfigs)
    .where(conditions);

  if (activeConfigs.length === 0) {
    return {
      totalPlatforms: 0,
      successfulPlatforms: 0,
      failedPlatforms: 0,
      jobsNew: 0,
      platforms: [],
    };
  }

  const settled = await runScrapePipelinesWithConcurrency(activeConfigs);

  const platforms = settled.map((result, index) => {
    const config = activeConfigs[index];
    const platformName = config?.platform ?? "unknown";
    if (result.status === "rejected") {
      return {
        platform: platformName,
        status: "failed" as const,
        jobsNew: 0,
        duplicates: 0,
        errors: [String(result.reason)],
      };
    }

    return {
      platform: platformName,
      status: result.value.errors.length === 0 ? ("success" as const) : ("partial" as const),
      jobsNew: result.value.jobsNew,
      duplicates: result.value.duplicates,
      errors: result.value.errors.length > 0 ? result.value.errors : undefined,
    };
  });

  const successfulPlatforms = platforms.filter((p) => p.status === "success").length;
  const failedPlatforms = platforms.length - successfulPlatforms;
  const jobsNew = platforms.reduce((sum, platformResult) => sum + platformResult.jobsNew, 0);

  return {
    totalPlatforms: platforms.length,
    successfulPlatforms,
    failedPlatforms,
    jobsNew,
    platforms,
  };
}

/**
 * Run score generation for active jobs in batch and aggregate results.
 */
export async function runCandidateScoringBatch(opts?: {
  maxJobs?: number;
  limitPerJob?: number;
}): Promise<RunCandidateScoringBatchSummary> {
  const jobs = await listActiveJobs(opts?.maxJobs ?? 200);

  if (jobs.length === 0) {
    return {
      jobsProcessed: 0,
      candidatesConsidered: 0,
      matchesCreated: 0,
      duplicateMatches: 0,
      errors: 0,
    };
  }

  let candidatesConsidered = 0;
  let matchesCreated = 0;
  let duplicateMatches = 0;
  let errors = 0;

  for (const job of jobs) {
    try {
      const result = await generateMatchesForJob({
        jobId: job.id,
        limit: opts?.limitPerJob ?? 10,
      });

      candidatesConsidered += result.totalCandidatesScored;
      matchesCreated += result.matchesCreated;
      duplicateMatches += result.duplicateMatches;
      errors += result.errors.length;
    } catch {
      errors += 1;
    }
  }

  return {
    jobsProcessed: jobs.length,
    candidatesConsidered,
    matchesCreated,
    duplicateMatches,
    errors,
  };
}

/**
 * Review GDPR retention status by listing expired candidates.
 */
export async function reviewGdprRetention(): Promise<GdprRetentionSummary> {
  const expired = await findExpiredRetentionCandidates();
  return {
    expiredCandidates: expired.length,
    oldestRetentionDate: computeOldestDate(
      expired.map((candidate) => candidate.dataRetentionUntil),
    ),
  };
}
