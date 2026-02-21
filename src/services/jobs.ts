import { db } from "../db";
import { jobs } from "../db/schema";
import { and, desc, eq, ilike, isNull } from "drizzle-orm";

// ========== Types ==========

export type Job = typeof jobs.$inferSelect;

export type SearchJobsOptions = {
  platform?: string;
  limit?: number;
};

// ========== Service Functions ==========

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

export async function getJobById(id: string): Promise<Job | null> {
  const [result] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, id), isNull(jobs.deletedAt)))
    .limit(1);
  return result ?? null;
}

export async function searchJobsByTitle(
  query: string,
  limit = 50,
): Promise<Job[]> {
  return db
    .select()
    .from(jobs)
    .where(and(ilike(jobs.title, `%${query}%`), isNull(jobs.deletedAt)))
    .orderBy(desc(jobs.scrapedAt))
    .limit(Math.min(limit, 100));
}
