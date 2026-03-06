import {
  deriveJobStatus,
  type JobStatus,
  type ListJobsSortBy,
  normalizeJobStatusFilter,
  normalizeListJobsSortBy,
} from "./filters";
import { type ListJobsOptions, listActiveJobs, listJobs as listJobsImpl } from "./list";
import {
  deleteJob,
  getJobById as getJobByIdImpl,
  type Job,
  updateJob,
  updateJobEnrichment,
} from "./repository";
import {
  type HybridSearchOptions,
  hybridSearch as hybridSearchImpl,
  type SearchJobsOptions,
  searchJobs,
  searchJobsByTitle,
} from "./search";
import { getActivePipelineCount, getJobStats } from "./stats";

/** Unified vacature search options (one contract for all surfaces). No q = filtered list; with q = hybrid search. */
export type UnifiedJobSearchOptions = {
  q?: string;
  platform?: string;
  company?: string;
  category?: string;
  status?: JobStatus;
  province?: string;
  rateMin?: number;
  rateMax?: number;
  contractType?: string;
  workArrangement?: string;
  postedAfter?: Date | string;
  deadlineBefore?: Date | string;
  startDateAfter?: Date | string;
  sortBy?: ListJobsSortBy;
  limit?: number;
  offset?: number;
};

/** Result of unified search: data (with optional score when q was used) and total count. */
export type UnifiedJobSearchResult = {
  data: Array<Job & { score?: number }>;
  total: number;
};

export type {
  HybridSearchOptions,
  Job,
  JobStatus,
  ListJobsOptions,
  ListJobsSortBy,
  SearchJobsOptions,
};
export {
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

/**
 * Unified vacature search: one entry point for UI, chat, MCP, voice, CLI.
 * No q → filtered listing (listJobs). With q → hybrid search (hybridSearch).
 * Same options yield same ordering across all adapters.
 */
export async function searchJobsUnified(
  opts: UnifiedJobSearchOptions = {},
): Promise<UnifiedJobSearchResult> {
  const query = typeof opts.q === "string" ? opts.q.trim() : "";

  if (!query) {
    const listOpts: ListJobsOptions = {
      limit: opts.limit,
      offset: opts.offset,
      platform: opts.platform,
      company: opts.company,
      category: opts.category,
      status: opts.status,
      province: opts.province,
      rateMin: opts.rateMin,
      rateMax: opts.rateMax,
      contractType: opts.contractType,
      workArrangement: opts.workArrangement,
      postedAfter: opts.postedAfter,
      deadlineBefore: opts.deadlineBefore,
      startDateAfter: opts.startDateAfter,
      sortBy: opts.sortBy,
    };
    const { data, total } = await listJobsImpl(listOpts);
    return { data: data as Array<Job & { score?: number }>, total };
  }

  const hybridOpts: HybridSearchOptions = {
    limit: opts.limit,
    platform: opts.platform,
    province: opts.province,
    rateMin: opts.rateMin,
    rateMax: opts.rateMax,
    contractType: opts.contractType,
    workArrangement: opts.workArrangement,
    postedAfter: opts.postedAfter,
    deadlineBefore: opts.deadlineBefore,
    startDateAfter: opts.startDateAfter,
    sortBy: opts.sortBy,
  };
  const data = await hybridSearchImpl(query, hybridOpts);
  return { data, total: data.length };
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
