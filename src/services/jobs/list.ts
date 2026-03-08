import { and, desc, ilike, sql } from "drizzle-orm";
import { db } from "../../db";
import { jobs } from "../../db/schema";
import { escapeLike, toTsQueryInput } from "../../lib/helpers";
import type { OpdrachtenHoursBucket, OpdrachtenRegion } from "../../lib/opdrachten-filters";
import { LIST_SLO_MS, logSlowQuery } from "../../lib/query-observability";
import {
  getJobStatusCondition,
  getListJobsOrderBy,
  type JobStatus,
  type ListJobsSortBy,
} from "./filters";
import { buildJobFilterConditions } from "./query-filters";
import type { Job } from "./repository";

export type ListJobsOptions = {
  limit?: number;
  offset?: number;
  platform?: string;
  company?: string;
  endClient?: string;
  category?: string;
  categories?: string[];
  status?: JobStatus;
  q?: string;
  province?: string;
  region?: OpdrachtenRegion;
  regions?: OpdrachtenRegion[];
  rateMin?: number;
  rateMax?: number;
  contractType?: string;
  workArrangement?: string;
  hoursPerWeekBucket?: OpdrachtenHoursBucket;
  minHoursPerWeek?: number;
  maxHoursPerWeek?: number;
  radiusKm?: number;
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
  const conditions = buildJobFilterConditions({
    platform: opts.platform,
    company: opts.company,
    endClient: opts.endClient,
    category: opts.category,
    categories: opts.categories,
    status: opts.status,
    province: opts.province,
    region: opts.region,
    regions: opts.regions,
    rateMin: opts.rateMin,
    rateMax: opts.rateMax,
    contractType: opts.contractType,
    workArrangement: opts.workArrangement,
    hasDescription: opts.hasDescription,
    postedAfter: opts.postedAfter,
    postedBefore: opts.postedBefore,
    deadlineAfter: opts.deadlineAfter,
    deadlineBefore: opts.deadlineBefore,
    startDateAfter: opts.startDateAfter,
    startDateBefore: opts.startDateBefore,
    hoursPerWeekBucket: opts.hoursPerWeekBucket,
    minHoursPerWeek: opts.minHoursPerWeek,
    maxHoursPerWeek: opts.maxHoursPerWeek,
    radiusKm: opts.radiusKm,
  });

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
