import { logger, schedules } from "@trigger.dev/sdk";
import { eraseCandidateData, findExpiredRetentionCandidates } from "@/src/services/gdpr";

export const dataRetentionTask = schedules.task({
  id: "data-retention-cleanup",
  cron: {
    pattern: "0 2 * * *", // Daily at 2:00 AM
    timezone: "Europe/Amsterdam",
  },
  run: async () => {
    const expired = await findExpiredRetentionCandidates();

    if (expired.length === 0) {
      logger.info("Geen kandidaten met verlopen dataretentie");
      return { totalErased: 0, errors: [] };
    }

    let totalErased = 0;
    const errors: string[] = [];

    for (const candidate of expired) {
      try {
        const result = await eraseCandidateData(candidate.id);
        if (result.deletedCandidate) totalErased++;
      } catch (err) {
        errors.push(`Kandidaat ${candidate.id}: ${String(err)}`);
      }
    }

    logger.info("Data retention cleanup voltooid", {
      totalErased,
      totalExpired: expired.length,
      errors: errors.length,
    });

    return { totalErased, totalExpired: expired.length, errors };
  },
});
