import { StepConfig, Handlers } from "motia";
import { z } from "zod";
import { db } from "../../src/db";
import { scrapeResults, scraperConfigs } from "../../src/db/schema";
import { eq, sql } from "drizzle-orm";

export const config = {
  name: "RecordScrapeResult",
  description:
    "Schrijft scrape resultaten naar de database en werkt scraper config bij",
  triggers: [
    {
      type: "queue",
      topic: "scrape.completed",
      input: z.object({
        platform: z.string(),
        jobsFound: z.number(),
        jobsNew: z.number(),
        duplicates: z.number(),
        durationMs: z.number(),
        status: z.string(),
        errors: z.array(z.string()),
      }),
    },
  ],
  flows: ["recruitment-scraper"],
} as const satisfies StepConfig;

export const handler: Handlers<typeof config> = async (
  input,
  { logger },
) => {
  try {
    // Stap 1: Zoek config ID voor dit platform
    const configs = await db
      .select({ id: scraperConfigs.id })
      .from(scraperConfigs)
      .where(eq(scraperConfigs.platform, input.platform))
      .limit(1);

    const configId = configs[0]?.id ?? null;

    // Stap 2: Schrijf scrape resultaat
    await db.insert(scrapeResults).values({
      configId,
      platform: input.platform,
      durationMs: input.durationMs,
      jobsFound: input.jobsFound,
      jobsNew: input.jobsNew,
      duplicates: input.duplicates,
      status: input.status,
      errors: input.errors,
    });

    // Stap 3: Update config lastRunAt + lastRunStatus + circuit breaker
    if (configId) {
      const isFailed = input.status === "failed";
      await db
        .update(scraperConfigs)
        .set({
          lastRunAt: new Date(),
          lastRunStatus: input.status,
          // Circuit breaker: increment on failure, reset to 0 on success
          consecutiveFailures: isFailed
            ? sql`${scraperConfigs.consecutiveFailures} + 1`
            : 0,
          updatedAt: new Date(),
        })
        .where(eq(scraperConfigs.id, configId));
    }

    logger.info(
      `Scrape resultaat opgeslagen: ${input.platform} — ${input.status} (${input.jobsNew} nieuw, ${input.durationMs}ms)`,
    );
  } catch (err) {
    logger.error(`Fout bij opslaan scrape resultaat: ${String(err)}`);
    throw err;
  }
};
