import { db } from "../db";
import { jobs } from "../db/schema";
import { desc, eq, isNull } from "drizzle-orm";

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

  const baseQuery = db
    .select()
    .from(jobs)
    .where(isNull(jobs.deletedAt));

  const filtered = opts.platform
    ? baseQuery.where(eq(jobs.platform, opts.platform))
    : baseQuery;

  return filtered.orderBy(desc(jobs.scrapedAt)).limit(limit);
}
