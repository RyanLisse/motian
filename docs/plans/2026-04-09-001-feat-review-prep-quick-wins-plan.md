---
title: Review prep quick wins for vacatures and platform onboarding
type: feature
status: active
date: 2026-04-09
---

# Review prep quick wins for vacatures and platform onboarding

## Overview

Close the confirmed low-effort gaps that still matter for the April 9 platform review: make vacature filtering support multiple platforms end-to-end, add an explicit share action for vacancies, and improve scraper-trigger guidance so AI/operator flows fail with actionable next steps instead of dead-end errors.

## Problem Frame

The review notes surfaced several "quick win" opportunities around vacatures search and scraper onboarding. A repo check on 2026-04-09 shows some items are already addressed (`app/overzicht/page.tsx` exists, keyword search already tokenizes into PostgreSQL `to_tsquery` input in `src/lib/helpers.ts`, and the main vacatures sidebar already pushes URL changes immediately through `components/sidebar/use-sidebar-filters.ts`). The still-confirmed gaps are narrower:

- platform filtering is still single-select from URL parsing through backend query options
- vacancy URLs are shareable, but there is no explicit copy/share action in the recruiter UI
- `triggerScraper` returns raw errors for missing config or inactive onboarding states without telling the operator what to do next

## Requirements Trace

- R1. Vacature filters accept and preserve multiple selected platforms through URL parsing, client state, and backend search.
- R2. Recruiters can explicitly copy/share a vacancy link from the vacatures experience.
- R3. Scraper-trigger failures expose actionable recovery hints for incomplete onboarding states.
- R4. Existing vacature search, pagination, and onboarding behavior remains backward-compatible for current routes and tools.

## Scope Boundaries

- No redesign of the vacatures experience beyond the minimum UI needed for the confirmed quick wins.
- No new persistence layer for saved searches in this pass.
- No automatic platform submission/posting integrations.
- No changes to overview/dashboard features already present in `app/overzicht/page.tsx`.

## Context & Research

### Relevant Code and Patterns

- `components/opdrachten-sidebar.tsx` renders the active vacatures filter experience.
- `components/sidebar/use-sidebar-filters.ts` owns filter state, URL sync, and the search query payload.
- `components/sidebar/compact-sidebar-filters.tsx` still renders platform as a single-select `Select`.
- `src/lib/opdrachten-filters.ts` parses platform as a single string while already supporting multi-value parsing for `regio` and `vakgebied`.
- `src/lib/opdrachten-filter-url.ts` already supports array-valued overrides, so the URL helper can carry repeated `platform` params once the parser/state layer does the same.
- `src/services/jobs/search.ts` already supports multi-word keyword search via `toTsQueryInput()` and an AND-based fallback, so that part does not need work in this pass.
- `src/ai/tools/trigger-scraper.ts` checks catalog presence, config existence, and activation state, but does not surface onboarding status or recovery instructions.
- `src/ai/tools/platform-dynamic.ts` and `src/ai/tools/platforms.ts` define the intended platform creation/configuration/activation flow the trigger guidance should point back to.

### Institutional Learnings

- Reuse the shared vacatures filter stack instead of adding a parallel `/vacatures`-only implementation.
- Keep Dutch UI strings and Dutch route semantics even when code identifiers stay English.

### External References

- None needed; the repo already has strong local patterns for filter arrays, clipboard interactions, and platform onboarding state.

## Key Technical Decisions

- Treat `platform` like the existing multi-value `regio` and `vakgebied` filters: repeated params in the URL, array state in the client, and array-aware filtering in the jobs service.
- Add a small client-side share action rather than inventing a new server round-trip or share-shortlink service.
- Keep `triggerScraper` read/write behavior unchanged, but enrich its error payload with onboarding context and explicit next steps so chat/agent surfaces can recover without guessing.

## Open Questions

### Resolved During Planning

- Is multi-keyword search still missing? No. `src/lib/helpers.ts` already converts queries into `term:* & term:*` syntax for PostgreSQL full-text search, with per-word fallback matching.
- Does the vacatures surface already auto-refresh when filters change? Yes for the main sidebar flow; `components/sidebar/use-sidebar-filters.ts` updates local state and URL immediately.

### Deferred to Implementation

- Whether the share action should live only on detail pages or also on vacancy cards. Implementation can start with the highest-signal placement and expand only if the UI allows a clean addition.

## Implementation Units

- [ ] **Unit 1: Add multi-platform vacatures filtering**

**Goal:** Let recruiters filter vacancies by more than one platform without breaking the existing search UX.

**Requirements:** R1, R4

**Dependencies:** None

**Files:**
- Modify: `src/lib/opdrachten-filters.ts`
- Modify: `components/sidebar/use-sidebar-filters.ts`
- Modify: `components/sidebar/compact-sidebar-filters.tsx`
- Modify: `components/sidebar/sidebar-types.ts`
- Modify: `components/sidebar/sidebar-utils.ts`
- Modify: `src/services/jobs.ts`
- Modify: `src/services/jobs/list.ts`
- Modify: `src/services/jobs/search.ts`
- Modify: `src/services/jobs/query-filters.ts`
- Test: `tests/opdrachten-filters-pagination.test.ts`
- Test: `tests/hybrid-search-runtime-regression.test.ts`

**Approach:**
- Parse `platform` as a multi-value filter, preserving repeated params and comma-separated values.
- Move sidebar platform state from `string` to `string[]`.
- Replace the compact platform `Select` with the existing multi-select pattern used for region/category filters.
- Thread the platform array into list and hybrid-search filter builders using SQL `inArray(...)` or equivalent shared filter construction.

**Patterns to follow:**
- `parseMultiValueTextFilters()` in `src/lib/opdrachten-filters.ts`
- `CompactMultiSelectFilter` usage in `components/sidebar/compact-sidebar-filters.tsx`
- existing multi-value filter URL handling in `src/lib/opdrachten-filter-url.ts`

**Test scenarios:**
- Happy path: `platform=striive&platform=linkedin` parses into two selected platforms.
- Happy path: sidebar URL override writes repeated `platform` params and preserves pagination reset behavior.
- Integration: list/hybrid search applies platform filters before hydration and returns only matching jobs.
- Edge case: duplicate/blank platform params are trimmed and de-duplicated.

**Verification:**
- Recruiter-facing vacatures search updates immediately when toggling multiple platforms and returns filtered results from the backend.

- [ ] **Unit 2: Add an explicit vacancy share action**

**Goal:** Make the existing shareable vacature URL discoverable from the UI.

**Requirements:** R2, R4

**Dependencies:** None

**Files:**
- Modify: `app/vacatures/[id]/page.tsx`
- Possibly modify: `components/job-list-item.tsx`
- Add or modify: `components/...` share action component if a small client helper is needed
- Test: `tests/` route/component regression covering the rendered share action

**Approach:**
- Add a lightweight client share/copy affordance that copies the canonical vacature URL.
- Keep the interaction local to the browser using `navigator.clipboard`.
- Prefer a location that does not clutter the existing vacature cards if card-level placement feels too noisy.

**Patterns to follow:**
- existing clipboard usage in `components/chat/chat-messages.tsx`
- current vacancy detail action layout in `app/vacatures/[id]/page.tsx`

**Test scenarios:**
- Happy path: the detail page renders a visible share/copy affordance.
- Edge case: copy action gracefully handles missing clipboard support if the component already has a fallback pattern.

**Verification:**
- A recruiter can copy the vacature link without manually selecting the browser URL.

- [ ] **Unit 3: Improve scraper trigger recovery guidance**

**Goal:** Turn common scraper-trigger failures into actionable recovery responses for agents and operators.

**Requirements:** R3, R4

**Dependencies:** None

**Files:**
- Modify: `src/ai/tools/trigger-scraper.ts`
- Possibly modify: `src/services/scrapers.ts`
- Test: `tests/` scraper/onboarding tool coverage

**Approach:**
- When `triggerScraper` cannot run, fetch enough onboarding/config state to explain whether the platform is unknown, unconfigured, waiting for credentials, unvalidated, or inactive.
- Return explicit suggested next actions using the existing tool vocabulary (`platformAutoSetup`, `platformConfigCreate`, `platformConfigValidate`, `platformTestImport`, `platformActivate`, `platformReanalyze`).
- Preserve the successful run path unchanged.

**Patterns to follow:**
- onboarding state vocabulary in `src/services/platform-onboarding.ts`
- platform status surfaces in `src/ai/tools/platform-dynamic.ts` and `src/ai/tools/platforms.ts`

**Test scenarios:**
- Error path: unknown platform still returns available platform hints.
- Error path: missing config returns a recovery path instead of only a bare error string.
- Error path: inactive platform explains whether activation, validation, or credential collection is still needed.
- Happy path: successful trigger response shape remains compatible with the existing consumer contract.

**Verification:**
- Chat/agent users can recover from trigger failures without manually inspecting DB state or source code.

## System-Wide Impact

- **Vacatures search parity:** brings platform filtering in line with the repo’s existing multi-value filter patterns.
- **Recruiter usability:** makes sharing a vacancy an intentional UI affordance instead of an undocumented browser trick.
- **Agent resilience:** reduces brittle onboarding flows by making scraper trigger failures self-diagnosing.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Multi-platform search could regress existing single-platform links | Keep single values valid and add regression coverage for both single and repeated `platform` params. |
| Share action introduces client-only code into a server-rendered area | Isolate clipboard logic inside a tiny client helper component. |
| Trigger response changes could surprise downstream consumers | Preserve success payload shape and add new guidance fields only on error paths. |

## Documentation / Operational Notes

- No public docs update is required for these UI and tooling quick wins, but the final summary should note which review findings were already outdated in the current codebase.

## Sources & References

- Related code: `components/opdrachten-sidebar.tsx`
- Related code: `components/sidebar/use-sidebar-filters.ts`
- Related code: `src/lib/opdrachten-filters.ts`
- Related code: `src/ai/tools/trigger-scraper.ts`
- Origin: reviewer notes provided in chat on 2026-04-09
