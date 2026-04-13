import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/esco/observability
 * Legacy observability endpoint for canonical skills catalog status.
 */
export async function GET() {
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
