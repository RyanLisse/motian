import { Cron } from "croner";

/**
 * Compute the next occurrence of a cron expression after a reference date.
 *
 * Supports both 5-field (standard) and 6-field (with seconds) expressions,
 * including comma-separated lists, ranges, and step values in any field.
 *
 * @param expression  Cron expression string, or null/undefined for no schedule.
 * @param after       Reference date (defaults to `new Date()`). The returned
 *                    date will be strictly after this point in time.
 * @returns           The next Date, or null when the input is empty/invalid.
 */
export function parseCronNext(expression: string | null | undefined, after?: Date): Date | null {
  if (!expression?.trim()) return null;

  try {
    const job = new Cron(expression, { legacyMode: false });
    const next = job.nextRun(after ?? new Date());
    return next ?? null;
  } catch {
    return null;
  }
}
