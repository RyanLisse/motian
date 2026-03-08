import type { NextRequest } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/src/lib/api-handler";
import { getScraperDashboardData } from "@/src/services/scraper-dashboard";

const querySchema = z.object({
  activityLimit: z.coerce.number().int().min(1).max(50).optional(),
  overlapLimit: z.coerce.number().int().min(1).max(25).optional(),
  includeTrigger: z.enum(["true", "false"]).optional(),
});

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (request: NextRequest) => {
    const url = new URL(request.url);
    const params = querySchema.parse({
      activityLimit: url.searchParams.get("activityLimit") ?? undefined,
      overlapLimit: url.searchParams.get("overlapLimit") ?? undefined,
      includeTrigger: url.searchParams.get("includeTrigger") ?? undefined,
    });

    const data = await getScraperDashboardData({
      activityLimit: params.activityLimit,
      overlapLimit: params.overlapLimit,
      includeTrigger: params.includeTrigger !== "false",
    });

    return Response.json({ data });
  },
  {
    logPrefix: "Fout bij ophalen scraper dashboard data",
    errorMessage: "Kan scraper dashboard data niet ophalen",
    rateLimit: { interval: 60_000, limit: 60 },
  },
);
