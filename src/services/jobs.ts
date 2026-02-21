import { db } from "../db";
import { jobs } from "../db/schema";
import { and, desc, eq, isNull, ilike } from "drizzle-orm";

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
