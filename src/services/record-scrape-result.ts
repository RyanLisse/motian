import { and, db, desc, eq, gte, sql } from "../db";
import { scrapeResults, scraperConfigs } from "../db/schema";
import { publish } from "../lib/event-bus";
import { CIRCUIT_BREAKER_THRESHOLD } from "../lib/helpers";

/**
 * Silent-failure detection — number of consecutive zero-jobsFound runs that
 * transitions a platform from "healthy" to "likely parser drift".
 *
 * Tuned to fire once at the exact streak transition (not every subsequent
 * run) so alerting stays idempotent between cron windows.
 */
const SILENT_FAILURE_STREAK = 3;
const SILENT_FAILURE_HISTORY_DAYS = 30;
const SILENT_FAILURE_MIN_HISTORICAL_MAX = 10;

export async function recordScrapeResult(data: {
  platform: string;
  jobsFound: number;
  jobsNew: number;
  duplicates: number;
  durationMs: number;
  status: string;
  errors: string[];
  jobIds?: string[];
}): Promise<void> {
  // Stap 1: Zoek config ID voor dit platform
  const configs = await db
    .select({
      id: scraperConfigs.id,
      consecutiveFailures: scraperConfigs.consecutiveFailures,
    })
    .from(scraperConfigs)
    .where(eq(scraperConfigs.platform, data.platform))
    .limit(1);

  const configId = configs[0]?.id ?? null;
  const previousFailures = configs[0]?.consecutiveFailures ?? 0;

  // Stap 2: Schrijf scrape resultaat (zonder costCredits/provider — niet in schema)
  await db.insert(scrapeResults).values({
    configId,
    platform: data.platform,
    durationMs: data.durationMs,
    jobsFound: data.jobsFound,
    jobsNew: data.jobsNew,
    duplicates: data.duplicates,
    status: data.status,
    errors: data.errors,
    jobIds: data.jobIds?.length ? data.jobIds : null,
  });

  // Stap 3: Update config lastRunAt + lastRunStatus + circuit breaker
  if (configId) {
    const isFailed = data.status === "failed";
    await db
      .update(scraperConfigs)
      .set({
        lastRunAt: new Date(),
        lastRunStatus: data.status,
        consecutiveFailures: isFailed ? sql`${scraperConfigs.consecutiveFailures} + 1` : 0,
        updatedAt: new Date(),
      })
      .where(eq(scraperConfigs.id, configId));

    const currentFailures = isFailed ? previousFailures + 1 : 0;
    if (
      isFailed &&
      previousFailures < CIRCUIT_BREAKER_THRESHOLD &&
      currentFailures >= CIRCUIT_BREAKER_THRESHOLD
    ) {
      console.warn(
        `[Circuit Breaker] OPEN for ${data.platform} — ${currentFailures} consecutive failures (threshold: ${CIRCUIT_BREAKER_THRESHOLD})`,
      );
      publish("scrape:circuit_breaker_open", {
        platform: data.platform,
        previousFailures,
        currentFailures,
        threshold: CIRCUIT_BREAKER_THRESHOLD,
      });
    }
    if (!isFailed && previousFailures >= CIRCUIT_BREAKER_THRESHOLD) {
      console.info(
        `[Circuit Breaker] CLOSED for ${data.platform} — recovered after ${previousFailures} failures`,
      );
      publish("scrape:circuit_breaker_closed", {
        platform: data.platform,
        previousFailures,
      });
    }

    // Silent-failure detection: a run that reports status='success' but
    // jobsFound=0 is almost always parser drift (source markup changed, our
    // regex no longer matches). Circuit breaker cannot see this because it
    // only counts status='failed'. We fire once at the streak transition.
    if (data.jobsFound === 0) {
      await detectSilentFailure(data.platform);
    }
  }
}

async function detectSilentFailure(platform: string): Promise<void> {
  const historyCutoff = new Date(Date.now() - SILENT_FAILURE_HISTORY_DAYS * 24 * 60 * 60 * 1000);

  // Latest run is the one we just wrote above; pull the N+1 most recent runs
  // so we can inspect both the current streak and the run that precedes it.
  const recent = await db
    .select({
      jobsFound: scrapeResults.jobsFound,
      runAt: scrapeResults.runAt,
    })
    .from(scrapeResults)
    .where(and(eq(scrapeResults.platform, platform), gte(scrapeResults.runAt, historyCutoff)))
    .orderBy(desc(scrapeResults.runAt))
    .limit(SILENT_FAILURE_STREAK + 1);

  if (recent.length < SILENT_FAILURE_STREAK) return;

  const currentStreak = recent.slice(0, SILENT_FAILURE_STREAK);
  const currentStreakAllZero = currentStreak.every((row) => (row.jobsFound ?? 0) === 0);
  if (!currentStreakAllZero) return;

  // Only fire on the exact transition — the run immediately before the streak
  // must have produced jobs. Otherwise we'd spam on every subsequent run.
  const runBeforeStreak = recent[SILENT_FAILURE_STREAK];
  const priorHadJobs = (runBeforeStreak?.jobsFound ?? 0) > 0;
  if (!priorHadJobs) return;

  // Require historical evidence that this platform normally produces data.
  const [maxRow] = await db
    .select({ max: sql<number>`coalesce(max(${scrapeResults.jobsFound}), 0)` })
    .from(scrapeResults)
    .where(and(eq(scrapeResults.platform, platform), gte(scrapeResults.runAt, historyCutoff)));
  const historicalMax = Number(maxRow?.max ?? 0);
  if (historicalMax < SILENT_FAILURE_MIN_HISTORICAL_MAX) return;

  console.warn(
    `[Silent Failure] ${platform} — ${SILENT_FAILURE_STREAK} consecutive zero-jobsFound runs (historical max: ${historicalMax}). Likely parser drift.`,
  );
  publish("scrape:silent_failure", {
    platform,
    streakLength: SILENT_FAILURE_STREAK,
    historicalMax,
    windowDays: SILENT_FAILURE_HISTORY_DAYS,
  });

  // Record the drift suspicion on the config so ops tooling / UI can surface
  // it without replaying events. Do not change lastRunStatus — the last run
  // already set that correctly.
  await db
    .update(scraperConfigs)
    .set({
      validationStatus: "drift_suspected",
      lastValidationError: `${SILENT_FAILURE_STREAK} consecutive zero-jobsFound runs while historical max=${historicalMax}`,
      updatedAt: new Date(),
    })
    .where(eq(scraperConfigs.platform, platform));
}
