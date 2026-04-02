---
title: "fix: Sentry DSN warnings, autopilot test mocks, matching redirect clarity, performance observability"
type: fix
status: active
date: 2026-04-02
---

# Fix: Sentry DSN Warnings, Autopilot Test Mocks, Matching Redirect Clarity, Performance Observability

## Overview

Four independent improvements to platform health and observability: suppress noisy Sentry console warnings in dev, enable autopilot evidence tests without cloud credentials, clarify the /matching redirect route, and add client-side performance monitoring via Vercel Speed Insights.

## Problem Frame

1. **Sentry DSN console warnings**: Browser tests (expect-cli step-04) report 2 Sentry config errors in console. The Sentry SDK logs warnings when `NEXT_PUBLIC_SENTRY_DSN` is absent or invalid because `enableLogs: true` is set in both `instrumentation.ts` and `instrumentation-client.ts`. These are noisy in dev/preview environments where Sentry is intentionally disabled.

2. **Skipped autopilot-rich-evidence tests**: 4 tests in `tests/autopilot-rich-evidence.test.ts` are permanently skipped via `describe.skipIf(!hasModalCredentials)` because they require `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET`. No local alternative exists, so these tests never run in standard CI.

3. **/matching renders /kandidaten fallback**: `app/matching/page.tsx` is a redirect-only route (lines 35-46) that sends users to `/kandidaten` or `/vacatures/{id}`. This is intentional design from the recruiter-flow merge, but the route lacks documentation and the loading.tsx skeleton we added earlier is wasted on a redirect page.

4. **Missing client-side performance monitoring**: `src/lib/query-observability.ts` has server-side SLO logging (`logSlowQuery` for search at 800ms, list at 500ms) but there is zero client-side performance instrumentation. No Web Vitals, no Vercel Speed Insights, no route transition timing. `docs/slo-and-observability.md` acknowledges this gap.

## Requirements Trace

- R1. Suppress Sentry SDK console noise in environments without a valid DSN
- R2. Enable autopilot evidence tests to run without Modal cloud credentials
- R3. Document /matching redirect intent and remove unnecessary loading skeleton
- R4. Add Vercel Speed Insights for client-side Core Web Vitals monitoring

## Scope Boundaries

- NOT migrating to OpenTelemetry (documented as future work in SLO doc)
- NOT building a custom performance dashboard
- NOT changing Sentry error capture behavior (only suppressing config warnings)
- NOT building a dedicated /matching UI (it's intentionally a redirect)

## Context & Research

### Relevant Code and Patterns

- `instrumentation.ts` — server-side Sentry init with `enableLogs: true`
- `instrumentation-client.ts` — client-side Sentry init with `enableLogs: true`
- `src/env.ts` — t3-env validation, both DSN vars are optional strings
- `tests/autopilot-rich-evidence.test.ts` — 4 skipped tests needing Modal credentials
- `app/matching/page.tsx` — redirect-only route with legacy comments
- `src/lib/query-observability.ts` — server-side SLO with `logSlowQuery`
- `app/providers.tsx` — client providers (React Query, PostHog, theme)

### Institutional Learnings

- `docs/slo-and-observability.md` — defines SLO targets (search p95 < 800ms, list p95 < 500ms) and notes "Optioneel: tracing (OpenTelemetry) or dashboard" as future work

## Key Technical Decisions

- **Sentry `enableLogs` conditional on DSN presence**: Only enable Sentry internal logging when a DSN is actually configured. This is the simplest fix that eliminates console noise without changing error capture behavior.
- **Mock Modal API for autopilot tests**: Create a lightweight HTTP mock server that simulates Modal's REST API responses for video/trace/HAR capture. This lets tests run locally and in CI without credentials.
- **Vercel Speed Insights over custom solution**: `@vercel/speed-insights` is the standard for Next.js on Vercel. One component in the layout, zero config, automatic Core Web Vitals reporting to the Vercel dashboard.

## Open Questions

### Resolved During Planning

- Q: Should we validate DSN format? A: No — the Sentry SDK handles malformed DSNs gracefully. Just suppress its logging when no DSN is set.
- Q: Should /matching get a real UI? A: No — the matching UX lives on /kandidaten (drag-and-drop) and /vacatures/{id} (recruiter cockpit). /matching is a legacy entry point.

### Deferred to Implementation

- Q: Exact Modal API endpoints to mock — depends on reading the autopilot evidence module's HTTP calls at implementation time.

## Implementation Units

- [ ] **Unit 1: Suppress Sentry console warnings in environments without DSN**

**Goal:** Eliminate noisy Sentry SDK warnings in dev/preview environments.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify: `instrumentation.ts`
- Modify: `instrumentation-client.ts`

**Approach:**
- Change `enableLogs: true` to `enableLogs: !!dsn` (or equivalent) in both files so Sentry internal logging is only active when a DSN is configured
- Alternatively, wrap the entire Sentry.init() block so it only runs when DSN is truthy (current code already checks this — verify the `enableLogs` is inside the conditional)

**Patterns to follow:**
- The existing conditional init pattern in both files (`if (dsn) { Sentry.init(...) }`)

**Test scenarios:**
- Happy path: When DSN is set, Sentry initializes with enableLogs true — no change in behavior
- Edge case: When DSN is empty/undefined, Sentry.init is not called AND no console warnings are emitted
- Edge case: When DSN is set but invalid format, Sentry SDK handles gracefully (no crash)

**Verification:**
- Run dev server without NEXT_PUBLIC_SENTRY_DSN set, open browser console — zero Sentry-related warnings

- [ ] **Unit 2: Enable autopilot evidence tests with Modal API mocks**

**Goal:** Allow the 4 skipped tests to run locally and in CI without real Modal credentials.

**Requirements:** R2

**Dependencies:** None

**Files:**
- Modify: `tests/autopilot-rich-evidence.test.ts`
- Possibly modify: `src/autopilot/evidence/index.ts` (if Modal client needs injection point)

**Approach:**
- Read the autopilot evidence module to understand how it calls Modal (HTTP? SDK?)
- Create a mock HTTP server (using Vitest's `vi.fn()` or a simple `http.createServer`) that responds to the Modal endpoints the tests exercise
- Replace the `skipIf(!hasModalCredentials)` gate with the mock setup
- If the Modal interaction is via SDK, use `vi.mock()` to intercept at the import level

**Patterns to follow:**
- Existing test mock patterns in `tests/` (e.g., `createAwaitableQuery` pattern, `vi.doMock` pattern)

**Test scenarios:**
- Happy path: "records a video artifact for an interactive journey" runs and produces a .webm file path
- Happy path: "captures a trace artifact for a successful journey" produces a .zip trace
- Error path: "marks trace artifacts captured from failed journeys" correctly marks failure status
- Happy path: "captures a HAR artifact with recorded network traffic" produces HAR data

**Verification:**
- All 4 previously-skipped tests pass: `pnpm vitest run tests/autopilot-rich-evidence.test.ts`

- [ ] **Unit 3: Clarify /matching redirect route and remove unnecessary skeleton**

**Goal:** Document the redirect intent and clean up the wasted loading skeleton.

**Requirements:** R3

**Dependencies:** None

**Files:**
- Modify: `app/matching/page.tsx` (update comments)
- Delete: `app/matching/loading.tsx` (redirect pages don't need loading skeletons)

**Approach:**
- Update the legacy comment block in `app/matching/page.tsx` to clearly document the redirect intent and which pages now own the matching UX
- Delete `app/matching/loading.tsx` since a server-side redirect never shows a loading state to the user

**Test scenarios:**
- Test expectation: none — redirect behavior is verified by browser tests, no unit test needed for a Next.js redirect

**Verification:**
- `/matching` still redirects to `/kandidaten` (no jobId) or `/vacatures/{id}` (with jobId)
- No loading.tsx flash before redirect

- [ ] **Unit 4: Add Vercel Speed Insights for client-side performance monitoring**

**Goal:** Enable Core Web Vitals (LCP, FID, CLS, INP, FCP, TTFB) reporting to Vercel dashboard.

**Requirements:** R4

**Dependencies:** None

**Files:**
- Modify: `package.json` (add `@vercel/speed-insights`)
- Modify: `app/layout.tsx` (add SpeedInsights component)
- Modify: `docs/slo-and-observability.md` (document the new instrumentation)

**Approach:**
- Install `@vercel/speed-insights` package
- Add `<SpeedInsights />` component to the root layout (inside the body, after children)
- The component automatically reports Web Vitals to Vercel's Speed Insights dashboard (zero config on Vercel)
- Update the SLO doc to note client-side monitoring is now active

**Patterns to follow:**
- Existing provider pattern in `app/layout.tsx` and `app/providers.tsx`
- Vercel Speed Insights docs: `import { SpeedInsights } from '@vercel/speed-insights/next'`

**Test scenarios:**
- Happy path: SpeedInsights component renders without errors in the root layout
- Edge case: Component is a no-op in non-Vercel environments (dev mode) — no errors
- Integration: After deploy, Vercel dashboard shows Web Vitals data for the project

**Verification:**
- `pnpm build` succeeds with the new component
- Dev server starts without errors
- After Vercel deploy, Speed Insights tab shows data

## System-Wide Impact

- **Interaction graph:** Unit 1 touches instrumentation files loaded at app startup — affects all Sentry error capture. Unit 4 adds a passive component to root layout — affects all pages.
- **Error propagation:** No changes to error handling. Sentry capture behavior unchanged.
- **State lifecycle risks:** None — all changes are passive (logging suppression, redirect cleanup, passive monitoring).
- **API surface parity:** None affected.
- **Integration coverage:** Unit 2 needs Modal API mock fidelity verified against actual evidence capture flow.
- **Unchanged invariants:** Sentry error capture, client-side React Query caching, PostHog analytics — all unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Modal API mock may not match real responses | Read actual evidence module HTTP calls to build accurate mocks |
| Speed Insights adds bundle size | `@vercel/speed-insights` is ~1KB gzipped, negligible |
| Removing matching loading.tsx breaks something | Redirect pages never render loading states — safe to remove |

## Sources & References

- Related code: `instrumentation.ts`, `instrumentation-client.ts`, `src/lib/query-observability.ts`
- SLO doc: `docs/slo-and-observability.md`
- Vercel Speed Insights: https://vercel.com/docs/speed-insights
