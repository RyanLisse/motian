import { getPlatformAdapter } from "@motian/scrapers";
import { logger, schedules } from "@trigger.dev/sdk";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/src/db";
import { scrapeResults, scraperConfigs } from "@/src/db/schema";
import { CIRCUIT_BREAKER_THRESHOLD } from "@/src/lib/helpers";
import { getConfigByPlatform, toRuntimeConfig } from "@/src/services/scrapers";

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

    // Probe tripped platforms that have been stuck without any recent success
    let probeAttempts = 0;
    for (const cfg of tripped) {
      // Only probe platforms still in the alerts list (no recent success)
      const isStuckPlatform = alerts.some((a) => a.startsWith(cfg.platform));
      if (!isStuckPlatform) continue;

      probeAttempts++;
      try {
        const adapter = getPlatformAdapter(cfg.platform);
        if (!adapter) continue;

        const config = await getConfigByPlatform(cfg.platform);
        if (!config) continue;

        const runtimeConfig = toRuntimeConfig(cfg.platform, config);
        const probeResult = await adapter.testImport(runtimeConfig, { limit: 1 });

        if (probeResult.status === "success" && probeResult.jobsFound > 0) {
          // Probe succeeded — reset circuit breaker
          await db
            .update(scraperConfigs)
            .set({ consecutiveFailures: 0 })
            .where(eq(scraperConfigs.id, cfg.id));
          reset++;
          // Remove from alerts since we just recovered
          const alertIdx = alerts.findIndex((a) => a.startsWith(cfg.platform));
          if (alertIdx !== -1) alerts.splice(alertIdx, 1);
          logger.info(`Circuit breaker probe-reset voor ${cfg.platform}`, {
            previousFailures: cfg.consecutiveFailures,
            probeJobsFound: probeResult.jobsFound,
          });
        } else {
          logger.warn(`Circuit breaker probe mislukt voor ${cfg.platform}`, {
            probeStatus: probeResult.status,
            probeErrors: probeResult.errors,
          });
        }
      } catch (probeErr) {
        logger.warn(`Circuit breaker probe error voor ${cfg.platform}`, {
          error: probeErr instanceof Error ? probeErr.message : String(probeErr),
        });
      }
    }

    logger.info("Scraper gezondheidscheck voltooid", {
      trippedCount: tripped.length,
      resetCount: reset,
      probeAttempts,
      alertCount: alerts.length,
    });

    return {
      trippedScrapers: tripped.length,
      resetCircuitBreakers: reset,
      probeAttempts,
      alerts,
    };
  },
});
