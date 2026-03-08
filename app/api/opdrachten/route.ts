import { withApiHandler } from "@/src/lib/api-handler";
import {
  DEFAULT_OPDRACHTEN_LIMIT,
  getOpdrachtenServiceSort,
  hasExplicitOpdrachtenSort,
  MAX_OPDRACHTEN_LIMIT,
  parseOpdrachtenFilters,
  validateOpdrachtenQueryParams,
} from "@/src/lib/opdrachten-filters";
import { paginatedResponse, parsePagination } from "@/src/lib/pagination";
import { withJobsCanonicalSkills } from "@/src/services/esco";
import { searchJobsUnified } from "@/src/services/jobs";

export const dynamic = "force-dynamic";

/** List opdrachten with search, filters, and pagination (pagina/page, limit/perPage). */
export const GET = withApiHandler(async (request: Request) => {
  const params = new URL(request.url).searchParams;
  const validatedQuery = validateOpdrachtenQueryParams(params);

  if (!validatedQuery.success) {
    return Response.json(
      { error: "Ongeldige parameters", details: validatedQuery.error.flatten() },
      { status: 400 },
    );
  }

  const filters = parseOpdrachtenFilters(params);

  const { page, limit, offset } = parsePagination(params, {
    limit: DEFAULT_OPDRACHTEN_LIMIT,
    maxLimit: MAX_OPDRACHTEN_LIMIT,
  });
  const sortBy = getOpdrachtenServiceSort(
    filters.sort,
    Boolean(filters.q?.trim()),
    hasExplicitOpdrachtenSort(params),
  );

  const result = await searchJobsUnified({
    q: filters.q,
    platform: filters.platform,
    endClient: filters.endClient,
    categories: filters.categories,
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
  });

  const data = await withJobsCanonicalSkills(result.data);
  return Response.json(paginatedResponse(data, result.total, { page, limit, offset }));
});
