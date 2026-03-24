import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/esco/observability
 * Metrics and review backlog for ESCO mapping/scoring observability.
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

  return NextResponse.json({
    catalog,
    mapping: mappingStats,
    reviewQueue,
    timestamp: new Date().toISOString(),
  });
}
