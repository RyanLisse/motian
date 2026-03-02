import { logger, schedules } from "@trigger.dev/sdk";
import { and, eq, lt } from "drizzle-orm";
import { db } from "@/src/db";
import { jobMatches } from "@/src/db/schema";

/**
 * Weekly task to archive stale pending matches older than 30 days.
 *
 * Pending matches that haven't been reviewed accumulate noise in the UI
 * and degrade match relevance over time as job requirements evolve.
 */
export const matchStalenessTask = schedules.task({
  id: "match-staleness-purge",
  cron: {
    pattern: "0 5 * * 1", // Mondays at 5:00 AM
    timezone: "Europe/Amsterdam",
  },
  run: async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const archived = await db
      .update(jobMatches)
      .set({ status: "rejected", reviewedBy: "system:staleness-purge" })
      .where(and(eq(jobMatches.status, "pending"), lt(jobMatches.createdAt, thirtyDaysAgo)))
      .returning({
        id: jobMatches.id,
        jobId: jobMatches.jobId,
        candidateId: jobMatches.candidateId,
      });

    logger.info("Match staleness purge voltooid", {
      archivedCount: archived.length,
    });

    return {
      archivedCount: archived.length,
      archivedIds: archived.map((m) => m.id),
    };
  },
});
