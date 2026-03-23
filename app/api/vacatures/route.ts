import { withApiHandler } from "@/src/lib/api-handler";
import { paginatedResponse } from "@/src/lib/pagination";
import { runVacaturesSearch } from "@/src/lib/vacatures-search";
import { withJobsCanonicalSkills } from "@/src/services/esco";

export const dynamic = "force-dynamic";

/** List vacatures with search, filters, and pagination (pagina/page, limit/perPage). */
export const GET = withApiHandler(async (request: Request) => {
  const params = new URL(request.url).searchParams;
  const out = await runVacaturesSearch(params);

  if (!out.ok) {
    return Response.json(out.error.body, { status: out.error.status });
  }

  const { result, page, limit, offset } = out.data;
  const data = await withJobsCanonicalSkills(result.data);
  return Response.json(paginatedResponse(data, result.total, { page, limit, offset }));
});
