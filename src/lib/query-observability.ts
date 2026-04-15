/**
 * Query-observability (Fase 4): log trage queries voor SLO-tracking.
 * Zie docs/slo-and-observability.md.
 */
import * as Sentry from "@sentry/nextjs";
import { getPostHogServer } from "./posthog";

/** SLO-drempel search (hybridSearch): 800ms. */
export const SEARCH_SLO_MS = 800;

/** SLO-drempel list (listJobs): 500ms. */
export const LIST_SLO_MS = 500;

export type QueryPath =
  | "search-text"
  | "search-hybrid"
  | "search-hybrid-fallback"
  | "list"
  | "list-fts"
  | "candidate-list"
  | "candidate-active-list"
  | "candidate-search-db"
  | "candidate-count-db";

export type SlowQueryMeta = Record<string, unknown>;

export type SlowQueryPayload = {
  operation: string;
  durationMs: number;
  thresholdMs: number;
  queryPath?: QueryPath;
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

  try {
    Sentry.addBreadcrumb({
      category: "performance.slow-query",
      level: "warning",
      message: `slow-query:${operation}`,
      data: payload,
    });
  } catch {
    // Never break request flow because telemetry sinks are unavailable.
  }

  try {
    getPostHogServer()?.capture({
      distinctId: "motian-system",
      event: "slow_query_detected",
      properties: payload,
    });
  } catch {
    // Never break request flow because telemetry sinks are unavailable.
  }
}
