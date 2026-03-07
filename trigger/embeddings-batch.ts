import { logger, schedules } from "@trigger.dev/sdk";
import { and, isNotNull, isNull, or, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { jobs } from "@/src/db/schema";
import { embedCandidatesBatch, embedJob } from "@/src/services/embedding";

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
    const jobsWithout = await db
      .select({ id: jobs.id, title: jobs.title })
      .from(jobs)
      .where(
        and(
          isNull(jobs.embedding),
          isNull(jobs.deletedAt),
          or(
            isNotNull(jobs.descriptionSummary),
            sql`nullif(trim(${jobs.description}), '') is not null`,
          ),
        ),
      )
      .limit(50);

    let jobsEmbedded = 0;
    const jobErrors: string[] = [];

    for (const job of jobsWithout) {
      try {
        const success = await embedJob(job.id);
        if (success) jobsEmbedded++;
      } catch (err) {
        jobErrors.push(`Job ${job.id} (${job.title}): ${String(err)}`);
      }
    }

    // --- Candidates without embeddings ---
    const candidateResult = await embedCandidatesBatch({ limit: 50 });

    logger.info("Embeddings backfill voltooid", {
      jobsFound: jobsWithout.length,
      jobsEmbedded,
      jobErrors: jobErrors.length,
      candidatesEmbedded: candidateResult.embedded,
      candidatesSkipped: candidateResult.skipped,
      candidateErrors: candidateResult.errors.length,
    });

    return {
      jobs: {
        found: jobsWithout.length,
        embedded: jobsEmbedded,
        errors: jobErrors,
      },
      candidates: candidateResult,
    };
  },
});
