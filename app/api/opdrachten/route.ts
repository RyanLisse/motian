import { withApiHandler } from "@/src/lib/api-handler";
import { paginatedResponse, parsePagination } from "@/src/lib/pagination";
import { withJobsCanonicalSkills } from "@/src/services/esco";
import {
  normalizeJobStatusFilter,
  normalizeListJobsSortBy,
  searchJobsUnified,
} from "@/src/services/jobs";

export const dynamic = "force-dynamic";

/** List opdrachten with search, filters, and pagination (pagina/page, limit/perPage). Unified search contract. */
export const GET = withApiHandler(async (request: Request) => {
  const params = new URL(request.url).searchParams;
  const q = params.get("q") ?? undefined;
  const platform = params.get("platform") ?? undefined;
  const company = params.get("company") ?? undefined;
  const status = normalizeJobStatusFilter(params.get("status"));
  const category = params.get("category") ?? undefined;
  const provincie = params.get("provincie") ?? undefined;
  const tariefMin = params.get("tariefMin");
  const tariefMax = params.get("tariefMax");
  const contractType = params.get("contractType") ?? undefined;
  const sortBy = normalizeListJobsSortBy(params.get("sortBy"));

  const { page, limit, offset } = parsePagination(params, { limit: 50, maxLimit: 100 });

  const result = await searchJobsUnified({
    q,
    platform,
    company,
    status,
    category,
    sortBy,
    province: provincie,
    rateMin: tariefMin ? parseFloat(tariefMin) : undefined,
    rateMax: tariefMax ? parseFloat(tariefMax) : undefined,
    contractType,
    limit,
    offset,
  });

  const data = await withJobsCanonicalSkills(result.data);
  return Response.json(paginatedResponse(data, result.total, { page, limit, offset }));
});
