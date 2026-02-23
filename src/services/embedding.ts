import { openai } from "@ai-sdk/openai";
import { embed, embedMany } from "ai";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { candidates, jobs } from "../db/schema";
import { withRetry } from "../lib/retry";

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
      .map((r: unknown) =>
        typeof r === "string"
          ? r
          : typeof r === "object" && r !== null && "description" in r
            ? (r as { description: string }).description
            : JSON.stringify(r),
      );
    parts.push(`Eisen: ${reqs.join("; ")}`);
  }

  return parts.join("\n");
}

// ========== Single Embedding ==========

export async function generateEmbedding(text: string): Promise<number[]> {
  const { embedding } = await withRetry(
    () =>
      embed({
        model: EMBEDDING_MODEL,
        value: text,
        providerOptions: EMBEDDING_OPTIONS,
      }),
    { label: "Embedding" },
  );
  return embedding;
}

// ========== Batch Embeddings ==========

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const { embeddings } = await withRetry(
      () =>
        embedMany({
          model: EMBEDDING_MODEL,
          values: batch,
          providerOptions: EMBEDDING_OPTIONS,
        }),
      { label: "Embedding" },
    );
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

  await db.update(jobs).set({ embedding }).where(eq(jobs.id, jobId));

  return true;
}

// ========== Candidate Text Preparation ==========

export function buildCandidateEmbeddingText(candidate: {
  name: string;
  role: string | null;
  skills: unknown;
  experience: unknown;
  location: string | null;
}): string {
  const parts: string[] = [];

  if (candidate.role) parts.push(candidate.role);

  if (Array.isArray(candidate.skills) && candidate.skills.length > 0) {
    parts.push(`Skills: ${candidate.skills.join(", ")}`);
  }

  if (Array.isArray(candidate.experience) && candidate.experience.length > 0) {
    const expTexts = candidate.experience
      .slice(0, 5)
      .map((e: unknown) =>
        typeof e === "string"
          ? e
          : typeof e === "object" && e !== null && "description" in e
            ? (e as { description: string }).description
            : typeof e === "object" && e !== null && "title" in e
              ? (e as { title: string }).title
              : "",
      )
      .filter(Boolean);
    if (expTexts.length > 0) parts.push(`Ervaring: ${expTexts.join("; ")}`);
  }

  if (candidate.location) parts.push(candidate.location);

  return parts.join("\n");
}

// ========== Embed Single Candidate ==========

export async function embedCandidate(candidateId: string): Promise<boolean> {
  const [row] = await db
    .select({
      id: candidates.id,
      name: candidates.name,
      role: candidates.role,
      skills: candidates.skills,
      experience: candidates.experience,
      location: candidates.location,
    })
    .from(candidates)
    .where(eq(candidates.id, candidateId))
    .limit(1);

  if (!row) return false;

  const text = buildCandidateEmbeddingText(row);
  if (text.length < 5) return false;

  const embedding = await generateEmbedding(text);
  await db.update(candidates).set({ embedding }).where(eq(candidates.id, candidateId));

  return true;
}

// ========== Backfill Candidate Embeddings ==========

export async function embedCandidatesBatch(opts: {
  limit?: number;
}): Promise<{ embedded: number; skipped: number; errors: string[] }> {
  const limit = Math.min(opts.limit ?? 100, 500);
  let embedded = 0;
  let skipped = 0;
  const errors: string[] = [];

  const rows = await db
    .select({
      id: candidates.id,
      name: candidates.name,
      role: candidates.role,
      skills: candidates.skills,
      experience: candidates.experience,
      location: candidates.location,
    })
    .from(candidates)
    .where(and(isNull(candidates.deletedAt), isNull(candidates.embedding)))
    .limit(limit);

  if (rows.length === 0) return { embedded, skipped, errors };

  const texts = rows.map((r) => buildCandidateEmbeddingText(r));
  const validIndices: number[] = [];
  const validTexts: string[] = [];

  for (let i = 0; i < texts.length; i++) {
    if (texts[i].length >= 5) {
      validIndices.push(i);
      validTexts.push(texts[i]);
    } else {
      skipped++;
    }
  }

  if (validTexts.length === 0) return { embedded, skipped, errors };

  const embeddings = await generateEmbeddings(validTexts);

  for (let i = 0; i < validIndices.length; i++) {
    try {
      const row = rows[validIndices[i]];
      await db
        .update(candidates)
        .set({ embedding: embeddings[i] })
        .where(eq(candidates.id, row.id));
      embedded++;
    } catch (err) {
      errors.push(`Candidate ${rows[validIndices[i]].id}: ${String(err)}`);
    }
  }

  return { embedded, skipped, errors };
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

  return (results.rows as Array<{ id: string; title: string; similarity: number }>).map((r) => ({
    id: r.id,
    title: r.title,
    similarity: Number(r.similarity),
  }));
}
