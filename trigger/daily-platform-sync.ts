import { logger, schedules } from "@trigger.dev/sdk";
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { platformDailyStats } from "@/src/db/platform-status-schema";
import { scraperConfigs } from "@/src/db/schema";
import { getStatusAdapter, type PlatformStatus } from "@/src/services/platform-status-adapters";

/**
 * Daily platform status sync — runs at 7:00 AM Amsterdam time.
 *
 * For each active scraper config, fetches platform-side stats via the
 * registered adapter (or stub), persists daily snapshots, and logs results.
 * Alerts are collected for platforms that report unavailable.
 */
export const dailyPlatformSyncTask = schedules.task({
  id: "daily-platform-sync",
  cron: {
    pattern: "0 7 * * *",
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
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const alerts: string[] = [];
    const results: PlatformStatus[] = [];

    // Fetch all active scraper configs
    const activeConfigs = await db
      .select({ id: scraperConfigs.id, platform: scraperConfigs.platform })
      .from(scraperConfigs)
      .where(eq(scraperConfigs.isActive, true));

    logger.info("Platform status sync gestart", {
      activeConfigCount: activeConfigs.length,
      date: today,
    });

    for (const cfg of activeConfigs) {
      const adapter = getStatusAdapter(cfg.platform);

      try {
        const status = await adapter.fetchStatus({
          platform: cfg.platform,
          configId: cfg.id,
        });

        results.push(status);

        // Persist daily snapshot
        await db.insert(platformDailyStats).values({
          date: today,
          platform: cfg.platform,
          available: status.available,
          views: status.metrics?.views ?? null,
          applications: status.metrics?.applications ?? null,
        });

        if (!status.available) {
          alerts.push(`${cfg.platform}: platform niet beschikbaar`);
        }

        logger.info(`Status opgehaald voor ${cfg.platform}`, {
          available: status.available,
          views: status.metrics?.views,
          applications: status.metrics?.applications,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        alerts.push(`${cfg.platform}: fout bij ophalen status — ${message}`);
        logger.error(`Platform status fout voor ${cfg.platform}`, {
          error: message,
        });

        // Still persist a row marking the platform as unavailable
        await db.insert(platformDailyStats).values({
          date: today,
          platform: cfg.platform,
          available: false,
        });
      }
    }

    if (alerts.length > 0) {
      logger.warn("Platform status waarschuwingen", { alerts });
      // Slack notification is handled by the caller or a separate alert task
    }

    logger.info("Platform status sync voltooid", {
      platformsChecked: activeConfigs.length,
      alertCount: alerts.length,
    });

    return {
      date: today,
      platformsChecked: activeConfigs.length,
      results,
      alerts,
    };
  },
});
