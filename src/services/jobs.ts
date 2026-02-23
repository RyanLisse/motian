import { db } from "../db";
import { jobs } from "../db/schema";
import { and, desc, eq, gte, lte, isNull, isNotNull, ilike, or, sql } from "drizzle-orm";

// ========== Types ==========

export type Job = typeof jobs.$inferSelect;

export type SearchJobsOptions = {
  platform?: string;
  limit?: number;
};

// ========== Service Functions ==========

/** Enkele opdracht ophalen op ID, of null als niet gevonden. */
export async function getJobById(id: string): Promise<Job | null> {
  const rows = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, id), isNull(jobs.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

/** Opdrachten zoeken op titel. Splits multi-word queries into OR conditions. */
export async function searchJobsByTitle(
  query: string,
  limit?: number,
): Promise<Job[]> {
  const safeLimit = Math.min(limit ?? 50, 100);
  const words = query.trim().split(/\s+/).filter(Boolean);
  const titleConditions = words.length > 1
    ? or(...words.map((w) => ilike(jobs.title, `%${w}%`)))
    : ilike(jobs.title, `%${query}%`);
  return db
    .select()
    .from(jobs)
    .where(and(isNull(jobs.deletedAt), titleConditions))
    .orderBy(desc(jobs.scrapedAt))
    .limit(safeLimit);
}

/** Opdrachten zoeken, optioneel gefilterd op platform. Soft-deleted rijen worden uitgesloten. */
export async function searchJobs(
  opts: SearchJobsOptions = {},
): Promise<Job[]> {
  const limit = Math.min(opts.limit ?? 50, 100);

  const conditions = [isNull(jobs.deletedAt)];

  if (opts.platform) {
    conditions.push(eq(jobs.platform, opts.platform));
  }

  return db
    .select()
    .from(jobs)
    .where(and(...conditions))
    .orderBy(desc(jobs.scrapedAt))
    .limit(limit);
}

/** Alle opdrachten ophalen met paginering. */
export async function listJobs(
  opts: {
    limit?: number;
    offset?: number;
    platform?: string;
    q?: string;
    province?: string;
    rateMin?: number;
    rateMax?: number;
    contractType?: string;
    hasDescription?: boolean;
  } = {},
): Promise<{ data: Job[]; total: number }> {
  const limit = Math.min(opts.limit ?? 50, 100);
  const offset = opts.offset ?? 0;

  const conditions = [isNull(jobs.deletedAt)];

  if (opts.platform) {
    conditions.push(eq(jobs.platform, opts.platform));
  }

  if (opts.q) {
    conditions.push(ilike(jobs.title, `%${opts.q}%`));
  }

  if (opts.province) {
    conditions.push(eq(jobs.province, opts.province));
  }

  if (opts.rateMin != null) {
    conditions.push(gte(jobs.rateMax, opts.rateMin));
  }

  if (opts.rateMax != null) {
    conditions.push(lte(jobs.rateMin, opts.rateMax));
  }

  if (opts.contractType) {
    conditions.push(eq(jobs.contractType, opts.contractType));
  }

  if (opts.hasDescription) {
    conditions.push(isNotNull(jobs.description));
  }

  const whereClause = and(...conditions);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobs)
    .where(whereClause);

  const data = await db
    .select()
    .from(jobs)
    .where(whereClause)
    .orderBy(desc(jobs.scrapedAt))
    .limit(limit)
    .offset(offset);

  return { data, total: count };
}

/** Opdracht bijwerken. Retourneert bijgewerkte job of null. */
export async function updateJob(
  id: string,
  data: Partial<
    Pick<
      Job,
      | "title"
      | "description"
      | "location"
      | "rateMin"
      | "rateMax"
      | "contractType"
      | "workArrangement"
    >
  >,
): Promise<Job | null> {
  const rows = await db
    .update(jobs)
    .set(data)
    .where(and(eq(jobs.id, id), isNull(jobs.deletedAt)))
    .returning();

  return rows[0] ?? null;
}

/** Opdracht verrijken met AI-geëxtraheerde data. Retourneert bijgewerkte job of null. */
export async function updateJobEnrichment(
  id: string,
  data: Partial<
    Pick<
      Job,
      | "educationLevel"
      | "workExperienceYears"
      | "workArrangement"
      | "languages"
      | "durationMonths"
      | "extensionPossible"
      | "descriptionSummary"
      | "categories"
    >
  >,
): Promise<Job | null> {
  const rows = await db
    .update(jobs)
    .set(data)
    .where(and(eq(jobs.id, id), isNull(jobs.deletedAt)))
    .returning();

  return rows[0] ?? null;
}

/** Hybrid zoeken: combineert tekst (ILIKE) + vector (pgvector) met Reciprocal Rank Fusion. */
export async function hybridSearch(
  query: string,
  opts: { limit?: number; platform?: string } = {},
): Promise<Array<Job & { score: number }>> {
  const limit = Math.min(opts.limit ?? 20, 100);
  const k = 60; // RRF constant — higher = more weight to lower-ranked results

  // Run text search + vector search in parallel
  const [textResults, vectorResults] = await Promise.all([
    searchJobsByTitle(query, 50),
    (async () => {
      try {
        const { findSimilarJobs } = await import("./embedding");
        return await findSimilarJobs(query, { limit: 50, minScore: 0.3 });
      } catch {
        return []; // No embeddings available — fallback to text-only
      }
    })(),
  ]);

  // Build RRF score map: score = 1/(k + rank)
  const scoreMap = new Map<string, { rrfScore: number; job?: Job }>();

  textResults.forEach((job, rank) => {
    const id = job.id;
    const entry = scoreMap.get(id) ?? { rrfScore: 0 };
    entry.rrfScore += 1 / (k + rank + 1);
    entry.job = job;
    scoreMap.set(id, entry);
  });

  vectorResults.forEach((match, rank) => {
    const id = match.id;
    const entry = scoreMap.get(id) ?? { rrfScore: 0 };
    entry.rrfScore += 1 / (k + rank + 1);
    // If we don't have the full job object yet, we'll need to fetch it
    scoreMap.set(id, entry);
  });

  // Sort by combined RRF score descending
  const sorted = [...scoreMap.entries()]
    .sort((a, b) => b[1].rrfScore - a[1].rrfScore)
    .slice(0, limit);

  // Fetch full job objects for any vector-only results
  const needFetch = sorted.filter(([, v]) => !v.job).map(([id]) => id);
  if (needFetch.length > 0) {
    const fetched = await db
      .select()
      .from(jobs)
      .where(and(
        isNull(jobs.deletedAt),
        or(...needFetch.map((id) => eq(jobs.id, id))),
      ));
    const fetchMap = new Map(fetched.map((j) => [j.id, j]));
    for (const [id, entry] of scoreMap) {
      if (!entry.job && fetchMap.has(id)) {
        entry.job = fetchMap.get(id)!;
      }
    }
  }

  // Filter by platform if requested, and only return entries with job data
  return sorted
    .filter(([, v]) => v.job && (!opts.platform || v.job.platform === opts.platform))
    .map(([, v]) => ({ ...v.job!, score: Math.round(v.rrfScore * 10000) / 10000 }));
}

/** Opdracht soft-deleten. Retourneert true als gevonden en verwijderd. */
export async function deleteJob(id: string): Promise<boolean> {
  const rows = await db
    .update(jobs)
    .set({ deletedAt: new Date() })
    .where(and(eq(jobs.id, id), isNull(jobs.deletedAt)))
    .returning();

  return rows.length > 0;
}
