import { logger, schedules } from "@trigger.dev/sdk";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/src/db";
import { scrapeResults, scraperConfigs } from "@/src/db/schema";
import { CIRCUIT_BREAKER_THRESHOLD } from "@/src/lib/helpers";

/**
 * Daily task to check scraper health and auto-reset circuit breakers.
 *
 * If a scraper has been tripped (consecutiveFailures >= threshold) but
 * had a successful run in the last 72 hours, reset the failure counter.
 * This prevents permanently stuck circuit breakers after transient issues.
 */
export const scraperHealthTask = schedules.task({
  id: "scraper-health-check",
  cron: {
    pattern: "0 6 * * *", // Daily at 6:00 AM
    timezone: "Europe/Amsterdam",
  },
  run: async () => {
    const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);
    let reset = 0;
    const alerts: string[] = [];

    // Find all configs with tripped circuit breakers
    const tripped = await db
      .select()
      .from(scraperConfigs)
      .where(
        and(
          eq(scraperConfigs.isActive, true),
          gt(scraperConfigs.consecutiveFailures, CIRCUIT_BREAKER_THRESHOLD - 1),
        ),
      );

    for (const cfg of tripped) {
      // Check for any successful run in the last 72 hours
      const recentSuccess = await db
        .select({ id: scrapeResults.id })
        .from(scrapeResults)
        .where(
          and(
            eq(scrapeResults.platform, cfg.platform),
            eq(scrapeResults.status, "success"),
            gt(scrapeResults.runAt, seventyTwoHoursAgo),
          ),
        )
        .limit(1);

      if (recentSuccess.length > 0) {
        // Reset circuit breaker — recent success proves transient issue
        await db
          .update(scraperConfigs)
          .set({ consecutiveFailures: 0 })
          .where(eq(scraperConfigs.id, cfg.id));
        reset++;
        logger.info(`Circuit breaker reset voor ${cfg.platform}`, {
          previousFailures: cfg.consecutiveFailures,
        });
      } else {
        alerts.push(
          `${cfg.platform}: ${cfg.consecutiveFailures} opeenvolgende fouten, geen succesvolle run in 72u`,
        );
      }
    }

    logger.info("Scraper gezondheidscheck voltooid", {
      trippedCount: tripped.length,
      resetCount: reset,
      alertCount: alerts.length,
    });

    return {
      trippedScrapers: tripped.length,
      resetCircuitBreakers: reset,
      alerts,
    };
  },
});
