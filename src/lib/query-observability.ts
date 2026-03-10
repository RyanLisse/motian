/**
 * Query-observability (Fase 4): log trage queries voor SLO-tracking.
 * Zie docs/slo-and-observability.md.
 */

/** SLO-drempel search (hybridSearch): 800ms. */
export const SEARCH_SLO_MS = 800;

/** SLO-drempel list (listJobs): 500ms. */
export const LIST_SLO_MS = 500;

export type SlowQueryMeta = Record<string, unknown>;

export type SlowQueryPayload = {
  operation: string;
  durationMs: number;
  thresholdMs: number;
} & SlowQueryMeta;

export function buildSlowQueryPayload(
  operation: string,
  durationMs: number,
  thresholdMs: number,
  meta: SlowQueryMeta = {},
): SlowQueryPayload {
  return {
    operation,
    durationMs,
    thresholdMs,
    ...meta,
  };
}

export function logSlowQuery(
  operation: string,
  durationMs: number,
  thresholdMs: number,
  meta?: Record<string, unknown>,
): void {
  if (durationMs < thresholdMs) return;
  const payload = buildSlowQueryPayload(operation, durationMs, thresholdMs, meta);
  console.warn("[slow-query]", JSON.stringify(payload));
}
