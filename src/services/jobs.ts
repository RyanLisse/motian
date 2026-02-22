import { db } from "../db";
import { jobs } from "../db/schema";
import { and, desc, eq, gte, lte, isNull, isNotNull, ilike, sql } from "drizzle-orm";

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

/** Opdrachten zoeken op titel. */
export async function searchJobsByTitle(
  query: string,
  limit?: number,
): Promise<Job[]> {
  const safeLimit = Math.min(limit ?? 50, 100);
  return db
    .select()
    .from(jobs)
    .where(and(isNull(jobs.deletedAt), ilike(jobs.title, `%${query}%`)))
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

/** Opdracht soft-deleten. Retourneert true als gevonden en verwijderd. */
export async function deleteJob(id: string): Promise<boolean> {
  const rows = await db
    .update(jobs)
    .set({ deletedAt: new Date() })
    .where(and(eq(jobs.id, id), isNull(jobs.deletedAt)))
    .returning();

  return rows.length > 0;
}
