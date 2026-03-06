import { and, desc, eq, gte, ilike, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "../../db";
import { jobs } from "../../db/schema";
import { escapeLike, toTsQueryInput } from "../../lib/helpers";
import { LIST_SLO_MS, logSlowQuery } from "../../lib/query-observability";
import {
  getJobStatusCondition,
  getListJobsOrderBy,
  type JobStatus,
  type ListJobsSortBy,
} from "./filters";
import type { Job } from "./repository";

export type ListJobsOptions = {
  limit?: number;
  offset?: number;
  platform?: string;
  company?: string;
  endClient?: string;
  category?: string;
  status?: JobStatus;
  q?: string;
  province?: string;
  rateMin?: number;
  rateMax?: number;
  contractType?: string;
  workArrangement?: string;
  hasDescription?: boolean;
  sortBy?: ListJobsSortBy;
  postedAfter?: Date | string;
  postedBefore?: Date | string;
  deadlineAfter?: Date | string;
  deadlineBefore?: Date | string;
  startDateAfter?: Date | string;
  startDateBefore?: Date | string;
};

/** Alle opdrachten ophalen met paginering. */
export async function listJobs(
  opts: ListJobsOptions = {},
): Promise<{ data: Job[]; total: number }> {
  const start = Date.now();
  const limit = Math.min(opts.limit ?? 50, 100);
  const offset = opts.offset ?? 0;
  const conditions = [getJobStatusCondition(opts.status ?? "open")];

  if (opts.platform) conditions.push(eq(jobs.platform, opts.platform));
  if (opts.company) conditions.push(eq(jobs.company, opts.company));
  if (opts.endClient) {
    conditions.push(
      or(
        eq(jobs.endClient, opts.endClient),
        and(isNull(jobs.endClient), eq(jobs.company, opts.endClient)),
      ),
    );
  }
  if (opts.category) conditions.push(sql`${jobs.categories} ? ${opts.category}`);

  if (opts.q) {
    const tsInput = toTsQueryInput(opts.q);
    if (tsInput) {
      conditions.push(
        sql`to_tsvector('dutch', coalesce(${jobs.title}, '') || ' ' || coalesce(${jobs.company}, '') || ' ' || coalesce(${jobs.description}, '') || ' ' || coalesce(${jobs.location}, '') || ' ' || coalesce(${jobs.province}, '')) @@ to_tsquery('dutch', ${tsInput})`,
      );
    } else {
      conditions.push(ilike(jobs.title, `%${escapeLike(opts.q)}%`));
    }
  }

  if (opts.province) {
    const provinceMatch = or(
      ilike(jobs.province, `%${escapeLike(opts.province)}%`),
      ilike(jobs.location, `%${escapeLike(opts.province)}%`),
    );
    if (provinceMatch) conditions.push(provinceMatch);
  }

  if (opts.rateMin != null) conditions.push(gte(jobs.rateMax, opts.rateMin));
  if (opts.rateMax != null) conditions.push(lte(jobs.rateMin, opts.rateMax));
  if (opts.contractType) conditions.push(eq(jobs.contractType, opts.contractType));
  if (opts.workArrangement) conditions.push(eq(jobs.workArrangement, opts.workArrangement));
  if (opts.hasDescription) conditions.push(isNotNull(jobs.description));

  if (opts.postedAfter) conditions.push(gte(jobs.postedAt, new Date(opts.postedAfter)));
  if (opts.postedBefore) conditions.push(lte(jobs.postedAt, new Date(opts.postedBefore)));
  if (opts.deadlineAfter)
    conditions.push(gte(jobs.applicationDeadline, new Date(opts.deadlineAfter)));
  if (opts.deadlineBefore)
    conditions.push(lte(jobs.applicationDeadline, new Date(opts.deadlineBefore)));
  if (opts.startDateAfter) conditions.push(gte(jobs.startDate, new Date(opts.startDateAfter)));
  if (opts.startDateBefore) conditions.push(lte(jobs.startDate, new Date(opts.startDateBefore)));

  const whereClause = and(...conditions);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobs)
    .where(whereClause);

  const data = await db
    .select()
    .from(jobs)
    .where(whereClause)
    .orderBy(getListJobsOrderBy(opts.sortBy ?? "nieuwste"))
    .limit(limit)
    .offset(offset);

  logSlowQuery("listJobs", Date.now() - start, LIST_SLO_MS, {
    limit,
    offset,
    total: count,
  });
  return { data, total: count };
}

/** Alle actieve (niet-verwijderde, deadline niet verstreken) jobs ophalen. Hogere limiet voor batch matching. */
export async function listActiveJobs(limit?: number): Promise<Job[]> {
  const safeLimit = Math.min(limit ?? 200, 500);

  return db
    .select()
    .from(jobs)
    .where(getJobStatusCondition("open"))
    .orderBy(desc(jobs.scrapedAt))
    .limit(safeLimit);
}
