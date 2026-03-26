import { logger, task } from "@trigger.dev/sdk";
import { refreshDedupeRanks } from "../src/services/jobs/dedupe-ranks";

export const dedupeRanksRefresh = task({
  id: "dedupe-ranks-refresh",
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1_000,
    maxTimeoutInMs: 30_000,
  },
  run: async () => {
    logger.info("Refreshing dedupe ranks");
    const result = await refreshDedupeRanks();
    logger.info("Dedupe ranks refreshed", {
      rowsUpserted: result.rowsUpserted,
      computedAt: result.computedAt.toISOString(),
    });
    return {
      rowsUpserted: result.rowsUpserted,
      computedAt: result.computedAt.toISOString(),
    };
  },
});
