import { db } from "../db";
import { scrapeResults, scraperConfigs } from "../db/schema";
import { eq, sql } from "drizzle-orm";

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
    .select({ id: scraperConfigs.id })
    .from(scraperConfigs)
    .where(eq(scraperConfigs.platform, data.platform))
    .limit(1);

  const configId = configs[0]?.id ?? null;

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
        consecutiveFailures: isFailed
          ? sql`${scraperConfigs.consecutiveFailures} + 1`
          : 0,
        updatedAt: new Date(),
      })
      .where(eq(scraperConfigs.id, configId));
  }
}
