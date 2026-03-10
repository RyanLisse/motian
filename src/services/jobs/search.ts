import { and, desc, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "../../db";
import { jobs } from "../../db/schema";
import { escapeLike, toTsQueryInput } from "../../lib/helpers";
import type { OpdrachtenHoursBucket, OpdrachtenRegion } from "../../lib/opdrachten-filters";
import { logSlowQuery, SEARCH_SLO_MS } from "../../lib/query-observability";
import {
  getJobStatusCondition,
  getSortComparator,
  type JobStatus,
  type ListJobsSortBy,
} from "./filters";
import { buildJobFilterConditions } from "./query-filters";
import { type Job, jobReadSelection } from "./repository";

export type SearchJobsOptions = {
  platform?: string;
  limit?: number;
  status?: JobStatus;
};

export type HybridSearchOptions = {
  limit?: number;
  offset?: number;
  platform?: string;
  company?: string;
  endClient?: string;
  category?: string;
  categories?: string[];
  status?: JobStatus;
  province?: string;
  region?: OpdrachtenRegion;
  regions?: OpdrachtenRegion[];
  rateMin?: number;
  rateMax?: number;
  contractType?: string;
  workArrangement?: string;
  postedBefore?: Date | string;
  deadlineAfter?: Date | string;
  sortBy?: ListJobsSortBy;
  postedAfter?: Date | string;
  deadlineBefore?: Date | string;
  startDateAfter?: Date | string;
  startDateBefore?: Date | string;
  hoursPerWeekBucket?: OpdrachtenHoursBucket;
  minHoursPerWeek?: number;
  maxHoursPerWeek?: number;
  radiusKm?: number;
};

export type HybridSearchResult = {
  data: Array<Job & { score: number }>;
  total: number;
};

function buildHybridSearchFilterConditions(opts: HybridSearchOptions) {
  return buildJobFilterConditions({
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
}

/** Opdrachten zoeken op titel/omschrijving met full-text search (tsvector/GIN).
 * Falls back to ILIKE if the FTS query produces no results. */
export async function searchJobsByTitle(
  query: string,
  limit?: number,
  status: JobStatus = "open",
): Promise<Job[]> {
  const safeLimit = Math.min(limit ?? 50, 100);
  const tsInput = toTsQueryInput(query);
  const statusCondition = getJobStatusCondition(status);

  if (tsInput) {
    const ftsResults = await db
      .select(jobReadSelection)
      .from(jobs)
      .where(
        and(
          statusCondition,
          sql`to_tsvector('dutch', coalesce(${jobs.title}, '') || ' ' || coalesce(${jobs.company}, '') || ' ' || coalesce(${jobs.description}, '') || ' ' || coalesce(${jobs.location}, '') || ' ' || coalesce(${jobs.province}, '')) @@ to_tsquery('dutch', ${tsInput})`,
        ),
      )
      .orderBy(
        sql`ts_rank(to_tsvector('dutch', coalesce(${jobs.title}, '') || ' ' || coalesce(${jobs.company}, '') || ' ' || coalesce(${jobs.description}, '') || ' ' || coalesce(${jobs.location}, '') || ' ' || coalesce(${jobs.province}, '')), to_tsquery('dutch', ${tsInput})) DESC`,
      )
      .limit(safeLimit);

    if (ftsResults.length > 0) return ftsResults;
  }

  const words = query.trim().split(/\s+/).filter(Boolean);
  const titleConditions =
    words.length > 1
      ? or(...words.map((w) => ilike(jobs.title, `%${escapeLike(w)}%`)))
      : ilike(jobs.title, `%${escapeLike(query)}%`);

  return db
    .select(jobReadSelection)
    .from(jobs)
    .where(and(statusCondition, titleConditions))
    .orderBy(desc(jobs.scrapedAt))
    .limit(safeLimit);
}

/** Opdrachten zoeken, optioneel gefilterd op platform. Soft-deleted rijen worden uitgesloten. */
export async function searchJobs(opts: SearchJobsOptions = {}): Promise<Job[]> {
  const limit = Math.min(opts.limit ?? 50, 100);
  const conditions = buildJobFilterConditions({
    platform: opts.platform,
    status: opts.status ?? "open",
  });

  return db
    .select(jobReadSelection)
    .from(jobs)
    .where(and(...conditions))
    .orderBy(desc(jobs.scrapedAt))
    .limit(limit);
}

/** Hybrid zoeken: combineert tekst (ILIKE) + vector (pgvector) met Reciprocal Rank Fusion. */
export async function hybridSearchWithTotal(
  query: string,
  opts: HybridSearchOptions = {},
): Promise<HybridSearchResult> {
  const start = Date.now();
  const limit = Math.min(opts.limit ?? 20, 100);
  const offset = Math.max(opts.offset ?? 0, 0);
  const k = 60;
  const fetchSize = Math.min(Math.max((offset + limit) * 3, limit * 3), 100);
  const requestedStatus = opts.status ?? "open";

  const [textResults, vectorResults] = await Promise.all([
    searchJobsByTitle(query, fetchSize, requestedStatus),
    (async () => {
      try {
        const { findSimilarJobs } = await import("../embedding");
        return await findSimilarJobs(query, { limit: fetchSize, minScore: 0.3 });
      } catch {
        return [];
      }
    })(),
  ]);

  const scoreMap = new Map<string, { rrfScore: number; job?: Job }>();

  textResults.forEach((job, rank) => {
    const entry = scoreMap.get(job.id) ?? { rrfScore: 0 };
    entry.rrfScore += 1 / (k + rank + 1);
    scoreMap.set(job.id, entry);
  });

  vectorResults.forEach((match, rank) => {
    const entry = scoreMap.get(match.id) ?? { rrfScore: 0 };
    entry.rrfScore += 1 / (k + rank + 1);
    scoreMap.set(match.id, entry);
  });

  const candidateIds = [...scoreMap.keys()];
  if (candidateIds.length === 0) {
    logSlowQuery("hybridSearch", Date.now() - start, SEARCH_SLO_MS, {
      query: query.slice(0, 80),
      results: 0,
    });
    return { data: [], total: 0 };
  }

  const fetchedJobs = await db
    .select(jobReadSelection)
    .from(jobs)
    .where(
      and(
        inArray(jobs.id, candidateIds),
        ...buildHybridSearchFilterConditions({ ...opts, status: requestedStatus }),
      ),
    );

  const fetchMap = new Map(fetchedJobs.map((job) => [job.id, job]));
  for (const [id, entry] of scoreMap) {
    entry.job = fetchMap.get(id);
  }

  const filtered = [...scoreMap.entries()]
    .sort((a, b) => b[1].rrfScore - a[1].rrfScore)
    .filter(([, value]) => value.job);

  if (opts.sortBy) {
    const sortFn = getSortComparator(opts.sortBy);
    filtered.sort((a, b) => {
      const jobA = a[1].job;
      const jobB = b[1].job;
      if (!jobA || !jobB) return 0;
      return sortFn(jobA, jobB);
    });
  }

  const total = filtered.length;
  const data = filtered.slice(offset, offset + limit).map(([, value]) => ({
    ...(value.job as NonNullable<typeof value.job>),
    score: Math.round(value.rrfScore * 10000) / 10000,
  }));
  logSlowQuery("hybridSearch", Date.now() - start, SEARCH_SLO_MS, {
    query: query.slice(0, 80),
    results: data.length,
    total,
    offset,
  });
  return { data, total };
}

export async function hybridSearch(
  query: string,
  opts: HybridSearchOptions = {},
): Promise<Array<Job & { score: number }>> {
  return (await hybridSearchWithTotal(query, opts)).data;
}
