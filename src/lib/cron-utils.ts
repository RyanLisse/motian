import { Cron } from "croner";

const DEFAULT_TIMEZONE = "Europe/Amsterdam";

/**
 * Compute the next occurrence of a cron expression after a reference date.
 *
 * Supports both 5-field (standard) and 6-field (with seconds) expressions,
 * including comma-separated lists, ranges, and step values in any field.
 * Cron fields are interpreted in the provided timezone (defaults to
 * Europe/Amsterdam — the timezone of the Trigger.dev scrape schedules).
 *
 * @param expression  Cron expression string, or null/undefined for no schedule.
 * @param after       Reference date (defaults to `new Date()`). The returned
 *                    date will be strictly after this point in time.
 * @param timezone    IANA timezone for interpreting cron fields.
 * @returns           The next Date, or null when the input is empty/invalid.
 */
export function parseCronNext(
  expression: string | null | undefined,
  after?: Date,
  timezone: string = DEFAULT_TIMEZONE,
): Date | null {
  if (!expression?.trim()) return null;

  try {
    const job = new Cron(expression, { legacyMode: false, timezone });
    const next = job.nextRun(after ?? new Date());
    return next ?? null;
  } catch {
    return null;
  }
}
