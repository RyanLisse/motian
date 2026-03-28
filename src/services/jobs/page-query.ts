import { and, db, inArray, type SQL, sql } from "../../db";
import { jobs } from "../../db/schema";
import { LIST_SLO_MS, logSlowQuery, SEARCH_SLO_MS } from "../../lib/query-observability";
import * as embeddingService from "../embedding";
import { fetchDedupedJobsPage, loadJobPageRowsByIds } from "./deduplication";
import type { JobStatus } from "./filters";
import { getHybridSearchPolicy } from "./hybrid-search-policy";
import { buildJobFilterConditions } from "./query-filters";
import {
  type HybridSearchOptions,
  type HybridSearchRankJob,
  hybridSearchRankSelection,
  rankHybridCandidates,
  type SearchJobsOptions,
  searchJobIdsByTitle,
} from "./search";

export type JobPageRow = {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  platform: string;
  workArrangement: string | null;
  contractType: string | null;
  applicationDeadline: Date | null;
  hasPipeline: boolean;
  pipelineCount: number;
};

export type ListJobsPageOptions = SearchJobsOptions &
  Pick<
    HybridSearchOptions,
    | "category"
    | "categories"
    | "company"
    | "contractType"
    | "deadlineBefore"
    | "endClient"
    | "escoUri"
    | "hoursPerWeekBucket"
    | "limit"
    | "maxHoursPerWeek"
    | "minHoursPerWeek"
    | "offset"
    | "postedAfter"
    | "province"
    | "radiusKm"
    | "rateMax"
    | "rateMin"
    | "region"
    | "regions"
    | "sortBy"
    | "startDateAfter"
    | "workArrangement"
  >;

export type JobPageResult = {
  data: JobPageRow[];
  total: number;
};

export async function listJobsPage(opts: ListJobsPageOptions = {}): Promise<JobPageResult> {
  const start = Date.now();
  const limit = Math.min(opts.limit ?? 50, 100);
  const offset = opts.offset ?? 0;
  const conditions = buildJobFilterConditions({
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
    deadlineBefore: opts.deadlineBefore,
    startDateAfter: opts.startDateAfter,
    hoursPerWeekBucket: opts.hoursPerWeekBucket,
    minHoursPerWeek: opts.minHoursPerWeek,
    maxHoursPerWeek: opts.maxHoursPerWeek,
    radiusKm: opts.radiusKm,
  });
  const whereClause = and(...conditions) ?? sql`true`;

  const dedupePageStartedAt = Date.now();
  const { ids, total } = await fetchDedupedJobsPage({
    whereClause,
    limit,
    offset,
    sortBy: opts.sortBy ?? "nieuwste",
  });
  const dedupePageMs = Date.now() - dedupePageStartedAt;

  const hydrateStartedAt = Date.now();
  const data = await loadJobPageRowsByIds(ids);
  const hydrateMs = Date.now() - hydrateStartedAt;

  logSlowQuery("listJobsPage", Date.now() - start, LIST_SLO_MS, {
    limit,
    offset,
    total,
    dedupePageMs,
    hydrateMs,
  });

  return { data, total };
}

export async function hybridSearchPageWithTotal(
  query: string,
  opts: HybridSearchOptions = {},
): Promise<JobPageResult> {
  const start = Date.now();
  const limit = Math.min(opts.limit ?? 20, 100);
  const offset = Math.max(opts.offset ?? 0, 0);
  const requestedStatus: JobStatus = opts.status ?? "open";
  const safeQuery = query.slice(0, 80);
  const policy = getHybridSearchPolicy({ query, limit, offset }, process.env);

  let textSearchMs = 0;
  let embeddingMs = 0;
  let vectorSearchMs = 0;
  let rrfMs = 0;
  let hydrateMs = 0;
  let dedupeMs = 0;

  const filterConditions = buildJobFilterConditions({
    ...opts,
    status: requestedStatus,
  }).filter((condition): condition is SQL => Boolean(condition));
  const retrievalFilterCondition = filterConditions.length
    ? (and(...filterConditions) ?? sql`true`)
    : sql`true`;

  const [textResult, vectorResults] = await Promise.all([
    (async () => {
      const textSearchStartedAt = Date.now();
      try {
        return await searchJobIdsByTitle(query, {
          limit: policy.fetchSize,
          filterCondition: retrievalFilterCondition,
          typesenseOptions: {
            ...opts,
            status: requestedStatus,
            limit: policy.fetchSize,
            offset: 0,
          },
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
      } catch {
        return [];
      }
    })(),
  ]);

  const rrfStartedAt = Date.now();
  const scoreMap = new Map<string, { rrfScore: number; job?: HybridSearchRankJob }>();

  textResult.ids.forEach((id, rank) => {
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
    logSlowQuery("hybridSearchPage", Date.now() - start, SEARCH_SLO_MS, {
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
      policyVersion: policy.version,
      vectorSearchEnabled: policy.shouldRunVectorSearch,
      vectorSearchSkippedReason: policy.vectorSearchSkippedReason,
    });
    return { data: [], total: 0 };
  }

  const rankHydrateStartedAt = Date.now();
  const rankedJobs = await db
    .select(hybridSearchRankSelection)
    .from(jobs)
    .where(and(inArray(jobs.id, candidateIds), ...filterConditions));
  hydrateMs = Date.now() - rankHydrateStartedAt;

  const rankJobMap = new Map(rankedJobs.map((job) => [job.id, job]));
  for (const [id, entry] of scoreMap) {
    entry.job = rankJobMap.get(id);
  }

  const dedupeStartedAt = Date.now();
  const filtered = rankHybridCandidates(scoreMap, opts.sortBy);
  dedupeMs = Date.now() - dedupeStartedAt;

  const total = filtered.length;
  const pageEntries = filtered.slice(offset, offset + limit);
  const pageHydrateStartedAt = Date.now();
  const data = await loadJobPageRowsByIds(pageEntries.map(({ job }) => job.id));
  hydrateMs += Date.now() - pageHydrateStartedAt;

  logSlowQuery("hybridSearchPage", Date.now() - start, SEARCH_SLO_MS, {
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
    policyVersion: policy.version,
    vectorSearchEnabled: policy.shouldRunVectorSearch,
    vectorSearchSkippedReason: policy.vectorSearchSkippedReason,
  });

  return { data, total };
}
