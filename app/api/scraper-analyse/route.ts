import type { NextRequest } from "next/server";
import { withApiHandler } from "@/src/lib/api-handler";
import { scraperAnalyseQuerySchema } from "@/src/schemas/scraper-analyse";
import { getTimeSeriesAnalytics } from "@/src/services/scrape-results";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (request: NextRequest) => {
    const url = new URL(request.url);
    const raw = {
      startDate: url.searchParams.get("startDate") ?? undefined,
      endDate: url.searchParams.get("endDate") ?? undefined,
      platform: url.searchParams.get("platform") ?? undefined,
      groupBy: url.searchParams.get("groupBy") ?? undefined,
    };

    const params = scraperAnalyseQuerySchema.parse(raw);

    const data = await getTimeSeriesAnalytics({
      startDate: params.startDate ? new Date(params.startDate) : undefined,
      endDate: params.endDate ? new Date(params.endDate) : undefined,
      platform: params.platform,
      groupBy: params.groupBy,
    });

    return Response.json({ data });
  },
  {
    logPrefix: "Fout bij ophalen scraper analyse",
    errorMessage: "Kan scraper analyse niet ophalen",
    rateLimit: { interval: 60_000, limit: 60 },
  },
);
