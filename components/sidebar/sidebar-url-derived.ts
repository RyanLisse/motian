import {
  DEFAULT_OPDRACHTEN_LIMIT,
  getHoursRangeForBucket,
  MAX_OPDRACHTEN_LIMIT,
  normalizeOpdrachtenSearchQuery,
  OPDRACHTEN_SORT_OPTIONS,
  parseOpdrachtenFilters,
} from "@/src/lib/opdrachten-filters";

/** Values derived from the current URL for vacatures sidebar filters. */
export type SidebarUrlDerived = ReturnType<typeof deriveSidebarUrlState>;

export function deriveSidebarUrlState(searchParams: URLSearchParams) {
  const parsedFilters = parseOpdrachtenFilters(new URLSearchParams(searchParams.toString()));
  const q = parsedFilters.q ?? "";
  const committedSearchQuery = normalizeOpdrachtenSearchQuery(q) ?? "";
  const selectedPlatforms = parsedFilters.platforms;
  const onlyShortlistFromUrl = parsedFilters.onlyShortlist;
  const endClient = parsedFilters.endClient ?? "";
  const vaardigheid = parsedFilters.escoUri ?? "";
  const status = parsedFilters.status;
  const provincie = parsedFilters.province ?? "";
  const regios = parsedFilters.regions;
  const vakgebieden = parsedFilters.categories;
  const urenPerWeek = parsedFilters.hoursPerWeek ?? "";
  const urenRangeFromBucket = parsedFilters.hoursPerWeek
    ? getHoursRangeForBucket(parsedFilters.hoursPerWeek)
    : undefined;
  const urenPerWeekMin =
    parsedFilters.hoursPerWeekMin != null
      ? String(parsedFilters.hoursPerWeekMin)
      : urenRangeFromBucket?.min != null
        ? String(urenRangeFromBucket.min)
        : "";
  const urenPerWeekMax =
    parsedFilters.hoursPerWeekMax != null
      ? String(parsedFilters.hoursPerWeekMax)
      : urenRangeFromBucket?.max != null
        ? String(urenRangeFromBucket.max)
        : "";
  const straalKm = parsedFilters.radiusKm ? String(parsedFilters.radiusKm) : "";
  const contractType = parsedFilters.contractType ?? "";
  const hasSearchQuery = committedSearchQuery.length > 0;
  const sortOptions = hasSearchQuery
    ? OPDRACHTEN_SORT_OPTIONS
    : OPDRACHTEN_SORT_OPTIONS.filter((option) => option.value !== "relevantie");
  const sort =
    !hasSearchQuery && parsedFilters.sort === "relevantie" ? "nieuwste" : parsedFilters.sort;
  const tariefMinParamFromUrl = parsedFilters.rateMin != null ? String(parsedFilters.rateMin) : "";
  const tariefMaxParamFromUrl = parsedFilters.rateMax != null ? String(parsedFilters.rateMax) : "";
  const pageParam =
    Math.max(
      1,
      Number.parseInt(searchParams.get("pagina") ?? searchParams.get("page") ?? "1", 10),
    ) || 1;
  const limitParam =
    Math.min(
      MAX_OPDRACHTEN_LIMIT,
      Math.max(
        1,
        Number.parseInt(
          searchParams.get("limit") ??
            searchParams.get("perPage") ??
            String(DEFAULT_OPDRACHTEN_LIMIT),
          10,
        ),
      ),
    ) || DEFAULT_OPDRACHTEN_LIMIT;

  return {
    q,
    committedSearchQuery,
    selectedPlatforms,
    onlyShortlistFromUrl,
    endClient,
    vaardigheid,
    status,
    provincie,
    regios,
    vakgebieden,
    urenPerWeek,
    urenPerWeekMin,
    urenPerWeekMax,
    straalKm,
    contractType,
    sort,
    sortOptions,
    tariefMinParamFromUrl,
    tariefMaxParamFromUrl,
    pageParam,
    limitParam,
    hasSearchQuery,
  };
}
