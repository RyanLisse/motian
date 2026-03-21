import { and, db, eq, isNull, type SQL, sql } from "../db";
import { candidates, jobs } from "../db/schema";
import {
  tracedEmbed as embed,
  embeddingModel,
  tracedEmbedMany as embedMany,
} from "../lib/ai-models";
import { withRetry } from "../lib/retry";

// ========== Config ==========

const EMBEDDING_MODEL = embeddingModel;
const EMBEDDING_OPTIONS = { openai: { dimensions: 512 } };

const BATCH_SIZE = 100;
const MAX_JOB_DESCRIPTION_EMBEDDING_CHARS = 4_000;
const MIN_JOB_EMBEDDING_SOURCE_CHARS = 5;
const MAX_RESUME_EMBEDDING_CHARS = 2_000;
const MAX_QUERY_EMBEDDING_CHARS = 512;
const QUERY_EMBEDDING_CACHE_TTL_MS = 5 * 60 * 1000;
const QUERY_EMBEDDING_CACHE_MAX_ENTRIES = 256;

type CachedQueryEmbedding = {
  embedding: number[];
  expiresAt: number;
};

const queryEmbeddingCache = new Map<string, CachedQueryEmbedding>();
const inflightQueryEmbeddings = new Map<string, Promise<number[]>>();

function toBoundedJobDescriptionText(description: string | null | undefined): string | null {
  if (typeof description !== "string") return null;

  const normalized = description.replace(/\s+/g, " ").trim();
  if (normalized.length === 0) return null;

  return normalized.slice(0, MAX_JOB_DESCRIPTION_EMBEDDING_CHARS);
}

function toBoundedResumeText(resumeRaw: string | null | undefined): string | null {
  if (typeof resumeRaw !== "string") return null;

  const normalized = resumeRaw.replace(/\s+/g, " ").trim();
  if (normalized.length === 0) return null;

  return normalized.slice(0, MAX_RESUME_EMBEDDING_CHARS);
}

export function normalizeQueryEmbeddingText(query: string): string {
  return query
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("nl-NL")
    .slice(0, MAX_QUERY_EMBEDDING_CHARS);
}

export type QueryEmbeddingSignal = {
  normalizedQuery: string;
  characterCount: number;
  termCount: number;
};

export function getQueryEmbeddingSignal(query: string): QueryEmbeddingSignal {
  const normalizedQuery = normalizeQueryEmbeddingText(query);
  return {
    normalizedQuery,
    characterCount: normalizedQuery.length,
    termCount: normalizedQuery.length === 0 ? 0 : normalizedQuery.split(" ").length,
  };
}

function getCachedQueryEmbedding(key: string): number[] | null {
  const cached = queryEmbeddingCache.get(key);
  if (!cached) return null;

  if (cached.expiresAt <= Date.now()) {
    queryEmbeddingCache.delete(key);
    return null;
  }

  queryEmbeddingCache.delete(key);
  queryEmbeddingCache.set(key, cached);
  return cached.embedding;
}

function setCachedQueryEmbedding(key: string, embedding: number[]) {
  queryEmbeddingCache.delete(key);
  queryEmbeddingCache.set(key, {
    embedding,
    expiresAt: Date.now() + QUERY_EMBEDDING_CACHE_TTL_MS,
  });

  while (queryEmbeddingCache.size > QUERY_EMBEDDING_CACHE_MAX_ENTRIES) {
    const oldestKey = queryEmbeddingCache.keys().next().value;
    if (!oldestKey) break;
    queryEmbeddingCache.delete(oldestKey);
  }
}

// ========== Text Preparation ==========

export function buildJobEmbeddingText(job: {
  title: string;
  descriptionSummary: unknown;
  description?: string | null;
  categories: unknown;
  requirements: unknown;
}): string {
  const parts: string[] = [job.title];
  const sourceText = getJobEmbeddingSourceText(job);

  if (sourceText) parts.push(sourceText);

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

export function getJobEmbeddingSourceText(job: {
  descriptionSummary: unknown;
  description?: string | null;
}): string | null {
  if (
    job.descriptionSummary &&
    typeof job.descriptionSummary === "object" &&
    job.descriptionSummary !== null
  ) {
    const summary = job.descriptionSummary as { nl?: string; en?: string };
    const summaryParts = [summary.nl, summary.en].filter(
      (part): part is string => typeof part === "string" && part.trim().length > 0,
    );

    if (summaryParts.length > 0) return summaryParts.join("\n");
  }

  return toBoundedJobDescriptionText(job.description);
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

export async function generateQueryEmbedding(query: string): Promise<number[]> {
  const { normalizedQuery } = getQueryEmbeddingSignal(query);
  if (normalizedQuery.length === 0) {
    return generateEmbedding(query);
  }

  const cached = getCachedQueryEmbedding(normalizedQuery);
  if (cached) return cached;

  const inflight = inflightQueryEmbeddings.get(normalizedQuery);
  if (inflight) return inflight;

  const pending = generateEmbedding(normalizedQuery)
    .then((embedding) => {
      setCachedQueryEmbedding(normalizedQuery, embedding);
      return embedding;
    })
    .finally(() => {
      inflightQueryEmbeddings.delete(normalizedQuery);
    });

  inflightQueryEmbeddings.set(normalizedQuery, pending);
  return pending;
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
      description: jobs.description,
      categories: jobs.categories,
      requirements: jobs.requirements,
    })
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .limit(1);

  if (!job) return false;

  const sourceText = getJobEmbeddingSourceText(job);
  if (!sourceText || sourceText.length < MIN_JOB_EMBEDDING_SOURCE_CHARS) return false;

  const text = buildJobEmbeddingText(job);
  const embedding = await generateEmbedding(text);

  await db.update(jobs).set({ embedding: JSON.stringify(embedding) }).where(eq(jobs.id, jobId));

  return true;
}

// ========== Candidate Text Preparation ==========

export function buildCandidateEmbeddingText(candidate: {
  name: string;
  role: string | null;
  skills: unknown;
  experience: unknown;
  location: string | null;
  profileSummary?: string | null;
  notes?: string | null;
  resumeRaw?: string | null;
}): string {
  const parts: string[] = [];

  if (candidate.role) parts.push(candidate.role);
  if (candidate.profileSummary) parts.push(`Profiel: ${candidate.profileSummary}`);

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

  const notes = candidate.notes?.replace(/\s+/g, " ").trim();
  if (notes) parts.push(`Notities: ${notes}`);

  const resumeText = toBoundedResumeText(candidate.resumeRaw);
  if (resumeText) parts.push(`CV: ${resumeText}`);

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
      profileSummary: candidates.profileSummary,
      notes: candidates.notes,
      resumeRaw: candidates.resumeRaw,
    })
    .from(candidates)
    .where(eq(candidates.id, candidateId))
    .limit(1);

  if (!row) return false;

  const text = buildCandidateEmbeddingText(row);
  if (text.length < 5) return false;

  const embedding = await generateEmbedding(text);
  await db.update(candidates).set({ embedding: JSON.stringify(embedding) }).where(eq(candidates.id, candidateId));

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
      profileSummary: candidates.profileSummary,
      notes: candidates.notes,
      resumeRaw: candidates.resumeRaw,
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

  // Batch update all embeddings in parallel instead of sequential loop
  const updateResults = await Promise.allSettled(
    validIndices.map((idx, i) =>
      db
        .update(candidates)
        .set({ embedding: JSON.stringify(embeddings[i]) })
        .where(eq(candidates.id, rows[idx].id)),
    ),
  );

  for (let i = 0; i < updateResults.length; i++) {
    if (updateResults[i].status === "fulfilled") {
      embedded++;
    } else {
      errors.push(
        `Candidate ${rows[validIndices[i]].id}: ${String((updateResults[i] as PromiseRejectedResult).reason)}`,
      );
    }
  }

  return { embedded, skipped, errors };
}

// ========== Similarity Search ==========

export async function findSimilarJobs(
  query: string,
  opts: { limit?: number; minScore?: number; filterCondition?: SQL } = {},
): Promise<Array<{ id: string; title: string; similarity: number }>> {
  const queryEmbedding = await generateQueryEmbedding(query);
  return findSimilarJobsByEmbedding(queryEmbedding, opts);
}

export async function findSimilarJobsByEmbedding(
  queryEmbedding: number[],
  opts: { limit?: number; minScore?: number; filterCondition?: SQL } = {},
): Promise<Array<{ id: string; title: string; similarity: number }>> {
  const limit = opts.limit ?? 10;
  const minScore = opts.minScore ?? 0.5;
  const filterCondition = opts.filterCondition ?? sql`true`;
  const vectorStr = `[${queryEmbedding.join(",")}]`;

  const result = await (
    db as unknown as {
      execute(
        sql: SQL,
      ): Promise<{ rows: Array<{ id: string; title: string; similarity: number }> }>;
    }
  ).execute(sql`
    SELECT
      id,
      title,
      1 - vector_distance_cos(embedding, vector32(${vectorStr})) AS similarity
    FROM jobs
    WHERE embedding IS NOT NULL
      AND deleted_at IS NULL
      AND ${filterCondition}
      AND 1 - vector_distance_cos(embedding, vector32(${vectorStr})) >= ${minScore}
    ORDER BY vector_distance_cos(embedding, vector32(${vectorStr}))
    LIMIT ${limit}
  `);
  const rows = result.rows;

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    similarity: Number(r.similarity),
  }));
}
