import type { Breadcrumb, ErrorEvent, EventHint } from "@sentry/nextjs";

/**
 * PII patterns to redact from Sentry events before transmission.
 * This is a Dutch recruitment platform — candidate names, emails, phone
 * numbers, and IBAN identifiers must not be stored in Sentry.
 */
const PII_PATTERNS: [RegExp, string][] = [
  // Email addresses
  [/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[email]"],
  // Dutch mobile: 06-XXXXXXXX, 06 XXXXXXXX, +31 6 XXXXXXXX
  [
    /(?:\+31|0031|0)[\s-]?(?:6[\s-]?\d{8}|[1-9]\d[\s-]?\d{7}|\d{2}[\s-]?\d{3}[\s-]?\d{4})/g,
    "[phone]",
  ],
  // IBAN
  [/\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7,20}\b/g, "[iban]"],
];

const SENSITIVE_HEADERS = new Set(["authorization", "cookie", "x-api-key", "x-admin-token"]);

function scrubString(value: string): string {
  let out = value;
  for (const [pattern, label] of PII_PATTERNS) {
    out = out.replace(pattern, label);
  }
  return out;
}

function scrubValue(value: unknown, depth = 0): unknown {
  // Return a sentinel rather than the raw value to prevent silent PII leakage
  // at deeply nested depths. Limit is 10 to cover typical service-layer payloads.
  if (depth > 10) return "[depth-limit-exceeded]";
  if (typeof value === "string") return scrubString(value);
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, depth + 1));
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = scrubValue(v, depth + 1);
    }
    return result;
  }
  return value;
}

function scrubHeaders(
  headers: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!headers) return headers;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k] = SENSITIVE_HEADERS.has(k.toLowerCase()) ? "[redacted]" : v;
  }
  return out;
}

function scrubBreadcrumb(crumb: Breadcrumb): Breadcrumb {
  return {
    ...crumb,
    message: crumb.message ? scrubString(crumb.message) : crumb.message,
    data: crumb.data ? (scrubValue(crumb.data) as typeof crumb.data) : crumb.data,
  };
}

/**
 * Sentry `beforeSend` hook — scrubs PII from ErrorEvents before they leave
 * the runtime. Handles request context, breadcrumbs, exception messages,
 * user identity, tags, and extra/contexts payloads.
 *
 * Wire this into every Sentry.init call (server, edge, client, Trigger.dev).
 */
export function scrubSentryEvent(event: ErrorEvent, _hint: EventHint): ErrorEvent | null {
  if (event.request) {
    if (event.request.url) {
      event.request.url = scrubString(event.request.url);
    }
    if (typeof event.request.query_string === "string") {
      event.request.query_string = scrubString(event.request.query_string);
    }
    // Never transmit cookies or auth headers
    delete event.request.cookies;
    event.request.headers = scrubHeaders(event.request.headers);
  }

  // In @sentry/nextjs, ErrorEvent.breadcrumbs is typed as Breadcrumb[] | undefined.
  // The else-branch for {values?: Breadcrumb[]} was a v7 SDK shape; it is unreachable
  // in v10+ and has been removed to prevent a silent no-op scrub if shapes ever diverge.
  if (Array.isArray(event.breadcrumbs)) {
    event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb);
  }

  if (event.exception?.values) {
    event.exception.values = event.exception.values.map((exc) => ({
      ...exc,
      value: exc.value ? scrubString(exc.value) : exc.value,
    }));
  }

  // Scrub user identity — Sentry.setUser() is commonly called with candidate data.
  if (event.user) {
    if (event.user.email) event.user.email = "[email]";
    if (event.user.username) event.user.username = "[redacted]";
    if (event.user.ip_address) event.user.ip_address = "[ip]";
    if (event.user.data) {
      event.user.data = scrubValue(event.user.data) as typeof event.user.data;
    }
  }

  // Scrub tags — callers may accidentally set PII-bearing tag values.
  if (event.tags) {
    const scrubbedTags: typeof event.tags = {};
    for (const [k, v] of Object.entries(event.tags)) {
      scrubbedTags[k] = typeof v === "string" ? scrubString(v) : v;
    }
    event.tags = scrubbedTags;
  }

  // Scrub top-level message and transaction name.
  if (event.message) event.message = scrubString(event.message);
  if (event.transaction) event.transaction = scrubString(event.transaction);

  if (event.extra) {
    event.extra = scrubValue(event.extra) as typeof event.extra;
  }

  if (event.contexts) {
    event.contexts = scrubValue(event.contexts) as typeof event.contexts;
  }

  return event;
}

/**
 * Errors that are known noise and should not be forwarded to Sentry.
 * PostHog storage errors are already suppressed client-side; these cover
 * any that slip through server paths or the root error boundary.
 *
 * Note: the former broad `/storage/i` pattern was removed — it suppressed
 * any error containing "storage", including legitimate DB/infrastructure errors.
 * The specific `/Access to storage is not allowed/i` pattern below is sufficient
 * for the PostHog private-browsing case it was intended to cover.
 */
export const SENTRY_IGNORE_ERRORS: (string | RegExp)[] = [
  // PostHog storage (private/incognito mode, strict cookie partitioning)
  /Access to storage is not allowed/i,
  // Network noise
  "NetworkError when attempting to fetch resource.",
  "Failed to fetch",
  "Load failed",
  // Browser extension interference
  /^Extension context invalidated/,
  // Next.js client-side navigation signals (not real errors)
  "The operation was aborted.",
  /NEXT_REDIRECT/,
  /NEXT_NOT_FOUND/,
];
