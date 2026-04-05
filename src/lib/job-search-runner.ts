import {
  DEFAULT_OPDRACHTEN_LIMIT,
  getOpdrachtenServiceSort,
  hasExplicitOpdrachtenSort,
  MAX_OPDRACHTEN_LIMIT,
  normalizeOpdrachtenSearchQuery,
  parseOpdrachtenFilters,
  validateOpdrachtenQueryParams,
} from "@/src/lib/opdrachten-filters";
import { parsePagination } from "@/src/lib/pagination";
import type { UnifiedJobPageSearchResult, UnifiedJobSearchResult } from "@/src/services/jobs";
import { searchJobsPageUnified, searchJobsUnified } from "@/src/services/jobs";

export type JobSearchRunnerResult = {
  result: UnifiedJobSearchResult;
  page: number;
  limit: number;
  offset: number;
};

export type JobSearchRunnerError = {
  status: number;
  body: { error: string; details?: unknown };
};

export type JobPageSearchRunnerResult = {
  result: UnifiedJobPageSearchResult;
  page: number;
  limit: number;
  offset: number;
};

/**
 * Shared job search runner for opdrachten/vacatures routes.
 * Validates request params, parses filters and pagination, and runs the unified job search.
 */
export async function runJobSearch(
  params: URLSearchParams,
): Promise<{ ok: true; data: JobSearchRunnerResult } | { ok: false; error: JobSearchRunnerError }> {
  const validatedQuery = validateOpdrachtenQueryParams(params);
  if (!validatedQuery.success) {
    return {
      ok: false,
      error: {
        status: 400,
        body: { error: "Ongeldige parameters", details: validatedQuery.error.flatten() },
      },
    };
  }

  const filters = parseOpdrachtenFilters(params);
  const q = normalizeOpdrachtenSearchQuery(filters.q);
  const { page, limit, offset } = parsePagination(params, {
    limit: DEFAULT_OPDRACHTEN_LIMIT,
    maxLimit: MAX_OPDRACHTEN_LIMIT,
  });
  const sortBy = getOpdrachtenServiceSort(
    filters.sort,
    Boolean(q),
    hasExplicitOpdrachtenSort(params),
  );

  const result = await searchJobsUnified({
    q: q || undefined,
    platforms: filters.platforms,
    platform: filters.platform,
    endClient: filters.endClient,
    categories: filters.categories,
    escoUri: filters.escoUri,
    status: filters.status,
    province: filters.province,
    regions: filters.regions,
    rateMin: filters.rateMin,
    rateMax: filters.rateMax,
    contractType: filters.contractType,
    hoursPerWeekBucket: filters.hoursPerWeek,
    minHoursPerWeek: filters.hoursPerWeekMin,
    maxHoursPerWeek: filters.hoursPerWeekMax,
    radiusKm: filters.radiusKm,
    sortBy,
    limit,
    offset,
    onlyWithActivePipeline: filters.onlyShortlist ? true : undefined,
  });

  return { ok: true, data: { result, page, limit, offset } };
}

export async function runJobPageSearch(
  params: URLSearchParams,
): Promise<
  { ok: true; data: JobPageSearchRunnerResult } | { ok: false; error: JobSearchRunnerError }
> {
  const validatedQuery = validateOpdrachtenQueryParams(params);
  if (!validatedQuery.success) {
    return {
      ok: false,
      error: {
        status: 400,
        body: { error: "Ongeldige parameters", details: validatedQuery.error.flatten() },
      },
    };
  }

  const filters = parseOpdrachtenFilters(params);
  const q = normalizeOpdrachtenSearchQuery(filters.q);
  const { page, limit, offset } = parsePagination(params, {
    limit: DEFAULT_OPDRACHTEN_LIMIT,
    maxLimit: MAX_OPDRACHTEN_LIMIT,
  });
  const sortBy = getOpdrachtenServiceSort(
    filters.sort,
    Boolean(q),
    hasExplicitOpdrachtenSort(params),
  );

  const result = await searchJobsPageUnified({
    q: q || undefined,
    platforms: filters.platforms,
    platform: filters.platform,
    endClient: filters.endClient,
    categories: filters.categories,
    escoUri: filters.escoUri,
    status: filters.status,
    province: filters.province,
    regions: filters.regions,
    rateMin: filters.rateMin,
    rateMax: filters.rateMax,
    contractType: filters.contractType,
    hoursPerWeekBucket: filters.hoursPerWeek,
    minHoursPerWeek: filters.hoursPerWeekMin,
    maxHoursPerWeek: filters.hoursPerWeekMax,
    radiusKm: filters.radiusKm,
    sortBy,
    limit,
    offset,
    onlyWithActivePipeline: filters.onlyShortlist ? true : undefined,
  });

  return { ok: true, data: { result, page, limit, offset } };
}
