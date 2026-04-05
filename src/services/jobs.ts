import type { OpdrachtenHoursBucket, OpdrachtenRegion } from "../lib/opdrachten-filters";
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
  type SearchJobsOptions,
  searchJobs,
  searchJobsByTitle,
} from "./jobs/search";
import { getActivePipelineCount, getJobStats } from "./jobs/stats";

export type UnifiedJobSearchOptions = {
  q?: string;
  platforms?: string[];
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

export async function searchJobsUnified(
  opts: UnifiedJobSearchOptions = {},
): Promise<UnifiedJobSearchResult> {
  const query = typeof opts.q === "string" ? opts.q.trim() : "";

  if (!query) {
    const listOpts: ListJobsOptions = {
      limit: opts.limit,
      offset: opts.offset,
      platforms: opts.platforms,
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
    const { data, total } = await listJobsImpl(listOpts);
    return { data: data as Array<Job & { score?: number }>, total };
  }

  const hybridOpts: HybridSearchOptions = {
    limit: opts.limit,
    offset: opts.offset,
    platforms: opts.platforms,
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
  const query = typeof opts.q === "string" ? opts.q.trim() : "";

  if (!query) {
    return listJobsPageImpl({
      limit: opts.limit,
      offset: opts.offset,
      platforms: opts.platforms,
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

  return hybridSearchPageWithTotalImpl(query, {
    limit: opts.limit,
    offset: opts.offset,
    platforms: opts.platforms,
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
  query: string,
  opts: HybridSearchOptions = {},
): Promise<Array<Job & { score: number }>> {
  return hybridSearchImpl(query, opts);
}
