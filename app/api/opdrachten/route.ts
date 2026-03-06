import { withApiHandler } from "@/src/lib/api-handler";
import { paginatedResponse, parsePagination } from "@/src/lib/pagination";
import { withJobsCanonicalSkills } from "@/src/services/esco";
import { listJobs } from "@/src/services/jobs";

export const dynamic = "force-dynamic";

/** List opdrachten with search, filters, and pagination (pagina/page, limit/perPage). */
export const GET = withApiHandler(async (request: Request) => {
  const params = new URL(request.url).searchParams;
  const q = params.get("q") ?? undefined;
  const platform = params.get("platform") ?? undefined;
  const provincie = params.get("provincie") ?? undefined;
  const tariefMin = params.get("tariefMin");
  const tariefMax = params.get("tariefMax");
  const contractType = params.get("contractType") ?? undefined;

  const { page, limit, offset } = parsePagination(params, { limit: 50, maxLimit: 100 });

  const result = await listJobs({
    q,
    platform,
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
