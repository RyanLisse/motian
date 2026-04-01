import { logger, schedules } from "@trigger.dev/sdk";
import { refreshDedupeRanks } from "../src/services/jobs/dedupe-ranks";
import { refreshSidebarMetadata } from "../src/services/sidebar-metadata";

/**
 * Unified cache refresh — runs every 15 minutes.
 *
 * Consolidates dedupe-ranks-refresh and sidebar-metadata-refresh into a
 * single scheduled task to stay within the Trigger.dev schedule limit.
 */
export const cacheRefreshTask = schedules.task({
  id: "cache-refresh",
  cron: {
    pattern: "*/15 * * * *",
    timezone: "Europe/Amsterdam",
  },
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1_000,
    maxTimeoutInMs: 30_000,
  },
  run: async () => {
    // Run both refreshes in parallel — they're independent DB queries
    const [dedupeResult, sidebarResult] = await Promise.all([
      refreshDedupeRanks().catch((err) => {
        logger.error("Dedupe ranks refresh mislukt", { error: String(err) });
        return null;
      }),
      refreshSidebarMetadata().catch((err) => {
        logger.error("Sidebar metadata refresh mislukt", { error: String(err) });
        return null;
      }),
    ]);

    if (dedupeResult) {
      logger.info("Dedupe ranks refreshed", {
        rowsUpserted: dedupeResult.rowsUpserted,
        computedAt: dedupeResult.computedAt.toISOString(),
      });
    }

    if (sidebarResult) {
      logger.info("Sidebar metadata refreshed", {
        computedAt: sidebarResult.computedAt.toISOString(),
        totalCount: sidebarResult.totalCount,
        platformCount: sidebarResult.platforms.length,
      });
    }

    return {
      dedupeRanks: dedupeResult
        ? { rowsUpserted: dedupeResult.rowsUpserted, computedAt: dedupeResult.computedAt.toISOString() }
        : null,
      sidebarMetadata: sidebarResult
        ? { computedAt: sidebarResult.computedAt.toISOString(), totalCount: sidebarResult.totalCount }
        : null,
    };
  },
});
