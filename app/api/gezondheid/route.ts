import type { NextRequest } from "next/server";
import { withApiHandler } from "@/src/lib/api-handler";
import { getHealth } from "@/src/services/scrapers";
import { ensureTypesenseCollections } from "@/src/services/search-index/typesense-client";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (_request: NextRequest) => {
    try {
      await ensureTypesenseCollections();
    } catch (error) {
      console.error("[Gezondheid] Typesense bootstrap mislukt:", error);
    }

    const health = await getHealth();
    return Response.json(health, {
      headers: { "Cache-Control": "no-cache" },
    });
  },
  {
    logPrefix: "Fout bij ophalen gezondheidsstatus",
    errorMessage: "Kan gezondheidsstatus niet ophalen",
  },
);
