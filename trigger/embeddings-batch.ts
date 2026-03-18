import { logger, schedules } from "@trigger.dev/sdk";
import { embedCandidatesBatch, embedJobsBatch } from "@/src/services/embedding";

/**
 * Hourly task to backfill missing embeddings for jobs and candidates.
 *
 * Jobs without embeddings are invisible to semantic search and matching.
 * This guarantees eventual consistency even if real-time enrichment fails.
 */
export const embeddingsBatchTask = schedules.task({
  id: "embeddings-batch",
  cron: {
    pattern: "15 * * * *", // Every hour at :15
    timezone: "Europe/Amsterdam",
  },
  run: async () => {
    // --- Jobs without embeddings ---
    const jobResult = await embedJobsBatch({ limit: 200 });

    // --- Candidates without embeddings ---
    const candidateResult = await embedCandidatesBatch({ limit: 200 });

    logger.info("Embeddings backfill voltooid", {
      jobsEmbedded: jobResult.embedded,
      jobsSkipped: jobResult.skipped,
      jobErrors: jobResult.errors.length,
      candidatesEmbedded: candidateResult.embedded,
      candidatesSkipped: candidateResult.skipped,
      candidateErrors: candidateResult.errors.length,
    });

    return {
      jobs: jobResult,
      candidates: candidateResult,
    };
  },
});
