import { logger, schedules } from "@trigger.dev/sdk";
import { refreshPrecomputedOverlapGroups } from "@/src/services/scraper-dashboard";

export const scraperOverlapPrecomputeTask = schedules.task({
  id: "scraper-overlap-precompute",
  cron: {
    pattern: "15 * * * *",
    timezone: "Europe/Amsterdam",
  },
  retry: {
    maxAttempts: 2,
    factor: 2,
    minTimeoutInMs: 5_000,
    maxTimeoutInMs: 30_000,
  },
  maxDuration: 300,
  run: async () => {
    const result = await refreshPrecomputedOverlapGroups();

    logger.info("Overlapgroepen precomputed", {
      totalGroups: result.totalGroups,
      computedAt: result.computedAt.toISOString(),
    });

    return {
      totalGroups: result.totalGroups,
      computedAt: result.computedAt.toISOString(),
    };
  },
});
