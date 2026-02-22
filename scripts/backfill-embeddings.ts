/**
 * Backfill embeddings for existing enriched jobs.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/backfill-embeddings.ts --limit 200
 *   npx tsx --env-file=.env.local scripts/backfill-embeddings.ts --platform opdrachtoverheid --limit 100
 */
import { db } from "../src/db";
import { jobs } from "../src/db/schema";
import { and, eq, isNull, isNotNull } from "drizzle-orm";
import { buildJobEmbeddingText, generateEmbeddings } from "../src/services/embedding";

async function main() {
  const args = process.argv.slice(2);
  let platform: string | undefined;
  let limit = 200;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--platform" && args[i + 1]) {
      platform = args[i + 1];
      i++;
    }
    if (args[i] === "--limit" && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    }
  }

  console.log(`Backfill embeddings: platform=${platform ?? "all"}, limit=${limit}`);

  const conditions = [
    isNull(jobs.deletedAt),
    isNotNull(jobs.descriptionSummary),
    isNull(jobs.embedding),
  ];
  if (platform) conditions.push(eq(jobs.platform, platform));

  const unembedded = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      descriptionSummary: jobs.descriptionSummary,
      categories: jobs.categories,
      requirements: jobs.requirements,
    })
    .from(jobs)
    .where(and(...conditions))
    .limit(limit);

  console.log(`Found ${unembedded.length} jobs to embed`);

  if (unembedded.length === 0) {
    console.log("Nothing to do.");
    process.exit(0);
  }

  const texts = unembedded.map((job) => buildJobEmbeddingText(job));

  console.log("Generating embeddings...");
  const embeddings = await generateEmbeddings(texts);

  let written = 0;
  let errors = 0;
  const DB_BATCH = 50;

  for (let i = 0; i < unembedded.length; i += DB_BATCH) {
    const batch = unembedded.slice(i, i + DB_BATCH);
    const batchEmbeddings = embeddings.slice(i, i + DB_BATCH);

    const promises = batch.map((job, idx) =>
      db
        .update(jobs)
        .set({ embedding: batchEmbeddings[idx] })
        .where(eq(jobs.id, job.id))
        .then(() => {
          written++;
        })
        .catch((err) => {
          errors++;
          console.error(`Error writing embedding for ${job.id}:`, err);
        }),
    );

    await Promise.all(promises);
    console.log(`  Progress: ${Math.min(i + DB_BATCH, unembedded.length)}/${unembedded.length}`);
  }

  console.log(`\nResults:`);
  console.log(`  Embedded: ${written}`);
  console.log(`  Errors:   ${errors}`);

  process.exit(errors > 0 ? 1 : 0);
}

main();
