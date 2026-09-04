import { NextResponse } from "next/server";
import { requirePrincipal } from "@/src/lib/api-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/esco/observability
 * Legacy observability endpoint for canonical skills catalog status.
 */
export async function GET(request: Request) {
  const principalOrResponse = await requirePrincipal(request);
  if (principalOrResponse instanceof Response) {
    return principalOrResponse;
  }

  const { getEscoCatalogStatus, getEscoMappingStats, getReviewQueueSummary } = await import(
    "@/src/services/esco"
  );
  const [catalog, mappingStats, reviewQueue] = await Promise.all([
    getEscoCatalogStatus(),
    getEscoMappingStats(),
    getReviewQueueSummary(),
  ]);

  return NextResponse.json(
    {
      catalog,
      mapping: mappingStats,
      reviewQueue,
      timestamp: new Date().toISOString(),
    },
    {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    },
  );
}
