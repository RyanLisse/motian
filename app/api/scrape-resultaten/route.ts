import type { NextRequest } from "next/server";
import { withApiHandler } from "@/src/lib/api-handler";
import { paginatedResponse, parsePagination } from "@/src/lib/pagination";
import { countHistory, getHistory } from "@/src/services/scrape-results";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get("platform") ?? undefined;
    const { page, limit, offset } = parsePagination(searchParams);

    const [results, total] = await Promise.all([
      getHistory({ platform, limit, offset }),
      countHistory({ platform }),
    ]);
    return Response.json(paginatedResponse(results, total, { page, limit, offset }), {
      headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" },
    });
  },
  {
    logPrefix: "Fout bij ophalen scrape resultaten",
    errorMessage: "Kan scrape resultaten niet ophalen",
  },
);
