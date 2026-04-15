import { getPlatformAdapter } from "@motian/scrapers";
import { logger, schedules } from "@trigger.dev/sdk";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
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
  maxDuration: 300,
  retry: {
    maxAttempts: 2,
    factor: 2,
    minTimeoutInMs: 2000,
    maxTimeoutInMs: 15_000,
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

    // Batch: find all tripped platforms that had a recent success in one query
    const trippedPlatforms = tripped.map((c) => c.platform);
    const platformsWithRecentSuccess = new Set(
      trippedPlatforms.length > 0
        ? (
            await db
              .select({ platform: scrapeResults.platform })
              .from(scrapeResults)
              .where(
                and(
                  inArray(scrapeResults.platform, trippedPlatforms),
                  eq(scrapeResults.status, "success"),
                  gt(scrapeResults.runAt, seventyTwoHoursAgo),
                ),
              )
              .groupBy(scrapeResults.platform)
          ).map((r) => r.platform)
        : [],
    );

    for (const cfg of tripped) {
      if (platformsWithRecentSuccess.has(cfg.platform)) {
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
    let staleResets = 0;
    const STALE_CIRCUIT_BREAKER_MS = 48 * 60 * 60 * 1000; // 48 hours

    for (const cfg of tripped) {
      // Only probe platforms still in the alerts list (no recent success)
      const isStuckPlatform = alerts.some((a) => a.startsWith(cfg.platform));
      if (!isStuckPlatform) continue;

      probeAttempts++;
      let probeRecovered = false;
      try {
        const adapter = getPlatformAdapter(cfg.platform);
        if (adapter) {
          const config = await getConfigByPlatform(cfg.platform);
          if (config) {
            const runtimeConfig = toRuntimeConfig(cfg.platform, config);
            const probeResult = await adapter.testImport(runtimeConfig, { limit: 1 });

            if (probeResult.status === "success" && probeResult.jobsFound > 0) {
              // Probe succeeded — reset circuit breaker
              await db
                .update(scraperConfigs)
                .set({ consecutiveFailures: 0 })
                .where(eq(scraperConfigs.id, cfg.id));
              reset++;
              probeRecovered = true;
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
          }
        }
      } catch (probeErr) {
        logger.warn(`Circuit breaker probe error voor ${cfg.platform}`, {
          error: probeErr instanceof Error ? probeErr.message : String(probeErr),
        });
      }

      // Auto-reset stale circuit breakers (open > 48h) so platforms get another chance.
      // Without this, a platform that fails 5x and whose probe also fails stays dead forever.
      if (!probeRecovered && cfg.lastRunAt) {
        const staleDuration = Date.now() - new Date(cfg.lastRunAt).getTime();
        if (staleDuration >= STALE_CIRCUIT_BREAKER_MS) {
          await db
            .update(scraperConfigs)
            .set({ consecutiveFailures: 0 })
            .where(eq(scraperConfigs.id, cfg.id));
          staleResets++;
          reset++;
          const alertIdx = alerts.findIndex((a) => a.startsWith(cfg.platform));
          if (alertIdx !== -1) alerts.splice(alertIdx, 1);
          logger.info(`Circuit breaker stale-reset voor ${cfg.platform}`, {
            previousFailures: cfg.consecutiveFailures,
            staleDurationHours: Math.round(staleDuration / 3_600_000),
          });
        }
      }
    }

    logger.info("Scraper gezondheidscheck voltooid", {
      trippedCount: tripped.length,
      resetCount: reset,
      probeAttempts,
      staleResets,
      alertCount: alerts.length,
    });

    return {
      trippedScrapers: tripped.length,
      resetCircuitBreakers: reset,
      probeAttempts,
      staleResets,
      alerts,
    };
  },
});
