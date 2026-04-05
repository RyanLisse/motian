---
title: "feat: close high-friction search and platform-onboarding gaps"
type: feat
date: 2026-04-05
deepened: 2026-04-05
origin: user-request-2026-04-05
status: in_progress
---

# Vacatures Search And Platform Onboarding Gap Closure

## Overview

The user request mixes three kinds of work:

1. product-surface inventory ("where are API reference, MCP, XML feed, daily platform status?")
2. concrete UX/product gaps on the `Vacatures` surface
3. a blocking bug in new scraper / platform onboarding through the AI assistant

This plan treats the request as a broad backlog capture plus a focused implementation tranche. The code changes in this iteration should solve the highest-confidence, highest-friction gaps without turning the request into a risky multi-week rewrite.

## Problem Frame

Motian already has strong foundations for documentation, integrations, search, candidate intelligence, and platform onboarding, but the current recruiter experience still has a few sharp edges:

- `Vacatures` filtering is URL-driven and compact, but platform selection is still single-value while the product already supports multi-select patterns in adjacent filters.
- The search UX must stay compact while preserving live refresh and shareable URLs.
- Platform onboarding through the AI assistant has a credential-flow inconsistency: `api_key` auth is treated as if credentials are not required, which can send onboarding into a failing background run instead of pausing for the user to provide credentials.
- Several requested items already exist but are hard to discover because they live behind specific routes or operational pages rather than one obvious entry point.

## Requirements Trace

### Inventory / discoverability

- R1. Identify where API Reference lives.
- R2. Identify where MCP server support lives.
- R3. Identify where XML feed support lives.
- R4. Identify where daily platform/scraper status can be viewed today.
- R5. Identify where CV-extracted skills are visible today.

### Vacatures search improvements

- R6. Search must remain compact while preserving current functionality.
- R7. Search must support selecting multiple platforms.
- R8. Search should refresh correctly when platform filters change.
- R9. Multiple keywords must continue to work.

### Platform onboarding / scraper creation

- R10. Creating a new scraper through the AI assistant must not silently continue when credentials are still required.
- R11. The credential gate must work consistently across AI and MCP platform auto-setup flows.

### Deferred follow-up backlog

The following requests are valid but intentionally deferred from this code tranche because they need additional product/UX or data-model decisions:

- saved vacature filters
- sharing vacatures
- explicit vacature shortlist management
- commercial CV generation from a recruiter template
- automatic offering/submission to channels/sources
- pipeline/interviews feedback surfaces
- broader candidate-to-job full-database matching upgrades beyond existing auto-match + ESCO/embedding flows

## Scope Boundaries

This iteration will:

- document the existing locations for API/OpenAPI, MCP, XML feed, daily scraper status, and CV skills visibility
- add end-to-end multi-platform support to the vacatures filter/search contract
- preserve the compact vacatures filter design by reusing the existing shared multi-select filter patterns
- harden AI/MCP platform auto-setup so any non-`none` auth mode, including `api_key`, pauses for credentials instead of starting a doomed onboarding run

This iteration will not:

- redesign the full vacatures page
- add persistent server-side saved filters
- add a new shortlist domain model
- build a full commercial-CV templating workflow
- implement automated candidate offering to external channels/sources
- redesign pipeline or interviews feedback surfaces

## Context & Research

### Existing surfaces already present

- API reference JSON: `app/api/openapi/route.ts`
- OpenAPI/Scalar generation: `src/lib/api-docs.ts`
- API docs UI: `app/api-docs/route.ts`
- stdio MCP server: `src/mcp/server.ts`
- shared MCP server factory: `src/mcp/create-server.ts`
- HTTP MCP endpoint: `app/api/mcp/route.ts`
- XML feed route: `app/api/salesforce-feed/route.ts`
- XML feed domain service: `src/services/salesforce-feed.ts`
- scraper/platform daily operational status: `app/scraper/page.tsx`, `src/services/scraper-dashboard.ts`, `src/services/scrape-results.ts`
- CV upload/parsing: `app/api/cv-upload/route.ts`, `app/api/cv-upload/save/route.ts`, `src/services/cv-parser.ts`, `src/services/candidate-intake.ts`
- candidate skills visibility: `app/kandidaten/[id]/page.tsx`, `components/skills-radar.tsx`, `components/candidate-profile/skills-experience-section.tsx`

### Existing vacatures search patterns to preserve

- Shared filter parsing and URL sync: `src/lib/opdrachten-filters.ts`, `src/lib/opdrachten-filter-url.ts`
- Live sidebar search state: `components/sidebar/use-sidebar-filters.ts`
- Shared fetch helper: `components/sidebar/sidebar-utils.ts`
- Shared search runners: `src/lib/vacatures-search.ts`, `src/lib/job-search-runner.ts`
- Shared vacancy filtering/query conditions: `src/services/jobs/query-filters.ts`, `src/services/jobs/list.ts`, `src/services/jobs/search.ts`
- Typesense search fallback path: `src/services/search-index/typesense-search.ts`

### Existing onboarding patterns to preserve

- AI auto-setup tool: `src/ai/tools/platform-dynamic.ts`
- MCP auto-setup tool: `src/mcp/tools/platforms.ts`
- secure credential POST route: `app/api/platforms/[slug]/credentials/route.ts`
- background onboarding task: `trigger/platform-onboard.ts`

## Key Technical Decisions

### Decision 1: Treat this as a phased closure plan, not a single mega-feature

Rationale:

- The user request spans docs discovery, search UX, agent/onboarding, CRM/export, matching, and recruiter workflow surfaces.
- Forcing all requested features into one code pass would create broad unverified changes across unrelated domains.
- A smaller tranche still creates meaningful momentum while producing a durable backlog artifact for follow-up phases.

### Decision 2: Add multi-platform support by extending the existing shared filter contract

Rationale:

- The app already supports repeated URL params and multi-select filters for `regio` and `vakgebied`.
- Reusing the same parser + URL override pattern is lower risk than adding bespoke state or a parallel search path.
- This also directly addresses refresh correctness because the query key will include the selected platform set.

### Decision 3: Preserve compactness by reusing existing multi-select UI building blocks

Rationale:

- `CompactMultiSelectFilter` and `FilterChecklist` already exist and fit the current visual language.
- Reusing them avoids a new design system or a search-surface redesign.

### Decision 4: Any auth mode other than `none` must pause for credentials in auto-setup

Rationale:

- `api_key` is still an authenticated mode, even if the value shape differs from username/password.
- Treating `api_key` as non-authenticated sends users into a failing async run instead of a recoverable credential capture step.
- The same rule should apply in both AI and MCP auto-setup flows to avoid cross-surface drift.

## High-Level Technical Design

```text
Vacatures filter state
  -> parse repeated `platform` params into normalized `platforms[]`
  -> use `platforms[]` in local sidebar query key + URL sync
  -> send repeated `platform` params to `/api/vacatures/zoeken`
  -> fan out into shared search runners
  -> translate into SQL/Typesense OR-style platform filtering

Platform auto-setup
  -> analyze URL
  -> if authMode === "none": create config and trigger onboarding
  -> else: return `credentials_needed` with field definitions
  -> credentials route stores config + resumes onboarding
```

## Implementation Units

### Unit 1: Vacatures multi-platform filter support

- Goal: allow recruiters to select multiple platforms while keeping the existing compact vacatures filter experience.
- Files:
  - `src/lib/opdrachten-filters.ts`
  - `components/sidebar/use-sidebar-filters.ts`
  - `components/sidebar/sidebar-types.ts`
  - `components/sidebar/sidebar-utils.ts`
  - `components/sidebar/compact-sidebar-filters.tsx`
  - `components/sidebar/overview-filter-panel.tsx`
  - `src/lib/vacatures-search.ts`
  - `src/lib/job-search-runner.ts`
  - `src/services/jobs.ts`
  - `src/services/jobs/query-filters.ts`
  - `src/services/jobs/list.ts`
  - `src/services/jobs/search.ts`
  - `src/services/search-index/typesense-search.ts`
- Patterns to follow:
  - repeated param parsing already used by `regio` and `vakgebied`
  - shared OR filters in `buildJobFilterConditions`
  - existing compact multi-select filter components
- Verification:
  - parsing supports repeated and comma-delimited `platform` params
  - platform filter toggles trigger fresh results
  - two selected platforms reach the API and the shared search runners
  - Typesense and SQL paths both encode multi-platform filtering correctly

### Unit 2: Platform onboarding credential-gate hardening

- Goal: stop AI/MCP auto-setup from incorrectly treating `api_key` auth as credential-free onboarding.
- Files:
  - `src/ai/tools/platform-dynamic.ts`
  - `src/mcp/tools/platforms.ts`
  - tests for credential-gate behavior
- Patterns to follow:
  - existing `credentials_needed` discriminated output
  - existing secure credential POST route `app/api/platforms/[slug]/credentials/route.ts`
- Verification:
  - `api_key` analysis returns `credentials_needed` instead of triggering onboarding immediately
  - field metadata for `api_key` is present for the GenUI surface
  - MCP parity keeps the same auth gating rule

## System-Wide Impact

- Search changes affect both `/api/vacatures` and `/api/vacatures/zoeken` through the shared runners.
- The same platform-filter contract must stay aligned across URL parsing, React Query keys, fetch serialization, SQL filtering, and Typesense filtering.
- Onboarding changes affect AI chat, MCP callers, and the secure credentials resume route; parity matters more than one-off local fixes.

## Risks & Mitigations

- Risk: changing the search contract could break existing single-platform URLs.
  - Mitigation: keep `platform` backwards compatible and normalize to a combined `platforms[]` representation.

- Risk: multi-platform filtering drifts between SQL and Typesense.
  - Mitigation: update both shared query builders in the same pass and add targeted tests for both.

- Risk: auth-gate fixes could regress existing username/password flows.
  - Mitigation: preserve the existing `credentials_needed` output shape and only widen the gate to include `api_key`.

## Phased Delivery After This Tranche

### Phase 2

- saved vacature filters
- explicit vacancy share actions
- shortlist management

### Phase 3

- commercial CV generation from recruiter templates
- automated offering/submission via agent/channel/source

### Phase 4

- richer pipeline/interview feedback surfaces
- broader candidate-to-vacature database matching review

## Test Coverage

- `tests/opdrachten-filters-pagination.test.ts`
- new or updated vacatures search runner tests
- new or updated Typesense filter tests
- new onboarding auth-gate tests around AI/MCP auto-setup

## Sources & References

- `docs/brainstorms/2026-03-26-instant-vacatures-search-requirements.md`
- `docs/plans/2026-03-26-001-feat-instant-vacatures-search-plan.md`
- `docs/plans/2026-03-30-feat-agent-native-platform-onboarding-chat-plan.md`
- `src/lib/api-docs.ts`
- `app/api/openapi/route.ts`
- `app/api/mcp/route.ts`
- `src/mcp/server.ts`
- `app/api/salesforce-feed/route.ts`
- `src/services/salesforce-feed.ts`
- `app/scraper/page.tsx`
- `components/sidebar/use-sidebar-filters.ts`
- `src/ai/tools/platform-dynamic.ts`
- `src/mcp/tools/platforms.ts`
