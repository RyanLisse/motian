import type { NextRequest } from "next/server";
import { withApiHandler } from "@/src/lib/api-handler";
import { getHealth } from "@/src/services/scrapers";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (_request: NextRequest) => {
    const health = await getHealth();
    return Response.json(health, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  },
  {
    logPrefix: "Fout bij ophalen gezondheidsstatus",
    errorMessage: "Kan gezondheidsstatus niet ophalen",
  },
);
