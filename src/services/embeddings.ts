import { db } from "../db";
import { jobs, candidates } from "../db/schema";
import { and, isNull, isNotNull } from "drizzle-orm";

// ========== Embedding Generation ==========

/**
 * Generate an embedding vector using OpenAI text-embedding-3-small via fetch.
 * Returns null if no API key is available (graceful degradation).
 */
export async function generateEmbedding(
  text: string,
): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text.slice(0, 8000), // API limit ~8K tokens
    }),
  });

  if (!response.ok) {
    console.error(`Embedding API error: ${response.status}`);
    return null;
  }

  const data = (await response.json()) as {
    data: { embedding: number[] }[];
  };
  return data.data[0].embedding;
}

// ========== Vector Math ==========

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

// ========== Serialization ==========

export function serializeEmbedding(vec: number[]): string {
  return JSON.stringify(vec);
}

export function deserializeEmbedding(str: string): number[] {
  return JSON.parse(str) as number[];
}

// ========== Job Text Preparation ==========

/** Build a text representation of a job for embedding. */
export function buildJobEmbeddingText(job: {
  title: string;
  description?: string | null;
  requirements?: unknown;
  competences?: unknown;
  company?: string | null;
  location?: string | null;
}): string {
  const parts = [job.title];
  if (job.company) parts.push(job.company);
  if (job.location) parts.push(job.location);
  if (job.description) parts.push(job.description.slice(0, 2000));
  if (Array.isArray(job.requirements)) {
    const reqs = job.requirements
      .map((r: unknown) =>
        typeof r === "string" ? r : (r as { description?: string })?.description ?? "",
      )
      .filter(Boolean);
    if (reqs.length > 0) parts.push("Eisen: " + reqs.join(", "));
  }
  if (Array.isArray(job.competences)) {
    const comps = (job.competences as string[]).filter(Boolean);
    if (comps.length > 0) parts.push("Competenties: " + comps.join(", "));
  }
  return parts.join("\n");
}

/** Build a text representation of a candidate for embedding. */
export function buildCandidateEmbeddingText(candidate: {
  name: string;
  role?: string | null;
  skills?: unknown;
  experience?: string | null;
  tags?: unknown;
  location?: string | null;
}): string {
  const parts: string[] = [];
  if (candidate.role) parts.push(candidate.role);
  if (candidate.location) parts.push(candidate.location);
  if (candidate.experience) parts.push(candidate.experience.slice(0, 2000));
  if (Array.isArray(candidate.skills)) {
    const skills = (candidate.skills as string[]).filter(Boolean);
    if (skills.length > 0) parts.push("Skills: " + skills.join(", "));
  }
  if (Array.isArray(candidate.tags)) {
    const tags = (candidate.tags as string[]).filter(Boolean);
    if (tags.length > 0) parts.push("Tags: " + tags.join(", "));
  }
  return parts.join("\n");
}

// ========== Vector Search ==========

/**
 * Find the top-K most similar jobs to a given embedding.
 * Loads all job embeddings from DB and computes cosine similarity in-memory.
 * For <10K jobs this is fast enough; migrate to pgvector for scale.
 */
export async function findSimilarJobs(
  candidateEmbedding: number[],
  limit = 20,
): Promise<{ jobId: string; score: number }[]> {
  const rows = await db
    .select({ id: jobs.id, embedding: jobs.embedding })
    .from(jobs)
    .where(and(isNull(jobs.deletedAt), isNotNull(jobs.embedding)));

  const scored = rows
    .map((row) => {
      const jobVec = deserializeEmbedding(row.embedding!);
      return { jobId: row.id, score: cosineSimilarity(candidateEmbedding, jobVec) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored;
}

/**
 * Find the top-K most similar candidates to a given job embedding.
 */
export async function findSimilarCandidates(
  jobEmbedding: number[],
  limit = 20,
): Promise<{ candidateId: string; score: number }[]> {
  const rows = await db
    .select({ id: candidates.id, embedding: candidates.embedding })
    .from(candidates)
    .where(and(isNull(candidates.deletedAt), isNotNull(candidates.embedding)));

  const scored = rows
    .map((row) => {
      const candidateVec = deserializeEmbedding(row.embedding!);
      return { candidateId: row.id, score: cosineSimilarity(jobEmbedding, candidateVec) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored;
}
