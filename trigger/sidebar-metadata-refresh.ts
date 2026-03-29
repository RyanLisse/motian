import { logger, schedules } from "@trigger.dev/sdk";
import { refreshSidebarMetadata } from "../src/services/sidebar-metadata";

export const sidebarMetadataRefresh = schedules.task({
  id: "sidebar-metadata-refresh",
  cron: { pattern: "*/15 * * * *", timezone: "Europe/Amsterdam" },
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1_000,
    maxTimeoutInMs: 30_000,
  },
  run: async () => {
    logger.info("Refreshing sidebar metadata");
    const result = await refreshSidebarMetadata();
    logger.info("Sidebar metadata refreshed", {
      computedAt: result.computedAt.toISOString(),
      totalCount: result.totalCount,
      platformCount: result.platforms.length,
      endClientCount: result.endClients.length,
      categoryCount: result.categories.length,
      skillOptionCount: result.skillOptions.length,
    });
    return { computedAt: result.computedAt.toISOString(), totalCount: result.totalCount };
  },
});
