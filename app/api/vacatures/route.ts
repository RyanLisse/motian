import { withApiHandler } from "@/src/lib/api-handler";
import { paginatedResponse } from "@/src/lib/pagination";
import { runVacaturesSearchWithSkillsLite } from "@/src/lib/vacatures-search";

export const dynamic = "force-dynamic";

/** List vacatures with search, filters, and pagination (pagina/page, limit/perPage). */
export const GET = withApiHandler(async (request: Request) => {
  const params = new URL(request.url).searchParams;
  const out = await runVacaturesSearchWithSkillsLite(params);

  if (!out.ok) {
    return Response.json(out.error.body, { status: out.error.status });
  }

  const { result, page, limit, offset } = out.data;
  return Response.json(paginatedResponse(result.data, result.total, { page, limit, offset }), {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
});
