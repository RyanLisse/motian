import { getHoursRangeForBucket, type OpdrachtenHoursBucket } from "../../lib/opdrachten-filters";
import { getTypesenseConfig, isTypesenseEnabled } from "../../lib/typesense";
import type { SearchCandidatesOptions } from "../candidates";
import type { ListJobsSortBy } from "../jobs/filters";
import type { HybridSearchOptions } from "../jobs/search";
import { ensureTypesenseCollection, typesenseRequest } from "./typesense-client";

type TypesenseSearchResponse<TDocument> = {
  found?: number;
  hits?: Array<{
    document: TDocument;
  }>;
};

type SearchIdsResult = {
  ids: string[];
  total: number;
};

function escapeFilterValue(value: string) {
  return `\`${value.replace(/`/g, "\\`")}\``;
}

function getTypesenseJobSort(sortBy: ListJobsSortBy | undefined): string | undefined {
  switch (sortBy) {
    case "tarief_hoog":
      return "rateMax:desc";
    case "tarief_laag":
      return "rateMin:asc";
    case "deadline":
      return "applicationDeadlineTs:asc";
    case "deadline_desc":
      return "applicationDeadlineTs:desc";
    case "geplaatst":
      return "postedAtTs:desc";
    case "startdatum":
      return "startDateTs:asc";
    default:
      return "scrapedAtTs:desc";
  }
}

function buildHoursFilter(
  hoursPerWeekBucket?: OpdrachtenHoursBucket,
  minHoursPerWeek?: number,
  maxHoursPerWeek?: number,
) {
  const range =
    minHoursPerWeek != null || maxHoursPerWeek != null
      ? { min: minHoursPerWeek, max: maxHoursPerWeek }
      : hoursPerWeekBucket
        ? getHoursRangeForBucket(hoursPerWeekBucket)
        : undefined;

  if (!range) return null;

  const filters: string[] = [];
  if (range.min != null) filters.push(`hoursPerWeek:>=${range.min}`);
  if (range.max != null) filters.push(`minHoursPerWeek:<=${range.max}`);
  return filters.length > 0 ? filters.join(" && ") : null;
}

function buildJobFilterBy(opts: HybridSearchOptions) {
  const filters: string[] = [];

  if (opts.platform) filters.push(`platform:=${escapeFilterValue(opts.platform)}`);
  if (opts.company) filters.push(`company:=${escapeFilterValue(opts.company)}`);
  if (opts.endClient) filters.push(`endClient:=${escapeFilterValue(opts.endClient)}`);
  if (opts.status && opts.status !== "all")
    filters.push(`status:=${escapeFilterValue(opts.status)}`);
  if (opts.province) filters.push(`province:=${escapeFilterValue(opts.province)}`);
  if (opts.contractType) filters.push(`contractType:=${escapeFilterValue(opts.contractType)}`);
  if (opts.workArrangement)
    filters.push(`workArrangement:=${escapeFilterValue(opts.workArrangement)}`);

  const categories = [
    ...new Set([...(opts.categories ?? []), ...(opts.category ? [opts.category] : [])]),
  ];
  if (categories.length > 0) {
    filters.push(`categories:=[${categories.map(escapeFilterValue).join(", ")}]`);
  }

  if (opts.rateMin != null) filters.push(`rateMax:>=${opts.rateMin}`);
  if (opts.rateMax != null) filters.push(`rateMin:<=${opts.rateMax}`);

  const hoursFilter = buildHoursFilter(
    opts.hoursPerWeekBucket,
    opts.minHoursPerWeek,
    opts.maxHoursPerWeek,
  );
  if (hoursFilter) filters.push(hoursFilter);

  return filters.join(" && ");
}

function buildCandidateFilterBy(opts: SearchCandidatesOptions) {
  const filters: string[] = [];
  if (opts.location) filters.push(`location:=${escapeFilterValue(opts.location)}`);
  if (opts.role) filters.push(`role:=${escapeFilterValue(opts.role)}`);
  if (opts.skills) filters.push(`skills:=[${escapeFilterValue(opts.skills)}]`);
  return filters.join(" && ");
}

export function canUseTypesenseForJobs(opts: HybridSearchOptions = {}) {
  if (!isTypesenseEnabled()) return false;
  if (opts.escoUri) return false;
  if (opts.region || (opts.regions?.length ?? 0) > 0) return false;
  if (opts.radiusKm != null) return false;
  return true;
}

export function canUseTypesenseForCandidates(opts: SearchCandidatesOptions = {}) {
  if (!isTypesenseEnabled()) return false;
  if (opts.escoUri) return false;
  return Boolean(opts.query || opts.location || opts.role || opts.skills);
}

async function searchCollectionByIds<TDocument extends { id: string }>(
  collection: "jobs" | "candidates",
  params: URLSearchParams,
): Promise<SearchIdsResult | null> {
  await ensureTypesenseCollection(collection);
  const config = getTypesenseConfig();
  if (!config) return null;

  const response = await typesenseRequest<TypesenseSearchResponse<TDocument>>(
    `/collections/${config.collections[collection]}/documents/search`,
    { searchParams: params },
  );

  if (!response) {
    return { ids: [], total: 0 };
  }

  const ids = (response.hits ?? []).map((hit) => hit.document.id);

  // Note: `total` reflects the Typesense match count, which may differ from
  // the hydrated result count (e.g. if documents were deleted from the DB but
  // not yet removed from the index). Callers should rely on ids.length for
  // the actual page size and use `total` only for approximate pagination.
  return {
    ids,
    total: response.found ?? 0,
  };
}

export async function searchJobIdsByTypesense(
  query: string,
  opts: HybridSearchOptions = {},
): Promise<SearchIdsResult | null> {
  if (!canUseTypesenseForJobs(opts)) return null;
  const perPage = Math.min(opts.limit ?? 50, 100);
  const page = Math.floor(Math.max(opts.offset ?? 0, 0) / perPage) + 1;

  const params = new URLSearchParams({
    q: query.trim() || "*",
    query_by: "title,searchText,company,endClient,province,categories",
    per_page: String(perPage),
    page: String(page),
  });

  const filterBy = buildJobFilterBy(opts);
  if (filterBy) params.set("filter_by", filterBy);

  const sortBy = getTypesenseJobSort(opts.sortBy);
  if (sortBy) params.set("sort_by", sortBy);

  return searchCollectionByIds<{ id: string }>("jobs", params);
}

export async function searchCandidateIdsByTypesense(
  opts: SearchCandidatesOptions = {},
): Promise<SearchIdsResult | null> {
  if (!canUseTypesenseForCandidates(opts)) return null;
  const perPage = Math.min(opts.limit ?? 50, 100);
  const page = Math.floor(Math.max(opts.offset ?? 0, 0) / perPage) + 1;

  const params = new URLSearchParams({
    q: [opts.query, opts.role, opts.location, opts.skills].filter(Boolean).join(" ").trim() || "*",
    query_by: "name,role,location,skills,searchText",
    per_page: String(perPage),
    page: String(page),
    sort_by: "createdAtTs:desc",
  });

  const filterBy = buildCandidateFilterBy(opts);
  if (filterBy) params.set("filter_by", filterBy);

  return searchCollectionByIds<{ id: string }>("candidates", params);
}
