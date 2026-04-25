import type { NextRequest } from "next/server";
import { withApiHandler } from "@/src/lib/api-handler";
import { getEnrichmentStatus } from "@/src/services/enrichment-status";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (_request: NextRequest) => {
    const status = await getEnrichmentStatus();
    return Response.json(status, {
      // Caching is handled by `unstable_cache` (300s, tagged jobs+candidates).
      // The CDN/browser layer should not double-cache; let the in-process
      // cache govern freshness so manual `revalidateTag("jobs")` calls take
      // immediate effect.
      headers: { "Cache-Control": "no-store" },
    });
  },
  {
    logPrefix: "Fout bij ophalen verrijkingsstatus",
    errorMessage: "Kan verrijkingsstatus niet ophalen",
  },
);
