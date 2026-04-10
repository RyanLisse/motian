---
title: "Sentry PII Scrubber: GDPR-Compliant beforeSend Hook for Recruitment Platforms"
date: 2026-04-10
category: docs/solutions/security-issues
module: observability
problem_type: security_issue
component: tooling
severity: high
root_cause: missing_validation
resolution_type: code_fix
symptoms:
  - No beforeSend hook in Sentry configuration
  - PII (emails, Dutch phone numbers, IBANs) potentially transmitted in Sentry events
  - No release tag causing unresolvable source maps in Sentry UI
  - High event volume from known-noise sources (NEXT_REDIRECT, PostHog storage, fetch failures)
tags:
  - sentry
  - gdpr
  - pii
  - security
  - instrumentation
  - next-js
  - dutch
related_components:
  - authentication
  - database
---

# Sentry PII Scrubber: GDPR-Compliant beforeSend Hook for Recruitment Platforms

## Problem

A Dutch recruitment platform handling candidate names, email addresses, phone numbers, and IBANs had no `beforeSend` hook in its Sentry configuration. Any PII appearing in stack traces, request URLs, query parameters, HTTP headers, breadcrumb messages, or exception values was transmitted to and stored on Sentry's servers in full.

This violates GDPR Article 25 (data protection by design) and creates a data breach surface even though the Sentry organization was correctly configured to the EU region (`de.sentry.io`). Data residency and content-level scrubbing are separate requirements.

Additionally, `instrumentation.ts` had no `release` tag, meaning Sentry events could not be linked to specific Vercel deployments and source maps were unresolvable.

The `sentry-scrub.ts` file was originally scoped as part of an API keys feature implementation (session history: `37972a45`) but that session ended with lint failures before the file was created. The current session completed the work. (session history)

## Symptoms

- Sentry dashboard showing raw email addresses or phone numbers in breadcrumb or extra fields
- Stack trace `extra`/`contexts` payloads containing candidate data passed through service layer functions
- Minified stack frames in Sentry with no source map resolution (no `release` tag)
- High event volume from `NEXT_REDIRECT`, `NEXT_NOT_FOUND`, PostHog localStorage errors, and browser network noise

## What Didn't Work

**Relying on Sentry's server-side Data Scrubbing settings** — Sentry's project-level scrubbing applies heuristics to known field shapes but does not cover arbitrary keys added via `Sentry.setExtra()`, custom breadcrumb `data` objects, or deeply nested `contexts` payloads. PII embedded in these paths passes through server-side scrubbing untouched.

**Configuring the EU Sentry region** — `de.sentry.io` was already in place, which addresses data residency. It does not address content-level PII in the event payload. Both are required for GDPR compliance.

## Solution

### 1. Create `src/lib/sentry-scrub.ts`

```typescript
import type { Breadcrumb, ErrorEvent, EventHint } from "@sentry/nextjs";

const PII_PATTERNS: [RegExp, string][] = [
  // Email addresses
  [/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[email]"],
  // Dutch mobile: 06-XXXXXXXX, +31 6 XXXXXXXX, 0031 6 XXXXXXXX
  [
    /(?:\+31|0031|0)[\s-]?(?:6[\s-]?\d{8}|[1-9]\d[\s-]?\d{7}|\d{2}[\s-]?\d{3}[\s-]?\d{4})/g,
    "[phone]",
  ],
  // IBAN
  [/\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7,20}\b/g, "[iban]"],
];

const SENSITIVE_HEADERS = new Set([
  "authorization", "cookie", "x-api-key", "x-admin-token",
]);

export function scrubSentryEvent(event: ErrorEvent, _hint: EventHint): ErrorEvent | null {
  // Scrub request URL, query string; remove cookies and sensitive headers
  if (event.request) {
    if (event.request.url) event.request.url = scrubString(event.request.url);
    if (typeof event.request.query_string === "string") {
      event.request.query_string = scrubString(event.request.query_string);
    }
    delete event.request.cookies;
    event.request.headers = scrubHeaders(event.request.headers as Record<string, string>);
  }
  // Scrub breadcrumb messages and data objects
  if (event.breadcrumbs) {
    // breadcrumbs can be Breadcrumb[] or {values?: Breadcrumb[]} depending on SDK version
    if (Array.isArray(event.breadcrumbs)) {
      event.breadcrumbs = (event.breadcrumbs as Breadcrumb[]).map(scrubBreadcrumb);
    } else {
      const bc = event.breadcrumbs as { values?: Breadcrumb[] };
      if (bc.values) bc.values = bc.values.map(scrubBreadcrumb);
    }
  }
  // Scrub exception values
  if (event.exception?.values) {
    event.exception.values = event.exception.values.map((exc) => ({
      ...exc,
      value: exc.value ? scrubString(exc.value) : exc.value,
    }));
  }
  // Scrub extra + contexts
  if (event.extra) event.extra = scrubValue(event.extra) as typeof event.extra;
  if (event.contexts) event.contexts = scrubValue(event.contexts) as typeof event.contexts;
  return event;
}

export const SENTRY_IGNORE_ERRORS: (string | RegExp)[] = [
  /Access to storage is not allowed/i,
  /storage/i,                                    // PostHog private/incognito mode
  "NetworkError when attempting to fetch resource.",
  "Failed to fetch",
  "Load failed",
  /^Extension context invalidated/,             // browser extension noise
  "The operation was aborted.",
  /NEXT_REDIRECT/,                              // Next.js navigation signals
  /NEXT_NOT_FOUND/,
];
```

### 2. Update `instrumentation.ts`

```typescript
import { scrubSentryEvent, SENTRY_IGNORE_ERRORS } from "@/src/lib/sentry-scrub";

const sharedConfig = {
  dsn: SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? "development",
  release: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA,
  ignoreErrors: SENTRY_IGNORE_ERRORS,
  enableLogs: true,
  beforeSend: scrubSentryEvent,
};

// Node.js runtime
Sentry.init({ ...sharedConfig, tracesSampleRate: isProduction ? 0.2 : 1 });

// Edge runtime
Sentry.init({ ...sharedConfig, tracesSampleRate: 0.1 });
```

## Why This Works

`beforeSend` executes synchronously in the same runtime before the event is serialized and sent to Sentry. PII replaced here never leaves the process — this is the only reliable interception point for arbitrary structured data in custom fields.

The Dutch phone number regex covers both mobile (`06-XXXXXXXX`) and international formats (`+31 6 XXXXXXXX`, `0031 6 XXXXXXXX`) with spacing and hyphen variants.

**The `ErrorEvent` type (not `Event`) is required for `beforeSend` in `@sentry/nextjs`.** Using the generic `Event` type causes a TypeScript error: `Types of property 'type' are incompatible: Type '"transaction"' is not assignable to type 'undefined'`.

The `release` field set to `VERCEL_GIT_COMMIT_SHA` gives Sentry the commit SHA needed to resolve source maps uploaded at build time. Without it, all events across all deployments appear under `undefined` and source map lookup fails entirely.

`SENTRY_IGNORE_ERRORS` filters known-noise signals at the SDK level before the event is constructed, reducing Sentry quota consumption without suppressing actionable errors.

## Prevention

- **Wire `beforeSend` into every `Sentry.init` call, not just `instrumentation.ts`.** A Next.js + Trigger.dev project has at least three separate SDK initializations: `instrumentation.ts` (server/edge via `@sentry/nextjs`), `instrumentation-client.ts` (browser via `@sentry/nextjs`), and `trigger.config.ts` (background tasks via `@sentry/node`). Each is an independent Sentry SDK instance. Missing any one of them creates a full PII leakage surface for that runtime.
- **Add `maskAllText: true, blockAllMedia: true` to Session Replay.** If `replaysOnErrorSampleRate > 0`, the replay integration captures DOM state. Any candidate name, email, or profile data rendered at the time of an error will be included. Configure `Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true })` in the client-side init.
- **Never pass raw task payloads to `extra` in Trigger.dev `onFailure`.** Task payloads for CV analysis, scoring, and GDPR operations contain candidate records. Pass only safe scalar identifiers (task ID, payload field names) — never the payload object itself.
- **Scrub `event.user` explicitly.** `Sentry.setUser()` is commonly called with candidate email and name. The `beforeSend` hook must clear `email`, `username`, and `ip_address` from `event.user` — Sentry does not scrub these fields automatically even with server-side scrubbing configured.
- Add `beforeSend` at project initialization time, before any data reaches production — do not retrofit it after a data exposure incident.
- Review `PII_PATTERNS` when new sensitive data types are introduced: BSN numbers, passport numbers, salary figures, GDPR special-category data.
- Do not pass raw candidate or user objects to `Sentry.setExtra()` or `Sentry.setContext()`. Pass only IDs or anonymized summaries.
- Run `pnpm exec tsc --noEmit` after modifying any Sentry init file — the `beforeSend` signature is strict and `ErrorEvent` vs `Event` type errors are silent at runtime.
- Keep `SENTRY_IGNORE_ERRORS` reviewed at each major Next.js upgrade — `NEXT_REDIRECT` and `NEXT_NOT_FOUND` throw names can change between versions.
- Avoid broad patterns like `/storage/i` in `SENTRY_IGNORE_ERRORS` — they suppress any error containing that word, including legitimate DB/infrastructure errors. Use the specific `/Access to storage is not allowed/i` pattern for the PostHog private-browsing case instead.

## Related Issues

- `src/lib/sentry-scrub.ts` — implementation (all three runtimes share this)
- `instrumentation.ts` — server/edge Sentry init with `beforeSend` + `ignoreErrors` + `release`
- `instrumentation-client.ts` — browser Sentry init with `beforeSend` + Session Replay PII masking
- `trigger.config.ts` — Trigger.dev Sentry init with `beforeSend`; `onFailure` uses payload keys only
- GDPR Article 25: Data protection by design and by default
- [Sentry `beforeSend` docs](https://docs.sentry.io/platforms/javascript/configuration/filtering/#using-beforesend)
