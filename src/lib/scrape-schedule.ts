import { parseCronNext } from "./cron-utils";

const SCHEDULE_DUE_GRACE_MS = 5 * 60_000;

export type ScrapeScheduleDecisionReason =
  | "never_run"
  | "unknown_schedule"
  | "within_grace"
  | "past_due"
  | "not_due";

export type ScrapeScheduleDecision = {
  due: boolean;
  reason: ScrapeScheduleDecisionReason;
  cronExpression: string | null;
  lastRunAt: string | null;
  nextRunAt: string | null;
  evaluatedAt: string;
  graceMs: number;
};

function serializeDate(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export function getScrapeScheduleDecision(
  cronExpression: string | null | undefined,
  lastRunAt: Date | null | undefined,
  now: Date = new Date(),
): ScrapeScheduleDecision {
  const normalizedCron = cronExpression?.trim() || null;

  if (!lastRunAt) {
    return {
      due: true,
      reason: "never_run",
      cronExpression: normalizedCron,
      lastRunAt: null,
      nextRunAt: null,
      evaluatedAt: now.toISOString(),
      graceMs: SCHEDULE_DUE_GRACE_MS,
    };
  }

  const nextRunAt = parseCronNext(normalizedCron, lastRunAt);
  if (!nextRunAt) {
    return {
      due: true,
      reason: "unknown_schedule",
      cronExpression: normalizedCron,
      lastRunAt: serializeDate(lastRunAt),
      nextRunAt: null,
      evaluatedAt: now.toISOString(),
      graceMs: SCHEDULE_DUE_GRACE_MS,
    };
  }

  const dueAtWithGrace = nextRunAt.getTime() - SCHEDULE_DUE_GRACE_MS;
  const due = now.getTime() >= dueAtWithGrace;

  return {
    due,
    reason: due ? (now.getTime() >= nextRunAt.getTime() ? "past_due" : "within_grace") : "not_due",
    cronExpression: normalizedCron,
    lastRunAt: serializeDate(lastRunAt),
    nextRunAt: serializeDate(nextRunAt),
    evaluatedAt: now.toISOString(),
    graceMs: SCHEDULE_DUE_GRACE_MS,
  };
}
