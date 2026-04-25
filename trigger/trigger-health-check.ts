import * as Sentry from "@sentry/node";
import { logger, runs, schedules } from "@trigger.dev/sdk";
import { MONITORED_TASKS } from "../src/lib/cron-slo-thresholds";

/**
 * Trigger.dev health check — runs daily and detects scheduled tasks that
 * have been silently failing.
 *
 * Why this exists: on 2026-04-23 we discovered that `agent-orchestrator`
 * had been failing every single run for weeks because a Drizzle `sql`
 * template was passing a JS array to `= ANY(...)`. The task was logging
 * the failure to Trigger.dev's own logs, but nothing was propagating to
 * Sentry or Slack — it was invisible until a human opened the Trigger
 * dashboard.
 *
 * This task:
 *   1. Lists every task identifier defined in the repo (authoritative
 *      source — do not dynamically discover; we want the alert to fire
 *      when an expected task stops running, too).
 *   2. Fetches the last 5 runs per task from the Trigger.dev API.
 *   3. Raises a Sentry-captured error when:
 *        - 3 or more of the last 5 runs failed (consistent failure), OR
 *        - the task hasn't produced any runs in its expected window
 *          (missing entirely, possibly a deploy gap).
 *
 * The monitored task list itself lives in `src/lib/cron-slo-thresholds.ts`
 * because the /scraper-dashboard SLO badge needs to consume the same
 * thresholds. Edit it there, not here.
 */

type TaskHealth = {
  id: string;
  totalRuns: number;
  failedRuns: number;
  lastRunAt: string | null;
  lastFailureReason: string | null;
  ageHours: number | null;
  alerts: string[];
};

export const triggerHealthCheckTask = schedules.task({
  id: "trigger-health-check",
  cron: {
    pattern: "0 7 * * *", // 07:00 Europe/Amsterdam, after scraper-health at 06:00
    timezone: "Europe/Amsterdam",
  },
  maxDuration: 300,
  run: async () => {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const results: TaskHealth[] = [];

    for (const task of MONITORED_TASKS) {
      const alerts: string[] = [];
      let total = 0;
      let failed = 0;
      let lastRunAt: Date | null = null;
      let lastFailureReason: string | null = null;

      try {
        for await (const run of runs.list({
          limit: 5,
          taskIdentifier: task.id,
          from: since,
        })) {
          total += 1;
          const createdAt = new Date(run.createdAt);
          if (!lastRunAt || createdAt > lastRunAt) lastRunAt = createdAt;
          const status = run.status as string | undefined;
          const failedStatuses = new Set([
            "FAILED",
            "CRASHED",
            "SYSTEM_FAILURE",
            "TIMED_OUT",
            "INTERRUPTED",
            "EXPIRED",
          ]);
          if (status && failedStatuses.has(status)) {
            failed += 1;
            if (!lastFailureReason) {
              lastFailureReason =
                (run as { error?: { message?: string } }).error?.message ?? status;
            }
          }
        }
      } catch (err) {
        alerts.push(`runs.list threw: ${err instanceof Error ? err.message : String(err)}`);
      }

      const ageHours = lastRunAt ? (Date.now() - lastRunAt.getTime()) / (60 * 60 * 1000) : null;

      // Alert 1 — consistent failure (≥N of last 5, default 3, per-task override).
      const failureThreshold = task.criticalFailureThreshold ?? 3;
      if (failed >= failureThreshold) {
        alerts.push(
          `${failed}/${total} recent runs failed (threshold=${failureThreshold}, last reason: ${
            lastFailureReason ?? "unknown"
          })`,
        );
      }
      // Alert 2 — task missing entirely
      if (total === 0) {
        alerts.push(`no runs in the last 7 days — schedule may be deactivated`);
      } else if (ageHours !== null && ageHours > task.expectedMaxGapHours) {
        alerts.push(
          `last run was ${ageHours.toFixed(1)}h ago, expected gap ≤ ${task.expectedMaxGapHours}h`,
        );
      }

      results.push({
        id: task.id,
        totalRuns: total,
        failedRuns: failed,
        lastRunAt: lastRunAt ? lastRunAt.toISOString() : null,
        lastFailureReason,
        ageHours,
        alerts,
      });
    }

    // Emit alerts to Sentry so they hit the same notification surface as
    // application errors (Slack, email). Group by task id so repeated
    // alerts dedupe into one issue.
    const alerting = results.filter((r) => r.alerts.length > 0);
    for (const r of alerting) {
      const message = `[trigger-health] ${r.id}: ${r.alerts.join(" · ")}`;
      logger.error(message, { task: r.id, alerts: r.alerts });
      Sentry.captureException(new Error(message), {
        tags: { trigger_task: r.id, alert_kind: "cron_health" },
        extra: {
          totalRuns: r.totalRuns,
          failedRuns: r.failedRuns,
          lastRunAt: r.lastRunAt,
          lastFailureReason: r.lastFailureReason,
          ageHours: r.ageHours,
        },
      });
    }

    logger.info(
      `trigger-health-check completed: ${alerting.length} alerts across ${MONITORED_TASKS.length} tasks`,
      { alerting: alerting.map((r) => r.id) },
    );

    return {
      monitored: MONITORED_TASKS.length,
      alerting: alerting.length,
      results,
    };
  },
});
