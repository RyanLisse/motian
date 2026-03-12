/**
 * Shared scraping utilities for the Motian platform.
 */

import { stripHtml } from "../strip-html";

/**
 * Decode common HTML entities. Handles undefined/null by returning an empty string.
 */
export function decodeText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&Eacute;/g, "É")
    .replace(/&eacute;/g, "é")
    .replace(/&euro;/g, "€")
    .replace(/&deg;/g, "°")
    .replace(/&middot;/g, "·")
    .replace(/&bull;/g, "•")
    .replace(/&hellip;/g, "…")
    .replace(/&nbsp;/g, " ");
}

/**
 * Robustly strip HTML tags while preserving whitespace.
 * Re-exports from strip-html for consolidation.
 */
export { stripHtml };

/**
 * Parse a positive integer from a value, falling back to a default.
 */
export function parsePositiveInteger(val: any, defaultVal: number): number {
  const parsed = parseInt(String(val), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultVal;
}

/**
 * Consistently resolve relative URLs against a base URL.
 */
export function toAbsoluteUrl(url: string | null | undefined, baseUrl: string): string {
  if (!url) return "";
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return url;
  }
}

/**
 * Helper for regex extraction. Handles undefined text.
 */
export function firstMatch(regex: RegExp, text: string | null | undefined): string | undefined {
  if (!text) return undefined;
  const match = regex.exec(text);
  return match?.[1] ?? undefined;
}

/**
 * Formats a description to ensure it meets minimum length requirements.
 */
export function ensureMinLength(text: string, fallback: string, minLength = 10): string {
  const plainText = stripHtml(text).trim();
  return plainText.length >= minLength ? plainText : `${fallback} - vacature via platform`;
}

/** Reads a number from unknown value */
export function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? Math.round(parsed) : undefined;
  }

  return undefined;
}

/** Reads a trimmed string from unknown value */
export function readString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  return undefined;
}

/** Validates and parses a date string, returning undefined if invalid or in the far past */
export function validDate(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  // Ignore dates before 2020 as they are likely placeholders or errors in this context
  if (date.getFullYear() < 2020) return undefined;
  return date.toISOString();
}
