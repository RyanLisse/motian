import { unstable_cache } from "next/cache";
import type { OpdrachtenHoursBucket, OpdrachtenRegion } from "../lib/opdrachten-filters";
import { getSidebarMetadata } from "./sidebar-metadata";
import {
  deriveJobStatus,
  type JobStatus,
  type ListJobsSortBy,
  normalizeJobStatusFilter,
  normalizeListJobsSortBy,
} from "./jobs/filters";
import { type ListJobsOptions, listActiveJobs, listJobs as listJobsImpl } from "./jobs/list";
import {
  hybridSearchPageWithTotal as hybridSearchPageWithTotalImpl,
  type JobPageResult,
  type JobPageRow,
  listJobsPage as listJobsPageImpl,
} from "./jobs/page-query";
import { normalizeJobPlatforms } from "./jobs/query-filters";
import {
  createJob,
  deleteJob,
  getJobById as getJobByIdImpl,
  type Job,
  updateJob,
  updateJobEnrichment,
} from "./jobs/repository";
import {
  type HybridSearchOptions,
  hybridSearch as hybridSearchImpl,
  hybridSearchWithTotal as hybridSearchWithTotalImpl,
  type JobSearchQuery,
  type SearchJobsOptions,
  searchJobs,
  searchJobsByTitle,
} from "./jobs/search";
import { getActivePipelineCount, getJobStats } from "./jobs/stats";

export type UnifiedJobSearchOptions = {
  q?: JobSearchQuery;
  platform?: string;
  platforms?: string[];
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
  hoursPerWeekBucket?: OpdrachtenHoursBucket;
  minHoursPerWeek?: number;
  maxHoursPerWeek?: number;
  radiusKm?: number;
  postedAfter?: Date | string;
  deadlineBefore?: Date | string;
  startDateAfter?: Date | string;
  sortBy?: ListJobsSortBy;
  limit?: number;
  offset?: number;
  onlyWithActivePipeline?: boolean;
};

export type UnifiedJobSearchResult = {
  data: Array<Job & { score?: number }>;
  total: number;
};

export type UnifiedJobPageSearchResult = JobPageResult;
export type UnifiedJobPageRow = JobPageRow;

export type {
  HybridSearchOptions,
  Job,
  JobStatus,
  ListJobsOptions,
  ListJobsSortBy,
  SearchJobsOptions,
};
export {
  createJob,
  deleteJob,
  deriveJobStatus,
  getActivePipelineCount,
  getJobStats,
  listActiveJobs,
  normalizeJobStatusFilter,
  normalizeListJobsSortBy,
  searchJobs,
  searchJobsByTitle,
  updateJob,
  updateJobEnrichment,
};

const DEFAULT_OPEN_VACATURES_CACHE_VERSION = "v1";

function isDefaultOpenVacaturesList(opts: UnifiedJobSearchOptions) {
  return (
    !opts.q &&
    !opts.platform &&
    !(opts.platforms?.length) &&
    !opts.company &&
    !opts.endClient &&
    !opts.escoUri &&
    !opts.category &&
    !(opts.categories?.length) &&
    (!opts.status || opts.status === "open") &&
    !opts.province &&
    !opts.region &&
    !(opts.regions?.length) &&
    opts.rateMin == null &&
    opts.rateMax == null &&
    !opts.contractType &&
    !opts.workArrangement &&
    !opts.hoursPerWeekBucket &&
    opts.minHoursPerWeek == null &&
    opts.maxHoursPerWeek == null &&
    opts.radiusKm == null &&
    !opts.postedAfter &&
    !opts.deadlineBefore &&
    !opts.startDateAfter &&
    !opts.onlyWithActivePipeline
  );
}

async function getKnownTotalForDefaultOpenVacaturesList(
  opts: UnifiedJobSearchOptions,
): Promise<number | undefined> {
  if (!isDefaultOpenVacaturesList(opts)) return undefined;

  const metadata = await getSidebarMetadata();
  return metadata?.totalCount;
}

function buildCachedNoQueryListOptions(
  opts: UnifiedJobSearchOptions,
  knownTotal: number | undefined,
  platforms: string[],
) {
  return {
    limit: opts.limit,
    offset: opts.offset,
    knownTotal,
    platform: platforms.length > 0 ? platforms.join(",") : undefined,
    platforms: platforms.length > 0 ? platforms : undefined,
    company: opts.company,
    endClient: opts.endClient,
    escoUri: opts.escoUri,
    category: opts.category,
    categories: opts.categories,
    status: opts.status ?? "open",
    province: opts.province,
    region: opts.region,
    regions: opts.regions,
    rateMin: opts.rateMin,
    rateMax: opts.rateMax,
    contractType: opts.contractType,
    workArrangement: opts.workArrangement,
    hoursPerWeekBucket: opts.hoursPerWeekBucket,
    minHoursPerWeek: opts.minHoursPerWeek,
    maxHoursPerWeek: opts.maxHoursPerWeek,
    radiusKm: opts.radiusKm,
    postedAfter: opts.postedAfter,
    deadlineBefore: opts.deadlineBefore,
    startDateAfter: opts.startDateAfter,
    sortBy: opts.sortBy,
    onlyWithActivePipeline: opts.onlyWithActivePipeline,
  } satisfies ListJobsOptions;
}

function buildNoQueryListCacheKey(
  opts: UnifiedJobSearchOptions,
  knownTotal: number | undefined,
  platforms: string[],
) {
  return JSON.stringify(buildCachedNoQueryListOptions(opts, knownTotal, platforms));
}

const getCachedNoQueryVacaturesList = unstable_cache(
  async (cacheKey: string) => listJobsImpl(JSON.parse(cacheKey) as ListJobsOptions),
  ["no-query-vacatures-list", DEFAULT_OPEN_VACATURES_CACHE_VERSION],
  { revalidate: 60, tags: ["jobs"] },
);

const getCachedNoQueryVacaturesPage = unstable_cache(
  async (cacheKey: string) => listJobsPageImpl(JSON.parse(cacheKey) as ListJobsPageOptions),
  ["no-query-vacatures-page", DEFAULT_OPEN_VACATURES_CACHE_VERSION],
  { revalidate: 60, tags: ["jobs"] },
);

function normalizeUnifiedSearchTerms(query: JobSearchQuery | undefined) {
  if (query == null) return [];
  const terms = Array.isArray(query) ? query : [query];
  return terms.map((term) => term.trim()).filter((term) => term.length >= 2);
}

export async function searchJobsUnified(
  opts: UnifiedJobSearchOptions = {},
): Promise<UnifiedJobSearchResult> {
  const query = normalizeUnifiedSearchTerms(opts.q);
  const platforms = normalizeJobPlatforms(opts.platform, opts.platforms);
  const platformFilter = platforms.length > 0 ? platforms.join(",") : undefined;

  if (query.length === 0) {
    const knownTotal = await getKnownTotalForDefaultOpenVacaturesList(opts);
    const cacheKey = buildNoQueryListCacheKey(opts, knownTotal, platforms);
    const { data, total } = await getCachedNoQueryVacaturesList(cacheKey);
    return { data: data as Array<Job & { score?: number }>, total };
  }

  const hybridOpts: HybridSearchOptions = {
    limit: opts.limit,
    offset: opts.offset,
    platform: platformFilter,
    platforms: platforms.length > 0 ? platforms : undefined,
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
    hoursPerWeekBucket: opts.hoursPerWeekBucket,
    minHoursPerWeek: opts.minHoursPerWeek,
    maxHoursPerWeek: opts.maxHoursPerWeek,
    radiusKm: opts.radiusKm,
    postedAfter: opts.postedAfter,
    deadlineBefore: opts.deadlineBefore,
    startDateAfter: opts.startDateAfter,
    sortBy: opts.sortBy,
    onlyWithActivePipeline: opts.onlyWithActivePipeline,
  };
  const result = await hybridSearchWithTotalImpl(query, hybridOpts);
  return { data: result.data, total: result.total };
}

export async function searchJobsPageUnified(
  opts: UnifiedJobSearchOptions = {},
): Promise<UnifiedJobPageSearchResult> {
  const query = normalizeUnifiedSearchTerms(opts.q);
  const platforms = normalizeJobPlatforms(opts.platform, opts.platforms);
  const platformFilter = platforms.length > 0 ? platforms.join(",") : undefined;

  if (query.length === 0) {
    const knownTotal = await getKnownTotalForDefaultOpenVacaturesList(opts);
    const cacheKey = buildNoQueryListCacheKey(opts, knownTotal, platforms);
    return getCachedNoQueryVacaturesPage(cacheKey);
  }

  return hybridSearchPageWithTotalImpl(query, {
    limit: opts.limit,
    offset: opts.offset,
    platform: platformFilter,
    platforms: platforms.length > 0 ? platforms : undefined,
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
    hoursPerWeekBucket: opts.hoursPerWeekBucket,
    minHoursPerWeek: opts.minHoursPerWeek,
    maxHoursPerWeek: opts.maxHoursPerWeek,
    radiusKm: opts.radiusKm,
    postedAfter: opts.postedAfter,
    deadlineBefore: opts.deadlineBefore,
    startDateAfter: opts.startDateAfter,
    sortBy: opts.sortBy,
    onlyWithActivePipeline: opts.onlyWithActivePipeline,
  });
}

export async function getJobById(id: string): Promise<Job | null> {
  return getJobByIdImpl(id);
}

export async function listJobs(
  opts: ListJobsOptions = {},
): Promise<{ data: Job[]; total: number }> {
  return listJobsImpl(opts);
}

export async function hybridSearch(
  query: JobSearchQuery,
  opts: HybridSearchOptions = {},
): Promise<Array<Job & { score: number }>> {
  return hybridSearchImpl(query, opts);
}
