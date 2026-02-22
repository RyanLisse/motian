import { openai } from "@ai-sdk/openai";
import { embed, embedMany } from "ai";
import { db } from "../db";
import { jobs } from "../db/schema";
import { eq, sql } from "drizzle-orm";

// ========== Config ==========

const EMBEDDING_MODEL = openai.textEmbeddingModel("text-embedding-3-small");
const EMBEDDING_OPTIONS = { openai: { dimensions: 512 } };

const BATCH_SIZE = 100;

// ========== Text Preparation ==========

export function buildJobEmbeddingText(job: {
  title: string;
  descriptionSummary: unknown;
  categories: unknown;
  requirements: unknown;
}): string {
  const parts: string[] = [job.title];

  if (
    job.descriptionSummary &&
    typeof job.descriptionSummary === "object" &&
    job.descriptionSummary !== null
  ) {
    const summary = job.descriptionSummary as { nl?: string; en?: string };
    if (summary.nl) parts.push(summary.nl);
    if (summary.en) parts.push(summary.en);
  }

  if (Array.isArray(job.categories) && job.categories.length > 0) {
    parts.push(`Categorieën: ${job.categories.join(", ")}`);
  }

  if (Array.isArray(job.requirements) && job.requirements.length > 0) {
    const reqs = job.requirements
      .slice(0, 10)
      .map((r: unknown) => (typeof r === "string" ? r : typeof r === "object" && r !== null && "description" in r ? (r as { description: string }).description : JSON.stringify(r)));
    parts.push(`Eisen: ${reqs.join("; ")}`);
  }

  return parts.join("\n");
}

// ========== Single Embedding ==========

export async function generateEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: EMBEDDING_MODEL,
    value: text,
    providerOptions: EMBEDDING_OPTIONS,
  });
  return embedding;
}

// ========== Batch Embeddings ==========

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const { embeddings } = await embedMany({
      model: EMBEDDING_MODEL,
      values: batch,
      providerOptions: EMBEDDING_OPTIONS,
    });
    allEmbeddings.push(...embeddings);

    if (i + BATCH_SIZE < texts.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return allEmbeddings;
}

// ========== Embed Single Job ==========

export async function embedJob(jobId: string): Promise<boolean> {
  const [job] = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      descriptionSummary: jobs.descriptionSummary,
      categories: jobs.categories,
      requirements: jobs.requirements,
    })
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .limit(1);

  if (!job || !job.descriptionSummary) return false;

  const text = buildJobEmbeddingText(job);
  const embedding = await generateEmbedding(text);

  await db
    .update(jobs)
    .set({ embedding })
    .where(eq(jobs.id, jobId));

  return true;
}

// ========== Similarity Search ==========

export async function findSimilarJobs(
  query: string,
  opts: { limit?: number; minScore?: number } = {},
): Promise<Array<{ id: string; title: string; similarity: number }>> {
  const limit = opts.limit ?? 10;
  const minScore = opts.minScore ?? 0.5;

  const queryEmbedding = await generateEmbedding(query);
  const vectorStr = `[${queryEmbedding.join(",")}]`;

  const results = await db.execute(sql`
    SELECT
      id,
      title,
      1 - (embedding <=> ${vectorStr}::vector) AS similarity
    FROM jobs
    WHERE embedding IS NOT NULL
      AND deleted_at IS NULL
      AND 1 - (embedding <=> ${vectorStr}::vector) >= ${minScore}
    ORDER BY embedding <=> ${vectorStr}::vector
    LIMIT ${limit}
  `);

  return (results.rows as Array<{ id: string; title: string; similarity: number }>).map(
    (r) => ({
      id: r.id,
      title: r.title,
      similarity: Number(r.similarity),
    }),
  );
}
