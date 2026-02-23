// Gedeelde utilities voor het recruitment platform

/** Canonical list of supported scraper platforms. Single source of truth. */
export const PLATFORMS = ["flextender", "striive", "opdrachtoverheid"] as const;
export type Platform = (typeof PLATFORMS)[number];

/**
 * Escape SQL LIKE/ILIKE special characters (%, _, \) in user input.
 * Prevents users from injecting wildcards into search patterns.
 */
export function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, "\\$&");
}

/**
 * Sanitize user input for PostgreSQL to_tsquery.
 * Splits into words, removes special chars, joins with & (AND).
 * Appends :* to each term for prefix matching (e.g. "java" matches "javascript").
 */
export function toTsQueryInput(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9\u00C0-\u024F]/g, ""))
    .filter((w) => w.length > 0)
    .map((w) => `${w}:*`)
    .join(" & ");
}

/**
 * Exponential backoff met jitter — voorkomt thundering herd bij rate limits
 */
export function calculateBackoff(attempt: number): number {
  const base = 1200 * 2 ** attempt;
  const jitter = Math.floor(Math.random() * 500);
  return base + jitter;
}

/**
 * Sleep helper voor retry loops
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
