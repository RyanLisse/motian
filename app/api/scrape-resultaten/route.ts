import type { NextRequest } from "next/server";
import { withApiHandler } from "@/src/lib/api-handler";
import { getHistory } from "@/src/services/scrape-results";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get("platform") ?? undefined;
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);

    const results = await getHistory({ platform, limit });
    return Response.json({ data: results, total: results.length });
  },
  {
    logPrefix: "Fout bij ophalen scrape resultaten",
    errorMessage: "Kan scrape resultaten niet ophalen",
  },
);
