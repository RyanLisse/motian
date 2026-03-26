---
date: 2026-03-26
topic: instant-vacatures-search
---

# Instant Vacatures Search Plan

## Problem Frame
The vacatures page already has debounced search and React Query-backed result loading, but the current interaction still leaves too much ambiguity around when a query becomes “active” and how short queries should behave. We want the search to feel responsive while typing, keep the current result list visible during refreshes, and avoid search noise for 0-1 character inputs. This plan keeps the UX change narrowly scoped to vacatures and preserves the current shared search architecture.

## Requirements Traceability
- R1. Search should update automatically while the user types.
- R2. Live search should begin once the query reaches 2 characters or more.
- R3. Existing results should remain visible while the next request loads.
- R4. The URL should update after a short pause rather than on every keystroke.
- R5. Shortened queries below the threshold should fall back to the default vacatures listing.

These decisions come from the origin brief at [docs/brainstorms/2026-03-26-instant-vacatures-search-requirements.md](/Users/cortex-air/.codex/worktrees/116b/motian/docs/brainstorms/2026-03-26-instant-vacatures-search-requirements.md) and should stay aligned with the shared vacature search contract already used by the page and API routes.

## Existing Patterns To Preserve
- `components/sidebar/use-sidebar-filters.ts` already owns URL sync, debounced search input, and React Query state for the vacancies sidebar.
- `components/sidebar/sidebar-utils.ts` already owns the browser-side fetch helper for `/api/vacatures/zoeken`.
- `src/lib/vacatures-search.ts` and `src/lib/job-search-runner.ts` already funnel search requests through the shared search service.
- `placeholderData: (prev) => prev` already keeps the previous page of results visible while React Query fetches the next result set.

## High-Level Technical Design
Normalize the search query in one shared place so UI and server agree on when a query counts as “live.” The sidebar should debounce the local input, commit the query to the URL only when it is at least 2 trimmed characters long, and clear the query back to the default listing when it drops below threshold. The search runners should apply the same normalization so direct route hits with short queries do not accidentally bypass the intended behavior.

## Implementation Units
- [ ] Add a shared vacatures search-query normalization helper in the central filter/search utilities and cover it with a focused unit test.
- [ ] Update the vacatures sidebar hook so the debounced input commits only normalized search text to the URL, while preserving the current result list during fetches.
- [ ] Update the shared vacatures search runners so short queries are treated as empty/default search state before they reach the search service.
- [ ] Adjust the sidebar search-related tests to cover 0-1 character fallback, 2+ character activation, and backspacing back below threshold.

## Test Coverage
- Shared helper test: verify trimming, 0-1 character suppression, and 2+ character activation.
- Sidebar behavior test: verify typing a short query does not trigger a committed search, typing a 2+ character query does, and reducing the query below threshold returns to the default listing state.
- Route runner test: verify a direct `/api/vacatures/zoeken` request with a 1-character query is normalized to the default search path.

## Risks & Dependencies
- If the short-query rule is only applied in the sidebar and not the route runners, direct URL loads or manual API calls could still search on 1-character input.
- If the query normalization is split across multiple files, the UI and API may drift again; the helper should stay shared.
- The current React Query placeholder-data pattern should be preserved so the page does not flash empty between keystrokes.

## Documentation / Operational Notes
- No docs update is expected beyond this plan and the existing brainstorm note.
- The change is intentionally limited to vacatures search behavior and should not alter kandidaten search.

## Sources & References
- **Origin document:** [docs/brainstorms/2026-03-26-instant-vacatures-search-requirements.md](/Users/cortex-air/.codex/worktrees/116b/motian/docs/brainstorms/2026-03-26-instant-vacatures-search-requirements.md)
- Related code: [components/sidebar/use-sidebar-filters.ts](/Users/cortex-air/.codex/worktrees/116b/motian/components/sidebar/use-sidebar-filters.ts)
- Related code: [components/sidebar/sidebar-utils.ts](/Users/cortex-air/.codex/worktrees/116b/motian/components/sidebar/sidebar-utils.ts)
- Related code: [src/lib/vacatures-search.ts](/Users/cortex-air/.codex/worktrees/116b/motian/src/lib/vacatures-search.ts)
- Related code: [src/lib/job-search-runner.ts](/Users/cortex-air/.codex/worktrees/116b/motian/src/lib/job-search-runner.ts)
