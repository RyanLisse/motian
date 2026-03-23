// Gedeelde utilities voor het recruitment platform

import { type SQL, type SQLWrapper, sql } from "drizzle-orm";

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
 * Cross-database case-insensitive "contains" filter.
 * Uses LOWER(...) + LIKE ... ESCAPE '\' so wildcard chars in user input are treated literally.
 */
export function caseInsensitiveContains(column: SQLWrapper, input: string): SQL {
  const normalized = `%${escapeLike(input.trim()).toLocaleLowerCase("nl-NL")}%`;
  return sql`lower(coalesce(${column}, '')) like ${normalized} escape '\\'`;
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
