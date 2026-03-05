import { NextResponse } from "next/server";
import { getEscoMappingStats, getReviewQueueSummary } from "@/src/services/esco";

/**
 * GET /api/esco/observability
 * Metrics and review backlog for ESCO mapping/scoring observability.
 */
export async function GET() {
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
