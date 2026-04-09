import {
  DEFAULT_OPDRACHTEN_LIMIT,
  getOpdrachtenServiceSort,
  hasExplicitOpdrachtenSort,
  MAX_OPDRACHTEN_LIMIT,
  parseOpdrachtenFilters,
  parseSearchTerms,
  validateOpdrachtenQueryParams,
} from "@/src/lib/opdrachten-filters";
import { parsePagination } from "@/src/lib/pagination";
import type { UnifiedJobSearchResult } from "@/src/services/jobs";
import { searchJobsUnified } from "@/src/services/jobs";

export type VacaturesSearchResult = {
  result: UnifiedJobSearchResult;
  page: number;
  limit: number;
  offset: number;
};

export type VacaturesSearchError = {
  status: number;
  body: { error: string; details?: unknown };
};

/**
 * Shared vacatures search: validate params, parse filters/pagination/sort, run searchJobsUnified.
 * Used by GET /api/vacatures and GET /api/vacatures/zoeken to avoid duplicating the same block.
 */
export async function runVacaturesSearch(
  params: URLSearchParams,
): Promise<{ ok: true; data: VacaturesSearchResult } | { ok: false; error: VacaturesSearchError }> {
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
  const q = parseSearchTerms(filters.q);
  const hasQuery = q.length > 0;
  const { page, limit, offset } = parsePagination(params, {
    limit: DEFAULT_OPDRACHTEN_LIMIT,
    maxLimit: MAX_OPDRACHTEN_LIMIT,
  });
  const sortBy = getOpdrachtenServiceSort(
    filters.sort,
    hasQuery,
    hasExplicitOpdrachtenSort(params),
  );

  const result = await searchJobsUnified({
    q: hasQuery ? q : undefined,
    platform: filters.platform,
    platforms: filters.platforms,
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
