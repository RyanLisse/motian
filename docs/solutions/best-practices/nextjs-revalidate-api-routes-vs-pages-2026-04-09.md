---
title: "Next.js App Router: revalidate on API routes vs pages"
date: "2026-04-09"
category: best-practices
module: "Next.js App Router caching strategy"
problem_type: best_practice
component: tooling
severity: high
applies_when:
  - "Using API routes with runtime data dependencies (database, secrets)"
  - "CI environment lacks DATABASE_URL or runtime credentials"
  - "Need both CDN caching and dynamic response handling"
symptoms:
  - "Error occurred prerendering page /api/... during next build"
  - "DATABASE_URL is not set error at build time"
  - "All pages rendering dynamically despite revalidate settings"
root_cause: wrong_api
resolution_type: config_change
tags:
  - nextjs-caching
  - app-router
  - api-routes
  - revalidate
  - isr
  - cache-control
  - force-dynamic
  - cdn-caching
  - headers
---

# Next.js App Router: revalidate on API routes vs pages

## Context

During a performance optimization pass, 6 API route handlers were converted from `export const dynamic = "force-dynamic"` to `export const revalidate = 60`. The routes already had `Cache-Control: s-maxage=N` response headers for CDN caching. The change broke the CI build:

```
Error occurred prerendering page "/api/esco/observability"
Error: DATABASE_URL is not set
```

The same `revalidate` pattern works perfectly on page components. The difference is subtle and undocumented in most guides: `revalidate` on API routes triggers **static prerendering at build time**, while on pages it enables **ISR on first request**.

A related discovery in the same session: calling `headers()` from `next/headers` in the root `app/layout.tsx` forces the **entire route tree** into dynamic rendering, silently defeating all per-page `revalidate` settings. (session history)

## Guidance

### API Route Handlers

**Wrong** (causes build-time prerendering):

```typescript
// app/api/vacatures/route.ts
export const revalidate = 60; // Attempts to statically render at build time
```

**Correct** (dynamic rendering + CDN cache):

```typescript
// app/api/vacatures/route.ts
export const dynamic = "force-dynamic";

export const GET = withApiHandler(async (request) => {
  const data = await queryDatabase();
  return Response.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
});
```

### Page Components

`revalidate` is safe and correct on pages:

```typescript
// app/kandidaten/page.tsx
export const revalidate = 120; // ISR: renders on first request, caches for 120s
```

### Root Layout: avoid headers()

```typescript
// app/layout.tsx
// DO NOT call headers() here — forces ALL child routes into dynamic rendering
import { headers } from "next/headers"; // Remove this

export default async function RootLayout({ children }) {
  const origin = getRequestOrigin(await headers()); // Remove this
  // ...
}
```

Instead, derive runtime values client-side in leaf components:

```typescript
// components/route-shell-overlays.tsx ("use client")
export function RouteShellOverlays() {
  const currentOrigin = typeof window !== "undefined"
    ? window.location.origin
    : null;
  // ...
}
```

### Cache-Control header patterns

| Route type | Directive | Rationale |
|------------|-----------|-----------|
| Read-only listing (vacatures) | `public, s-maxage=60, stale-while-revalidate=300` | Tolerable staleness, fast refresh |
| Rarely-changing catalog (ESCO skills) | `public, s-maxage=300, stale-while-revalidate=600` | ESCO data changes only on import |
| Health check (gezondheid) | `no-cache` | Must reflect live state |
| Sensitive data (chat, GDPR) | `private, no-store` | Never cache in shared CDN |

Note: never combine `private` with `s-maxage` — they contradict. `private` tells CDNs not to store; `s-maxage` tells them how long to store. (session history)

## Why This Matters

- **Silent build breakage**: `revalidate` on API routes looks syntactically correct and compiles without error locally. It only fails in CI where `DATABASE_URL` is unavailable during the build step.
- **Functional equivalence**: CDN caching via `s-maxage` provides identical end-user behavior to ISR — fast, cached responses served from the edge.
- **Global dynamic rendering trap**: A single `headers()` call in the root layout silently defeats `revalidate` on every page, wasting all ISR configuration effort across the entire app.
- **Prior art in this repo**: PR #116 (March 28) correctly established the `force-dynamic` + `Cache-Control` pattern across 82 API routes. The April 9 regression accidentally broke 6 of them.

## When to Apply

- Any Next.js App Router project with API routes that depend on runtime resources
- During CI/CD optimization when "prerendering page" build errors appear
- When migrating from Pages Router (which had no `revalidate` concept on API routes)
- When auditing why ISR isn't working despite per-page `revalidate` settings — check for `headers()`/`cookies()` calls in ancestor layouts

## Examples

### Before (broken):

```typescript
// app/api/esco/observability/route.ts
export const revalidate = 60; // Build fails: prerendering needs DATABASE_URL
```

### After (fixed):

```typescript
// app/api/esco/observability/route.ts
export const dynamic = "force-dynamic"; // Render at request time
// CDN caching via response headers in the handler
```

### headers() removal impact:

| Page | revalidate setting | Before (headers in layout) | After (headers removed) |
|------|-------------------|---------------------------|------------------------|
| /overzicht | 60s | Always dynamic | ISR, cached 60s |
| /kandidaten | 120s | Always dynamic | ISR, cached 120s |
| /pipeline | 120s | Always dynamic | ISR, cached 120s |
| /interviews | 60s | Always dynamic | ISR, cached 60s |
| /messages | 60s | Always dynamic | ISR, cached 60s |

## Related

- `docs/solutions/performance-issues/vercel-fluid-compute-spike-Pipeline-20260329.md` — related page-level `revalidate` tuning (30s → 120s)
- `docs/research/2026-03-05-framework-documentation-research.md` — ISR and `force-dynamic` patterns
- PR #116 — original `Cache-Control` header implementation across 82 routes
- PR #168 — the regression (6 routes converted to `revalidate`) and same-session fix
- PR #169 — hotfix restoring `force-dynamic` on main after #168 merged with the regression
- CLAUDE.md — documents `revalidateTag(tag, "default")` Next.js 16 requirement (related caching API)
