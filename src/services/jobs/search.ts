import { and, ilike, inArray, or, type SQL, sql } from "drizzle-orm";
import { db } from "../../db";
import { jobs } from "../../db/schema";
import { escapeLike, toTsQueryInput } from "../../lib/helpers";
import type { OpdrachtenHoursBucket, OpdrachtenRegion } from "../../lib/opdrachten-filters";
import { logSlowQuery, SEARCH_SLO_MS } from "../../lib/query-observability";
import * as embeddingService from "../embedding";
import { collapseScoredJobsByVacancy, fetchDedupedJobIds, loadJobsByIds } from "./deduplication";
import {
  getJobStatusCondition,
  getSortComparator,
  type JobStatus,
  type ListJobsSortBy,
} from "./filters";
import { getHybridSearchPolicy } from "./hybrid-search-policy";
import { listJobs } from "./list";
import { buildJobFilterConditions } from "./query-filters";
import { jobReadSelection, type Job } from "./repository";

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
  escoUri?: string;
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
    escoUri: opts.escoUri,
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

function buildSearchFilterCondition(filterConditions: SQL[] = []): SQL {
  return filterConditions.length > 0 ? (and(...filterConditions) ?? sql`true`) : sql`true`;
}

type HybridSearchRankJob = Pick<
  Job,
  | "id"
  | "title"
  | "company"
  | "endClient"
  | "province"
  | "location"
  | "scrapedAt"
  | "rateMin"
  | "rateMax"
  | "applicationDeadline"
  | "postedAt"
  | "startDate"
>;

const hybridSearchRankSelection = {
  id: jobs.id,
  title: jobs.title,
  company: jobs.company,
  endClient: jobs.endClient,
  province: jobs.province,
  location: jobs.location,
  scrapedAt: jobs.scrapedAt,
  rateMin: jobs.rateMin,
  rateMax: jobs.rateMax,
  applicationDeadline: jobs.applicationDeadline,
  postedAt: jobs.postedAt,
  startDate: jobs.startDate,
};

function rankHybridCandidates<TJob extends HybridSearchRankJob>(
  scoreMap: Map<string, { rrfScore: number; job?: TJob }>,
  sortBy?: ListJobsSortBy,
) {
  const filtered = collapseScoredJobsByVacancy(
    [...scoreMap.values()]
      .filter((value): value is { rrfScore: number; job: TJob } => Boolean(value.job))
      .sort((a, b) => b.rrfScore - a.rrfScore)
      .map((value) => ({ job: value.job, score: value.rrfScore })),
  );

  if (sortBy) {
    const sortFn = getSortComparator(sortBy);
    filtered.sort((a, b) => sortFn(a.job as unknown as Job, b.job as unknown as Job));
  }

  return filtered;
}

async function searchJobIdsByTitle(
  query: string,
  opts: {
    limit?: number;
    filterCondition?: SQL;
  } = {},
): Promise<string[]> {
  const safeLimit = Math.min(opts.limit ?? 50, 100);
  const filterCondition = opts.filterCondition ?? sql`true`;
  const tsInput = toTsQueryInput(query);

  if (tsInput) {
    const searchVector = sql`to_tsvector('dutch', coalesce(${jobs.title}, '') || ' ' || coalesce(${jobs.company}, '') || ' ' || coalesce(${jobs.description}, '') || ' ' || coalesce(${jobs.location}, '') || ' ' || coalesce(${jobs.province}, ''))`;
    const searchRank = sql`ts_rank(${searchVector}, to_tsquery('dutch', ${tsInput}))`;
    const ftsIds = await fetchDedupedJobIds({
      whereClause:
        and(filterCondition, sql`${searchVector} @@ to_tsquery('dutch', ${tsInput})`) ??
        filterCondition,
      limit: safeLimit,
      partitionOrderBy: sql`${searchRank} desc, ${jobs.scrapedAt} desc nulls last, ${jobs.id} desc`,
      resultOrderBy: sql`search_rank desc nulls last, scraped_at desc nulls last, id desc`,
      extraSelections: sql`${searchRank} as search_rank`,
    });

    if (ftsIds.length > 0) return ftsIds;
  }

  const words = query.trim().split(/\s+/).filter(Boolean);
  const titleConditions =
    words.length > 1
      ? or(...words.map((w) => ilike(jobs.title, `%${escapeLike(w)}%`)))
      : ilike(jobs.title, `%${escapeLike(query)}%`);

  return fetchDedupedJobIds({
    whereClause: and(filterCondition, titleConditions) ?? filterCondition,
    limit: safeLimit,
  });
}

/** Opdrachten zoeken op titel/omschrijving met full-text search (tsvector/GIN).
 * Falls back to ILIKE if the FTS query produces no results. */
export async function searchJobsByTitle(
  query: string,
  limit?: number,
  status: JobStatus = "open",
): Promise<Job[]> {
  const ids = await searchJobIdsByTitle(query, {
    limit,
    filterCondition: getJobStatusCondition(status),
  });

  return loadJobsByIds(ids);
}

/** Opdrachten zoeken, optioneel gefilterd op platform. Soft-deleted rijen worden uitgesloten. */
export async function searchJobs(opts: SearchJobsOptions = {}): Promise<Job[]> {
  const { data } = await listJobs({
    limit: Math.min(opts.limit ?? 50, 100),
    platform: opts.platform,
    status: opts.status ?? "open",
  });

  return data;
}

/** Hybrid zoeken: combineert tekst (ILIKE) + vector (pgvector) met Reciprocal Rank Fusion. */
export async function hybridSearchWithTotal(
  query: string,
  opts: HybridSearchOptions = {},
): Promise<HybridSearchResult> {
  const start = Date.now();
  const limit = Math.min(opts.limit ?? 20, 100);
  const offset = Math.max(opts.offset ?? 0, 0);
  const requestedStatus = opts.status ?? "open";
  const safeQuery = query.slice(0, 80);
  const policy = getHybridSearchPolicy({ query, limit, offset }, process.env);

  let textSearchMs = 0;
  let embeddingMs = 0;
  let vectorSearchMs = 0;
  let rrfMs = 0;
  let hydrateMs = 0;
  let dedupeMs = 0;
  let hydratedCandidates = 0;

  const filterConditions = buildHybridSearchFilterConditions({
    ...opts,
    status: requestedStatus,
  }).filter((condition): condition is SQL => Boolean(condition));
  const retrievalFilterCondition = buildSearchFilterCondition(filterConditions);

  const [textResultIds, vectorResults] = await Promise.all([
    (async () => {
      const textSearchStartedAt = Date.now();
      try {
        return await searchJobIdsByTitle(query, {
          limit: policy.fetchSize,
          filterCondition: retrievalFilterCondition,
        });
      } finally {
        textSearchMs = Date.now() - textSearchStartedAt;
      }
    })(),
    (async () => {
      try {
        if (!policy.shouldRunVectorSearch) {
          return [];
        }

        if (
          typeof embeddingService.generateQueryEmbedding === "function" &&
          typeof embeddingService.findSimilarJobsByEmbedding === "function"
        ) {
          const embeddingStartedAt = Date.now();
          const queryEmbedding = await embeddingService.generateQueryEmbedding(query);
          embeddingMs = Date.now() - embeddingStartedAt;

          const vectorSearchStartedAt = Date.now();
          const results = await embeddingService.findSimilarJobsByEmbedding(queryEmbedding, {
            limit: policy.fetchSize,
            minScore: policy.vectorMinScore,
            filterCondition: retrievalFilterCondition,
          });
          vectorSearchMs = Date.now() - vectorSearchStartedAt;

          return results;
        }

        if (
          typeof embeddingService.generateQueryEmbedding === "function" &&
          typeof embeddingService.generateEmbedding === "function" &&
          typeof db.execute === "function"
        ) {
          const embeddingStartedAt = Date.now();
          const queryEmbedding = await embeddingService.generateQueryEmbedding(query);
          embeddingMs = Date.now() - embeddingStartedAt;

          const vectorStr = `[${queryEmbedding.join(",")}]`;
          const vectorSearchStartedAt = Date.now();
          const results = await db.execute(sql`
            SELECT
              id,
              title,
              1 - (embedding <=> ${vectorStr}::vector) AS similarity
            FROM jobs
            WHERE embedding IS NOT NULL
              AND deleted_at IS NULL
              AND ${retrievalFilterCondition}
              AND 1 - (embedding <=> ${vectorStr}::vector) >= ${policy.vectorMinScore}
            ORDER BY embedding <=> ${vectorStr}::vector
            LIMIT ${policy.fetchSize}
          `);
          vectorSearchMs = Date.now() - vectorSearchStartedAt;

          return (
            results.rows as Array<{ id: string; title: string; similarity: number | string }>
          ).map((row) => ({
            id: row.id,
            title: row.title,
            similarity: Number(row.similarity),
          }));
        }

        if (typeof embeddingService.findSimilarJobs === "function") {
          const vectorSearchStartedAt = Date.now();
          const results = await embeddingService.findSimilarJobs(query, {
            limit: policy.fetchSize,
            minScore: policy.vectorMinScore,
            filterCondition: retrievalFilterCondition,
          });
          vectorSearchMs = Date.now() - vectorSearchStartedAt;
          return results;
        }

        return [];
      } catch {
        return [];
      }
    })(),
  ]);

  const rrfStartedAt = Date.now();
  const scoreMap = new Map<string, { rrfScore: number; job?: HybridSearchRankJob | Job }>();

  textResultIds.forEach((id, rank) => {
    const entry = scoreMap.get(id) ?? { rrfScore: 0 };
    entry.rrfScore += 1 / (policy.k + rank + 1);
    scoreMap.set(id, entry);
  });

  vectorResults.forEach((match, rank) => {
    const entry = scoreMap.get(match.id) ?? { rrfScore: 0 };
    entry.rrfScore += 1 / (policy.k + rank + 1);
    scoreMap.set(match.id, entry);
  });
  rrfMs = Date.now() - rrfStartedAt;

  const candidateIds = [...scoreMap.keys()];
  if (candidateIds.length === 0) {
    logSlowQuery("hybridSearch", Date.now() - start, SEARCH_SLO_MS, {
      query: safeQuery,
      offset,
      total: 0,
      results: 0,
      textSearchMs,
      embeddingMs,
      vectorSearchMs,
      rrfMs,
      hydrateMs,
      dedupeMs,
      candidateCount: 0,
      hydratedCandidates,
      policyVersion: policy.version,
      hydrationMode: policy.hydrationMode,
      vectorSearchEnabled: policy.shouldRunVectorSearch,
      vectorSearchSkippedReason: policy.vectorSearchSkippedReason,
    });
    return { data: [], total: 0 };
  }

  let total = 0;
  let data: Array<Job & { score: number }> = [];

  if (policy.hydrationMode === "full-candidates") {
    const hydrateStartedAt = Date.now();
    const fetchedJobs = await db
      .select(jobReadSelection)
      .from(jobs)
      .where(and(inArray(jobs.id, candidateIds), ...filterConditions));
    hydrateMs = Date.now() - hydrateStartedAt;
    hydratedCandidates = fetchedJobs.length;

    const fetchMap = new Map(fetchedJobs.map((job) => [job.id, job]));
    for (const [id, entry] of scoreMap) {
      entry.job = fetchMap.get(id);
    }

    const dedupeStartedAt = Date.now();
    const filtered = rankHybridCandidates(
      scoreMap as Map<string, { rrfScore: number; job?: Job }>,
      opts.sortBy,
    );
    dedupeMs = Date.now() - dedupeStartedAt;

    total = filtered.length;
    data = filtered.slice(offset, offset + limit).map(({ job, score }) => ({
      ...job,
      score: Math.round(score * 10000) / 10000,
    }));
  } else {
    const hydrateStartedAt = Date.now();
    const rankedJobs = (await db
      .select(hybridSearchRankSelection)
      .from(jobs)
      .where(and(inArray(jobs.id, candidateIds), ...filterConditions))) as HybridSearchRankJob[];
    hydrateMs = Date.now() - hydrateStartedAt;

    const rankJobMap = new Map(rankedJobs.map((job) => [job.id, job]));
    for (const [id, entry] of scoreMap) {
      entry.job = rankJobMap.get(id);
    }

    const dedupeStartedAt = Date.now();
    const filtered = rankHybridCandidates(
      scoreMap as Map<string, { rrfScore: number; job?: HybridSearchRankJob }>,
      opts.sortBy,
    );
    dedupeMs = Date.now() - dedupeStartedAt;

    total = filtered.length;
    const pageEntries = filtered.slice(offset, offset + limit);
    const pageHydrateStartedAt = Date.now();
    const pageJobs = await loadJobsByIds(pageEntries.map(({ job }) => job.id));
    hydrateMs += Date.now() - pageHydrateStartedAt;
    hydratedCandidates = pageJobs.length;

    const scoreById = new Map(pageEntries.map(({ job, score }) => [job.id, score]));
    data = pageJobs.map((job) => ({
      ...job,
      score: Math.round((scoreById.get(job.id) ?? 0) * 10000) / 10000,
    }));
  }

  logSlowQuery("hybridSearch", Date.now() - start, SEARCH_SLO_MS, {
    query: safeQuery,
    results: data.length,
    total,
    offset,
    textSearchMs,
    embeddingMs,
    vectorSearchMs,
    rrfMs,
    hydrateMs,
    dedupeMs,
    candidateCount: candidateIds.length,
    hydratedCandidates,
    policyVersion: policy.version,
    hydrationMode: policy.hydrationMode,
    vectorSearchEnabled: policy.shouldRunVectorSearch,
    vectorSearchSkippedReason: policy.vectorSearchSkippedReason,
  });
  return { data, total };
}

export async function hybridSearch(
  query: string,
  opts: HybridSearchOptions = {},
): Promise<Array<Job & { score: number }>> {
  return (await hybridSearchWithTotal(query, opts)).data;
}
