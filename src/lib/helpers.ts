// Gedeelde utilities voor het recruitment platform

import { type SQL, type SQLWrapper, sql } from "drizzle-orm";

type DateTimeStyle = "compact" | "full" | "weekday";

const DATE_TIME_OPTIONS: Record<string, Intl.DateTimeFormatOptions> = {
  compact: { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" },
  full: { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" },
  weekday: {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  },
};

/**
 * Format a Date or ISO-string for Dutch locale display.
 *
 * @param value  Date, ISO string, null, or undefined
 * @param style  "compact" (day + month + time), "full" (+ year), or "weekday" (+ weekday)
 * @param fallback  Returned when value is null/undefined (default: null)
 */
export function formatDateTime(
  value: Date | string | null | undefined,
  style: DateTimeStyle = "compact",
  fallback: string | null = null,
): string | null {
  if (!value) return fallback;
  return new Date(value).toLocaleString("nl-NL", DATE_TIME_OPTIONS[style]);
}

import { PLATFORM_SLUGS } from "./platform-catalog";

/** Canonical list of supported scraper platforms. Backed by the platform registry metadata. */
export const PLATFORMS = PLATFORM_SLUGS;
export type Platform = (typeof PLATFORMS)[number];

/** Number of consecutive failures before a scraper's circuit breaker opens. */
export const CIRCUIT_BREAKER_THRESHOLD = 5;

/**
 * Escape SQL LIKE/ILIKE special characters (%, _, \) in user input.
 * Prevents users from injecting wildcards into search patterns.
 */
export function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, "\\$&");
}

/**
 * Strip combining diacritical marks (accents, umlauts, tremas) from a string.
 * Normalizes to NFD (decomposed form) then removes the combining marks.
 * e.g. "coördinator" → "coordinator", "café" → "cafe"
 */
export function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Common Dutch diacritics mapping for SQL translate()
const DIACRITICS_FROM = "àáâãäåæèéêëìíîïòóôõöùúûüýÿñçÀÁÂÃÄÅÆÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÝÑÇ";
const DIACRITICS_TO = "aaaaaaaeeeeiiiiooooouuuuyyncAAAAAAAEEEEIIIIOOOOOUUUUYNC";

/**
 * Cross-database case-insensitive + accent-insensitive "contains" filter.
 * Strips diacritics on both the JS input and the SQL column using translate(),
 * then compares with LOWER + LIKE ... ESCAPE '\'.
 */
export function caseInsensitiveContains(column: SQLWrapper, input: string): SQL {
  const normalized = `%${escapeLike(stripDiacritics(input.trim())).toLocaleLowerCase("nl-NL")}%`;
  return sql`lower(translate(coalesce(${column}, ''), ${DIACRITICS_FROM}, ${DIACRITICS_TO})) like ${normalized} escape '\\'`;
}

/**
 * Sanitize user input for PostgreSQL to_tsquery.
 * Strips diacritics first so "coördinator" matches "coordinator" in the search vector.
 * Splits into words, removes special chars, joins with & (AND).
 * Appends :* to each term for prefix matching (e.g. "java" matches "javascript").
 */
export function toTsQueryInput(s: string): string {
  return stripDiacritics(s)
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((w) => w.length > 0)
    .map((w) => `${w}:*`)
    .join(" & ");
}
