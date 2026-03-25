import { withApiHandler } from "@/src/lib/api-handler";
import { paginatedResponse, parsePagination } from "@/src/lib/pagination";
import { countMatches, listMatches } from "@/src/services/matches";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const { page, limit, offset } = parsePagination(searchParams);
  const jobId = searchParams.get("jobId") ?? undefined;
  const candidateId = searchParams.get("candidateId") ?? undefined;
  const status = searchParams.get("status") ?? undefined;

  const data = await listMatches({
    jobId,
    candidateId,
    status,
    limit,
    offset,
  });
  const total = await countMatches({ jobId, candidateId, status });
  return Response.json(paginatedResponse(data, total, { page, limit, offset }), {
    headers: {
      "Cache-Control": "private, s-maxage=15, stale-while-revalidate=30",
    },
  });
});
