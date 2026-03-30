---
date: 2026-03-30
topic: salesforce-feed-revalidation
---

# Salesforce Feed Revalidation Plan

## Problem Frame

`/api/salesforce-feed` is a live pull-based XML export for Salesforce. Before this change, the route always returned the full XML payload with `Cache-Control: no-store`, even when the generated feed had not changed between polls. That makes repeat polling more expensive than necessary for both Motian and the consumer, especially because the same XML feed is likely to be fetched repeatedly on a schedule.

This plan keeps the scope tight: optimize repeat fetch behavior without changing the feed schema, entity selection, filtering rules, or shared service contract used by the API, CLI, and MCP surfaces.

## Requirements Traceability

- R1. Keep the current XML schema and content unchanged for successful feed responses.
- R2. Allow clients to revalidate unchanged feed responses instead of downloading the full XML every time.
- R3. Support both entity-tag and timestamp-based HTTP validators so simpler polling clients can use `If-Modified-Since` as well as `If-None-Match`.
- R4. Preserve the existing shared `getSalesforceFeed()` + `buildSalesforceFeedXml()` flow so CLI and MCP behavior stays stable.
- R5. Add regression coverage for the route-level conditional request behavior.

## Existing Patterns To Preserve

- [app/api/salesforce-feed/route.ts](/Users/cortex-air/.codex/worktrees/4744/motian/app/api/salesforce-feed/route.ts) already owns request parsing, validation, and response headers for the feed.
- [src/services/salesforce-feed.ts](/Users/cortex-air/.codex/worktrees/4744/motian/src/services/salesforce-feed.ts) already owns record selection and XML serialization.
- [tests/salesforce-feed-route.test.ts](/Users/cortex-air/.codex/worktrees/4744/motian/tests/salesforce-feed-route.test.ts) already verifies route defaults, escaping, and invalid entity handling.

## High-Level Technical Design

Generate the XML exactly once per request, derive a deterministic `ETag` from that XML payload, and return it on successful responses. Also derive the latest record modification timestamp from the feed records and emit it as `Last-Modified`. If the caller sends either `If-None-Match` with the same validator or `If-Modified-Since` that is at or after the feed timestamp, short-circuit the route with a `304 Not Modified` response and no body. Keep the optimization at the route layer so the shared feed service remains unchanged and all non-HTTP consumers keep their current behavior.

## Implementation Units

- [ ] Add route-local feed validator helpers in [app/api/salesforce-feed/route.ts](/Users/cortex-air/.codex/worktrees/4744/motian/app/api/salesforce-feed/route.ts) to derive an `ETag` from the XML, derive `Last-Modified` from the feed records, and match incoming `If-None-Match` / `If-Modified-Since` values.
- [ ] Update the Salesforce feed route to reuse the generated XML string, return validator/revalidation-friendly cache headers, and emit `304 Not Modified` when the incoming validator matches.
- [ ] Extend [tests/salesforce-feed-route.test.ts](/Users/cortex-air/.codex/worktrees/4744/motian/tests/salesforce-feed-route.test.ts) with route-level regression coverage for both `ETag` and `Last-Modified` conditional requests.

## Test Coverage

- Route test verifies the initial response includes an `ETag` and `Last-Modified` when the feed exposes a modification timestamp.
- Route test verifies the same request with matching `If-None-Match` returns `304` and an empty body.
- Route test verifies the same request with matching `If-Modified-Since` returns `304` and an empty body.
- Existing route tests continue to verify XML escaping, default entity behavior, and invalid entity rejection.
- Shared CLI/MCP/auth tests should remain green because the service contract is intentionally unchanged.

## Risks & Dependencies

- The validator must be based on the final XML payload, not the raw records, so route behavior stays consistent with the actual response body.
- `304` responses must continue returning the same `ETag` so clients can keep validating correctly.
- This is a low-risk route-layer optimization and does not warrant broader feed schema or service refactors.

## Verification

- Targeted: Salesforce route test passes with the new `304` regression scenario.
- Shared feed surfaces: Salesforce CLI, MCP, and auth-related tests still pass.
- Quality gates: touched files pass Biome check, repository typecheck stays green, and repo lint still passes.

## Sources & References

- Route: [app/api/salesforce-feed/route.ts](/Users/cortex-air/.codex/worktrees/4744/motian/app/api/salesforce-feed/route.ts)
- Feed service: [src/services/salesforce-feed.ts](/Users/cortex-air/.codex/worktrees/4744/motian/src/services/salesforce-feed.ts)
- Route tests: [tests/salesforce-feed-route.test.ts](/Users/cortex-air/.codex/worktrees/4744/motian/tests/salesforce-feed-route.test.ts)
- Architecture note: [docs/architecture.md](/Users/cortex-air/.codex/worktrees/4744/motian/docs/architecture.md)
