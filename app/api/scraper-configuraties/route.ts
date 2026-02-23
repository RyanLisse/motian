import type { NextRequest } from "next/server";
import { withApiHandler } from "@/src/lib/api-handler";
import { getAllConfigs } from "@/src/services/scrapers";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (_request: NextRequest) => {
    const configs = await getAllConfigs();
    return Response.json({ data: configs, total: configs.length });
  },
  {
    logPrefix: "Fout bij ophalen scraper configuraties",
    errorMessage: "Kan scraper configuraties niet ophalen",
  },
);
