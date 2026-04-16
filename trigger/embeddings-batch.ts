import { logger, schedules } from "@trigger.dev/sdk";
import { and, db, isNull, jobs } from "@/src/db";
import { embedCandidatesBatch, embedJob } from "@/src/services/embedding";
import { getVisibleVacancyCondition } from "@/src/services/jobs/filters";
import { embeddingProducerQueue } from "./queues";

/**
 * Hourly task to backfill missing embeddings for jobs and candidates.
 *
 * Jobs without embeddings are invisible to semantic search and matching.
 * This guarantees eventual consistency even if real-time enrichment fails.
 */
export const embeddingsBatchTask = schedules.task({
  id: "embeddings-batch",
  cron: {
    pattern: "15 6,10,14,18 * * *", // After each scrape window
    timezone: "Europe/Amsterdam",
  },
  // Share the same concurrency budget as other embedding-producing tasks.
  queue: embeddingProducerQueue,
  maxDuration: 600,
  machine: { preset: "small-1x" },
  retry: {
    maxAttempts: 2,
    factor: 2,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 30_000,
  },
  run: async () => {
    // --- Jobs without embeddings ---
    // Pick up ALL jobs without embeddings — even those without descriptions.
    // embedJob() now falls back to title + categories + requirements for embedding text.
    const jobsWithout = await db
      .select({ id: jobs.id, title: jobs.title })
      .from(jobs)
      .where(and(getVisibleVacancyCondition(), isNull(jobs.embedding)))
      .limit(50);

    let jobsEmbedded = 0;
    const jobErrors: string[] = [];

    const EMBEDDING_CONCURRENCY = 5;
    let nextIndex = 0;

    async function worker() {
      while (true) {
        const currentIndex = nextIndex++;
        if (currentIndex >= jobsWithout.length) break;
        const job = jobsWithout[currentIndex];
        try {
          const success = await embedJob(job.id);
          if (success) jobsEmbedded++;
        } catch (err) {
          jobErrors.push(`Job ${job.id} (${job.title}): ${String(err)}`);
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(EMBEDDING_CONCURRENCY, jobsWithout.length) }, () => worker()),
    );

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
