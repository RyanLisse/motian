import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { scrapeResults, scraperConfigs } from "../db/schema";
import { publish } from "../lib/event-bus";
import { CIRCUIT_BREAKER_THRESHOLD } from "../lib/helpers";

export async function recordScrapeResult(data: {
  platform: string;
  jobsFound: number;
  jobsNew: number;
  duplicates: number;
  durationMs: number;
  status: string;
  errors: string[];
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
  }
}
