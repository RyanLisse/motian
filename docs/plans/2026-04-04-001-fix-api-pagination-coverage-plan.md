---
title: Fix API pagination coverage
type: fix
status: active
date: 2026-04-04
---

# Fix API pagination coverage

## Overview

Standardize pagination across the remaining high-volume API collection routes so list surfaces return a consistent `{ data, total, page, perPage, totalPages }` shape and avoid unbounded reads as data grows.

## Problem Frame

The repo already has shared pagination helpers in `src/lib/pagination.ts` and several paginated routes (`app/api/kandidaten/route.ts`, `app/api/vacatures/route.ts`, `app/api/sollicitaties/route.ts`, `app/api/interviews/route.ts`, `app/api/berichten/route.ts`, `app/api/matches/route.ts`). A few collection endpoints still return raw arrays or capped lists without offset/page support, which keeps pagination behavior inconsistent and leaves full or near-full table reads in place for recruiter-facing operations.

## Requirements Trace

- R1. Collection routes for screening calls, agent events, scrape results, and platform catalog support shared pagination parsing.
- R2. Responses for those routes use the standard paginated envelope from `src/lib/pagination.ts`.
- R3. Underlying service functions accept limit/offset where needed rather than returning unbounded arrays.
- R4. Existing route behavior remains backward-compatible enough for current consumers beyond the added pagination metadata and bounded result sets.

## Scope Boundaries

- No UI redesign or component extraction work.
- No cursor pagination migration in this pass; stay with the repo’s current page/offset model.
- No changes to already-paginated routes unless required for shared consistency.

## Context & Research

### Relevant Code and Patterns

- `src/lib/pagination.ts` defines `parsePagination()` and `paginatedResponse()`.
- `app/api/kandidaten/route.ts` is the clearest collection-route pattern for count + page + envelope.
- `app/api/interviews/route.ts` and `app/api/berichten/route.ts` show thin API handlers delegating paging to services.
- `app/api/scrape-resultaten/route.ts`, `app/api/screening-calls/route.ts`, `app/api/agent-events/route.ts`, and `app/api/platforms/route.ts` are the remaining inconsistent collection surfaces.
- `src/services/scrape-results.ts`, `src/services/screening-calls.ts`, and `src/services/agent-events.ts` currently expose list helpers without a shared paginated contract.

### Institutional Learnings

- The repo already converged on Dutch route params with shared pagination aliases (`pagina`, `page`, `perPage`, `limit`); reuse that instead of inventing route-local parsing.

### External References

- None needed; the codebase already has strong local patterns for offset/page pagination.

## Key Technical Decisions

- Use `parsePagination()` in every targeted route rather than route-local parsing.
- Push limit/offset into service queries where the database already supports ordered list retrieval.
- Add companion `count*` service helpers where totals are missing so API responses stay consistent with existing paginated routes.
- Keep route cache headers unchanged unless pagination makes a route clearly no-store by current convention.

## Open Questions

### Resolved During Planning

- Should this pass use cursor pagination? No. Existing route conventions and tests are all page/offset based.
- Should scraper dashboard be included? No. It is a bounded analytics aggregate endpoint, not a collection listing surface.

### Deferred to Implementation

- Whether any hidden client relies on the old bare `{ data, total }` shape for the targeted routes. Implementation should check existing tests and local usage before finalizing response shape changes.

## Implementation Units

- [ ] **Unit 1: Paginate screening calls and agent events**

**Goal:** Bring two recruiter-facing collection routes onto the shared pagination contract.

**Requirements:** R1, R2, R3

**Dependencies:** None

**Files:**
- Modify: `app/api/screening-calls/route.ts`
- Modify: `app/api/agent-events/route.ts`
- Modify: `src/services/screening-calls.ts`
- Modify: `src/services/agent-events.ts`
- Test: `tests/pagination.test.ts`

**Approach:**
- Add `parsePagination()` + `paginatedResponse()` to both routes.
- Change `listScreeningCalls()` to accept `limit` and `offset`, plus add a `countScreeningCalls()` helper.
- Change `getRecentEvents()` to accept `limit` and `offset`, plus add a `countRecentEvents()` helper that honors the same filters.

**Patterns to follow:**
- `app/api/interviews/route.ts`
- `app/api/kandidaten/route.ts`

**Test scenarios:**
- Happy path: `GET /api/screening-calls?candidateId=<id>&page=2&limit=10` returns page metadata and only the requested slice.
- Happy path: `GET /api/agent-events?limit=20&page=1` returns a paginated envelope with count metadata.
- Edge case: Dutch alias `pagina=2&perPage=5` is accepted for both routes.
- Error path: `GET /api/screening-calls` without `candidateId` still returns `400`.
- Integration: count helpers apply the same filters as list helpers so `total` matches the filtered dataset.

**Verification:**
- Both routes return the standard paginated envelope and fetch only the requested slice from the service layer.

- [ ] **Unit 2: Paginate scrape results and platform catalog**

**Goal:** Remove remaining collection routes that return fixed-size or whole-list responses without shared page metadata.

**Requirements:** R1, R2, R3, R4

**Dependencies:** Unit 1 patterns may be reused but are not required.

**Files:**
- Modify: `app/api/scrape-resultaten/route.ts`
- Modify: `app/api/platforms/route.ts`
- Modify: `src/services/scrape-results.ts`
- Modify: `src/services/scrapers.ts`
- Test: `tests/pagination.test.ts`

**Approach:**
- Replace route-local `limit` parsing in scrape results with shared pagination helpers.
- Extend scrape-results service with offset support and a filtered count helper.
- Add bounded list + count support for platform catalog so the route can return a consistent paginated envelope without loading the entire catalog first.

**Patterns to follow:**
- `app/api/sollicitaties/route.ts`
- `src/services/candidates.ts`

**Test scenarios:**
- Happy path: `GET /api/scrape-resultaten?platform=striive&page=1&limit=10` returns total count and only the first page.
- Happy path: `GET /api/platforms?page=1&limit=25` returns the standard envelope.
- Edge case: page/limit values are clamped by shared pagination defaults and max limit rules.
- Integration: platform and scrape-result filters affect both returned rows and `total`.

**Verification:**
- Neither route performs an implicit whole-list fetch just to shape the response.

- [ ] **Unit 3: Lock behavior with targeted regression coverage**

**Goal:** Add focused tests that prevent future regressions in pagination envelope shape and filter/count parity.

**Requirements:** R2, R4

**Dependencies:** Units 1-2

**Files:**
- Modify: `tests/pagination.test.ts`
- Possibly modify: `tests/chat-history-pagination.test.ts`

**Approach:**
- Expand the existing pagination-focused suite rather than creating a parallel test file.
- Cover route-level parsing, envelope shape, and filter/count parity for the newly paginated endpoints.

**Patterns to follow:**
- `tests/opdrachten-filters-pagination.test.ts`
- existing pagination helper tests in `tests/pagination.test.ts`

**Test scenarios:**
- Happy path: each newly paginated route includes `page`, `perPage`, `total`, and `totalPages`.
- Edge case: alias params (`pagina`, `perPage`) stay supported.
- Error path: invalid required filters still return existing error responses.
- Integration: a filtered page returns a `total` greater than or equal to the current page length and consistent with service counts.

**Verification:**
- Route tests fail if any targeted endpoint regresses to raw-array responses or drops pagination metadata.

## System-Wide Impact

- **API surface parity:** collection endpoints become more consistent for chat tools, MCP surfaces, and frontend consumers.
- **State lifecycle risks:** low; the change is read-path only.
- **Integration coverage:** route tests need to verify both envelope shape and filtered totals so handlers and service functions do not drift.
- **Unchanged invariants:** existing candidateId requirement for screening calls and current cache header semantics remain unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Hidden consumer depends on old route shape | Check in-repo usage and keep `data` + `total` stable while adding pagination metadata. |
| Count query drifts from list filters | Add paired count helpers and route-level regression tests for filtered totals. |

## Documentation / Operational Notes

- No public docs update required unless a downstream consumer documents one of these route shapes explicitly.

## Sources & References

- Related code: `src/lib/pagination.ts`
- Related code: `app/api/kandidaten/route.ts`
- Related code: `app/api/interviews/route.ts`
