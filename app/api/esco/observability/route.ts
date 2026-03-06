import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/esco/observability
 * Metrics and review backlog for ESCO mapping/scoring observability.
 */
export async function GET() {
  const { getEscoMappingStats, getReviewQueueSummary } = await import("@/src/services/esco");
  const [mappingStats, reviewQueue] = await Promise.all([
    getEscoMappingStats(),
    getReviewQueueSummary(),
  ]);

  return NextResponse.json({
    mapping: mappingStats,
    reviewQueue,
    timestamp: new Date().toISOString(),
  });
}
