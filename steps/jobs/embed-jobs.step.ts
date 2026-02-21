import { StepConfig, Handlers } from "motia";
import { z } from "zod";
import { db } from "../../src/db";
import { jobs } from "../../src/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import {
  generateEmbedding,
  buildJobEmbeddingText,
  serializeEmbedding,
} from "../../src/services/embeddings";

export const config = {
  name: "EmbedJobs",
  description:
    "Genereer embeddings voor vacatures via OpenAI text-embedding-3-small",
  triggers: [
    {
      type: "queue",
      topic: "scrape.completed",
      input: z.object({
        platform: z.string(),
        jobsNew: z.number(),
        status: z.string(),
      }),
    },
  ],
  enqueues: [{ topic: "jobs.embedded" }],
  flows: ["recruitment-scraper"],
} as const satisfies StepConfig;

export const handler: Handlers<typeof config> = async (
  rawInput,
  { enqueue, logger },
) => {
  const input = rawInput as {
    platform: string;
    jobsNew: number;
    status: string;
  };

  // Skip if no new jobs or scrape failed
  if (input.jobsNew === 0) {
    logger.info("Geen nieuwe jobs, embedding overgeslagen");
    return;
  }
  if (input.status === "failed") {
    logger.info("Scrape mislukt, embedding overgeslagen");
    return;
  }

  // Query jobs without embeddings
  const unembeddedJobs = await db
    .select()
    .from(jobs)
    .where(and(isNull(jobs.embedding), isNull(jobs.deletedAt)))
    .limit(100);

  if (unembeddedJobs.length === 0) {
    logger.info("Alle jobs hebben al een embedding");
    return;
  }

  let embedded = 0;

  for (const job of unembeddedJobs) {
    try {
      const text = buildJobEmbeddingText(job);
      const embedding = await generateEmbedding(text);

      if (embedding === null) {
        logger.warn(
          "Geen OpenAI API key beschikbaar, embedding generatie overgeslagen",
        );
        return;
      }

      await db
        .update(jobs)
        .set({ embedding: serializeEmbedding(embedding) })
        .where(eq(jobs.id, job.id));

      embedded++;
    } catch (err) {
      logger.error(`Embedding fout voor job ${job.id}: ${String(err)}`);
    }
  }

  await enqueue({
    topic: "jobs.embedded",
    data: { platform: input.platform, embedded },
  });

  logger.info(`Embedding klaar: ${embedded} van ${unembeddedJobs.length} jobs`);
};
