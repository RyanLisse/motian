/**
 * Single source of truth for the per-cron SLO thresholds.
 *
 * `MONITORED_TASKS` is consumed by:
 *   - `trigger/trigger-health-check.ts` — the daily 07:00 health-check that
 *     pages Sentry when a task hasn't run within `expectedMaxGapHours` or
 *     when ≥`criticalFailureThreshold` of the last 5 runs failed.
 *   - The /scraper-dashboard page (Trigger.dev visibility card) — uses the
 *     same threshold to render a green/amber/red SLO badge per task card so
 *     a recruiter can spot a stale cron without opening Sentry.
 *
 * Keep the entries here in sync with the cron schedules defined in
 * `trigger/*.ts` (`schedules.task({ id })`). When you add a new scheduled
 * task that should be alerted on, add it to this list — do NOT shadow it in
 * a different file.
 *
 * `criticalFailureThreshold` defaults to 3 (tolerant of transient flakes).
 * For critical data pipelines where a single failure is already actionable
 * (scrape-pipeline going dark = stale vacature data), drop to 1 so the
 * first regression pages the 07:00 health-check.
 */

export type MonitoredTask = {
  id: string;
  expectedMaxGapHours: number;
  criticalFailureThreshold?: number;
};

export const MONITORED_TASKS: readonly MonitoredTask[] = [
  { id: "agent-communicator", expectedMaxGapHours: 24 },
  { id: "agent-matcher", expectedMaxGapHours: 24 },
  { id: "agent-orchestrator", expectedMaxGapHours: 14, criticalFailureThreshold: 1 },
  { id: "agent-intake", expectedMaxGapHours: 24 },
  { id: "agent-scheduler", expectedMaxGapHours: 24 },
  { id: "ai-enrichment-batch", expectedMaxGapHours: 48 },
  { id: "cache-refresh", expectedMaxGapHours: 1 },
  { id: "agent-sourcing", expectedMaxGapHours: 48 },
  { id: "candidate-dedup", expectedMaxGapHours: 48 },
  { id: "daily-kpi-snapshot", expectedMaxGapHours: 26, criticalFailureThreshold: 1 },
  { id: "cv-analysis-pipeline", expectedMaxGapHours: 24 },
  { id: "daily-platform-sync", expectedMaxGapHours: 26 },
  { id: "defer-embedding-sync", expectedMaxGapHours: 24 },
  { id: "match-staleness-purge", expectedMaxGapHours: 48 },
  { id: "embeddings-batch", expectedMaxGapHours: 24 },
  { id: "nightly-maintenance", expectedMaxGapHours: 26, criticalFailureThreshold: 1 },
  { id: "platform-onboard", expectedMaxGapHours: 72 },
  { id: "scrape-pipeline", expectedMaxGapHours: 6, criticalFailureThreshold: 1 },
  { id: "scraper-health-check", expectedMaxGapHours: 26 },
  { id: "scraper-overlap-precompute", expectedMaxGapHours: 2 },
] as const;

const MONITORED_TASKS_BY_ID = new Map<string, MonitoredTask>(
  MONITORED_TASKS.map((task) => [task.id, task]),
);

/**
 * Look up the SLO threshold for a given Trigger.dev task id. Returns
 * `undefined` when the task is not monitored — callers should treat that as
 * "no SLO badge" rather than synthesizing a default, so an unmonitored task
 * doesn't silently start emitting health signals.
 */
export function getMonitoredTask(taskId: string): MonitoredTask | undefined {
  return MONITORED_TASKS_BY_ID.get(taskId);
}

export type SloStatus = "green" | "amber" | "red";

/**
 * Translate "last cron tick at X / expected gap N hours" into a tri-state
 * SLO color used by both the dashboard badge and (in the future) any
 * structured alert payload.
 *
 *   - green : ageHours <= expectedMaxGapHours
 *   - amber : ageHours <= 1.5 * expectedMaxGapHours
 *   - red   : ageHours >  1.5 * expectedMaxGapHours OR no run recorded
 *
 * `now` is injectable for deterministic tests.
 */
export function getSloStatus(
  lastRunAt: Date | null,
  expectedMaxGapHours: number,
  now: Date = new Date(),
): SloStatus {
  if (!lastRunAt) return "red";
  const ageHours = (now.getTime() - lastRunAt.getTime()) / (60 * 60 * 1000);
  if (ageHours <= expectedMaxGapHours) return "green";
  if (ageHours <= expectedMaxGapHours * 1.5) return "amber";
  return "red";
}
