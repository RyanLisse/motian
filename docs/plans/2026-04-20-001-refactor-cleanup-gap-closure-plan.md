---
title: Refactor cleanup and gap-closure plan
type: refactor
status: active
date: 2026-04-20
owner: Codex
---

# Refactor cleanup and gap-closure plan

## Overview

This plan covers a staged cleanup and optimization pass across Motian with three priorities:

1. reduce code volume where the current implementation is more complex than needed
2. remove dead or legacy surfaces that increase maintenance cost
3. close planning and operational blockers that make future cleanup unsafe or noisy

The current repo already contains partial fixes for some historically open issues, so this plan also includes tracker hygiene to prevent future work from being mis-prioritized against stale problem statements.

## Problem Frame

Read-only analysis of the current codebase found a small number of high-value cleanup targets:

- `src/services/normalize.ts` concentrates validation, row building, batching, and persistence in one large file with duplicated field mapping and a likely avoidable lookup hotspot
- `app/vacatures/filters.tsx` appears to be a legacy duplicate UI surface relative to the active vacatures sidebar/filter stack
- canonical route policy has migrated to `/vacatures` and `/kandidaten`, but some UI helpers still carry `/opdrachten` assumptions
- `src/services/candidates.ts` duplicates both query-building and post-write orchestration patterns
- scrape and enrichment architecture has moved toward separate boundaries, but some tests and issue statements still reflect older coupling

Two non-code blockers also exist:

- the installed `cmux` binary in this environment is a workspace/window controller, not the git-worktree CLI described by the `$cmux-and-worktrees` skill, so worktree automation cannot be relied on here
- the current checkout is dirty, so broad cleanup on top of `main` is unsafe until the intended write scope is isolated

## Requirements Trace

- R1. Reduce code and duplication in behavior-sensitive service paths without changing product behavior.
- R2. Remove dead or legacy UI surfaces when confirmed unused.
- R3. Normalize canonical route assumptions so `/vacatures` remains the explicit recruiter-facing vacatures path.
- R4. Keep existing filtering, search, scheduling, and write-side effects behavior stable unless a targeted fix is explicitly required.
- R5. Update stale tracker assumptions so future work reflects current repo reality.
- R6. Preserve repo conventions: no new dependencies, small diffs, repo-relative paths only, and regression coverage before behavior-sensitive refactors.

## Scope Boundaries

- No database schema redesign in `src/db/schema.ts` or `drizzle/**`
- No large UI redesigns or feature additions
- No behavior changes beyond cleanup, consistency normalization, and stale-test alignment
- No new dependencies
- No production-side credential or deployment changes in this pass

## Local Research Summary

### High-value code targets

- `src/services/normalize.ts` contains the strongest code-reduction opportunity: helper extraction, row mapping consolidation, and conflict-update field reuse.
- `src/services/candidates.ts` already centralizes some search condition logic, but still duplicates count/list orchestration and post-write side effects.
- `src/services/scrape-pipeline.ts` and `src/services/ai-enrichment.ts` are already separated conceptually, but tests still need alignment with that boundary.

### UI and route findings

- Active vacatures filtering is centered on `components/opdrachten-sidebar.tsx` and `components/sidebar/*`.
- `app/vacatures/filters.tsx` appears to be a stale parallel surface.
- `components/navigation-config.ts` uses `/vacatures` as canonical but still carries `/opdrachten` compatibility matching.

### Operational findings

- `trigger/scrape-pipeline.ts` already respects per-platform `cronExpression`; the old “cron ignored” problem statement appears stale.
- `proxy.ts` exists and appears to have replaced `middleware.ts`; the corresponding migration bead appears stale.
- Interviews and Messages exist in navigation overflow; the “missing nav item” statement is stale as written.
- Pagination exists in multiple recruiter surfaces; the “no pagination anywhere” statement is stale as written.

## Key Technical Decisions

1. **Start with `src/services/normalize.ts`.**  
   It offers the highest ratio of code reduction to regression risk.

2. **Treat dead-code removal as a separate, lower-risk lane after service stabilization.**  
   This keeps deletion work easy to review and easy to revert.

3. **Make route compatibility explicit.**  
   Keep `/vacatures` canonical and preserve `/opdrachten` only where compatibility is intentional and still needed.

4. **Prefer extraction of shared helpers over new abstraction layers.**  
   This cleanup should delete and simplify, not create new architectural indirection.

5. **Update tracker items after verification.**  
   Stale issue descriptions are themselves blockers because they distort future prioritization.

## Existing Patterns to Follow

- Service decomposition under `src/services/jobs/`:
  - `src/services/jobs/list.ts`
  - `src/services/jobs/page-query.ts`
  - `src/services/jobs/repository.ts`
- Shared UI primitives:
  - `components/shared/pagination.tsx`
  - `components/shared/empty-state.tsx`
  - `components/shared/kpi-card.tsx`
  - `components/sidebar/*`
- DB-driven schedule handling:
  - `trigger/scrape-pipeline.ts`
  - `src/lib/cron-utils.ts`

## Open Questions

### Resolved During Planning

- **Is per-platform scrape scheduling still broken?** No. `trigger/scrape-pipeline.ts` already checks `cfg.cronExpression` and `cfg.lastRunAt` before dispatch.
- **Are Interviews and Messages still missing from nav?** No. They now exist in the overflow nav group.
- **Is pagination entirely absent?** No. Pagination exists in multiple recruiter-facing surfaces.

### Deferred to Implementation

- Whether `app/vacatures/filters.tsx` is truly deletable versus needing a compatibility wrapper for tests or stories.
- Whether candidate count/list duplication should be solved with a shared scoped query or with a more explicit rows-plus-total query pattern.
- Whether any `/opdrachten` compatibility route remains required by active consumers outside the Next.js UI.

## Implementation Units

- [ ] **Unit 1: Stabilize workspace before cleanup**

**Goal:** Ensure cleanup work starts from an isolated, reviewable write scope instead of the current dirty checkout.

**Requirements:** R4, R6

**Dependencies:** None

**Files:**
- Modify: `.gitignore`
- Operational scope: repo root git state only

**Approach:**
- Isolate cleanup work from unrelated local modifications before changing behavior-sensitive files.
- Add `.worktrees/` to `.gitignore` so future worktree-based isolation remains clean even if this environment’s `cmux` cannot manage them.
- Keep the eventual cleanup diff restricted to intended files only.

**Patterns to follow:**
- Existing repo hygiene and small-diff expectations from root guidance.

**Test scenarios:**
- `git status` shows only intended cleanup files before refactor work begins.
- `.worktrees/` is ignored by git after the update.

**Verification:**
- Manual git-state verification before implementation proceeds.

---

- [ ] **Unit 2: Refactor `src/services/normalize.ts`**

**Goal:** Reduce duplication and simplify normalization persistence logic without changing behavior.

**Requirements:** R1, R4, R6

**Dependencies:** Unit 1

**Files:**
- Modify: `src/services/normalize.ts`
- Modify: `tests/normalization.test.ts`
- Modify: `tests/normalize-job-derived-fields.test.ts`
- Add: targeted normalization regression test file if existing coverage is insufficient

**Approach:**
- Extract a canonical helper for normalized job row construction.
- Centralize the `onConflictDoUpdate().set` field mapping so insert/update field definitions do not drift independently.
- Replace any repeated linear lookup work in batch reconciliation with pre-indexed lookup maps where safe.
- Keep validation, field derivation, batching, and persistence boundaries explicit.

**Patterns to follow:**
- Small focused helper extraction rather than new service layers.
- Existing test style in `tests/normalize-job-derived-fields.test.ts`.

**Test scenarios:**
- Derived dedupe/search fields stay identical for representative jobs.
- Batch chunking behavior remains stable for row and byte limits.
- Upsert still updates the intended mutable fields.
- Validation failures still accumulate correctly while valid rows continue.
- Duplicate accounting and returned `jobIds` remain stable.

**Verification:**
- `pnpm lint`
- targeted normalization tests
- `pnpm exec tsc --noEmit`

---

- [ ] **Unit 3: Remove or collapse stale vacatures filter UI**

**Goal:** Eliminate duplicate UI surface if `app/vacatures/filters.tsx` is not part of the live recruiter flow.

**Requirements:** R2, R4

**Dependencies:** Unit 1

**Files:**
- Modify or delete: `app/vacatures/filters.tsx`
- Modify: any test/story/import reference that still depends on it

**Approach:**
- Confirm import usage in runtime code.
- If unused in runtime, delete the file.
- If referenced only by tests or stories, replace it with a thin compatibility wrapper or shared export instead of maintaining a separate filter implementation.

**Patterns to follow:**
- Prefer deletion over abstraction.
- Reuse `components/opdrachten-sidebar.tsx` and `components/sidebar/*` rather than parallel page-specific filters.

**Test scenarios:**
- No live route imports depend on the deleted/reduced file.
- Vacatures filtering still renders and behaves through the active sidebar flow.
- Story/test references are either updated or removed cleanly.

**Verification:**
- `pnpm lint`
- targeted UI structural tests if present

---

- [ ] **Unit 4: Normalize `/vacatures` versus `/opdrachten` route policy**

**Goal:** Make canonical route handling explicit and remove stale UI assumptions.

**Requirements:** R3, R4

**Dependencies:** Unit 3 is preferred but not required

**Files:**
- Modify: `components/navigation-config.ts`
- Modify: `components/opdrachten-layout-shell.tsx`
- Modify: `components/chat/chat-context-provider.tsx`
- Modify: any additional route helper still branching on `/opdrachten`
- Possibly review only: `app/api/opdrachten/*`

**Approach:**
- Inventory all recruiter-facing path checks for `/opdrachten`.
- Keep `/vacatures` as canonical UI route.
- Preserve `/opdrachten` matching only where compatibility is intentional and verified as needed.
- Remove silent path drift in active-nav and context logic.

**Patterns to follow:**
- Current canonical route preference documented in repo guidance.

**Test scenarios:**
- `/vacatures` remains active in navigation and related context helpers.
- If `/opdrachten` compatibility remains, it does so through explicit, tested behavior.
- No route-dependent recruiter context regresses.

**Verification:**
- `pnpm lint`
- targeted route/navigation tests
- `pnpm exec tsc --noEmit`

---

- [ ] **Unit 5: Deduplicate candidate search and post-write orchestration**

**Goal:** Simplify `src/services/candidates.ts` by reducing duplicated query and side-effect logic.

**Requirements:** R1, R4, R6

**Dependencies:** Unit 1

**Files:**
- Modify: `src/services/candidates.ts`
- Modify: candidate-related tests covering search, count, create, and update flows

**Approach:**
- Reuse the existing search condition builder more aggressively across list and count paths.
- Evaluate whether the paginated candidate UI flow can share one scoped query approach for rows and totals without behavior changes.
- Extract shared post-write orchestration for skill sync, deferred embedding sync, and auto-match event emission.

**Patterns to follow:**
- Keep helpers local and narrow.
- Preserve current mutation semantics.

**Test scenarios:**
- Search results stay stable across query, location, role, availability, and `escoUri` filters.
- Counts still match visible filtered totals.
- Create/update flows still persist fields and trigger expected side effects.
- Auto-match still only fires when candidate data is sufficiently complete.

**Verification:**
- `pnpm lint`
- targeted candidate tests
- `pnpm exec tsc --noEmit`

---

- [ ] **Unit 6: Reconcile scrape and enrichment boundary in code/tests**

**Goal:** Align tests and cleanup assumptions with the current architecture where scrape and enrichment are separate concerns.

**Requirements:** R1, R4, R5

**Dependencies:** Unit 1

**Files:**
- Modify: `src/services/scrape-pipeline.ts`
- Modify: `src/services/ai-enrichment.ts`
- Modify: `tests/scrape-pipeline-run.test.ts`
- Modify: `tests/scrape-pipeline-concurrency.test.ts`
- Modify: `tests/ai-enrichment.test.ts`

**Approach:**
- Keep scrape responsibilities focused on scrape, normalize, and result recording.
- Keep enrichment responsibilities focused on enrichment updates and follow-on embedding behavior.
- Remove stale test assumptions that still expect inline enrichment from scrape execution when that is no longer the architecture.

**Patterns to follow:**
- Current Trigger/task split implied by `trigger/scrape-pipeline.ts` and service comments.

**Test scenarios:**
- Scrape pipeline tests verify scrape-path behavior only.
- Enrichment tests verify enrichment behavior independently.
- Concurrency behavior remains bounded and predictable.
- Successful and failing paths keep current external response shapes where applicable.

**Verification:**
- `pnpm lint`
- targeted scrape/enrichment tests
- `pnpm exec tsc --noEmit`

---

- [ ] **Unit 7: Update stale tracker items and planning assumptions**

**Goal:** Remove false blockers from the active backlog so future work is scoped against current reality.

**Requirements:** R5

**Dependencies:** Units 2–6 may provide final confirmation, but partial updates can begin earlier

**Files:**
- Tracker/bead metadata as applicable
- Optional supporting note in `docs/analysis/` or follow-up planning docs if needed

**Approach:**
- Re-verify and rewrite stale issue statements for:
  - `motian-uml`
  - `motian-ocy`
  - `motian-55q`
  - `motian-o5g`
- Update wording to reflect actual remaining gaps instead of obsolete problem frames.

**Patterns to follow:**
- Keep tracker items specific, current, and implementation-relevant.

**Test scenarios:**
- Manual verification against current code references is sufficient unless tracker changes trigger code edits.

**Verification:**
- Manual review of updated tracker statements against current files.

## System-Wide Impact

- Service cleanup should reduce maintenance friction in core ingestion and candidate paths.
- Dead-code removal should reduce UI ambiguity and future refactor risk.
- Route normalization should eliminate subtle recruiter-path inconsistencies.
- Tracker hygiene should improve future planning, automation, and prioritization quality.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Normalization cleanup changes ingest behavior | Add characterization/regression tests before simplification and keep the refactor narrow. |
| Dead UI deletion breaks hidden references | Verify import usage first; preserve a thin wrapper if tests/stories still depend on it. |
| Route normalization breaks compatibility consumers | Preserve `/opdrachten` only where usage is confirmed and make compatibility explicit. |
| Candidate-side effect extraction changes timing | Keep semantics stable and test create/update flows directly. |
| Cleanup mixes with unrelated local changes | Start from an isolated intended diff after Unit 1. |

## Execution Sequence

1. Unit 1 — stabilize workspace
2. Unit 2 — refactor `src/services/normalize.ts`
3. Unit 3 — remove/collapse stale vacatures filter UI
4. Unit 4 — normalize route policy
5. Unit 5 — deduplicate candidate orchestration
6. Unit 6 — reconcile scrape/enrichment boundary
7. Unit 7 — update stale tracker items

## Done Criteria

- `src/services/normalize.ts` is smaller and less duplicated with behavior locked by tests.
- Dead or duplicate vacatures filter code is removed or reduced to a compatibility wrapper.
- Canonical `/vacatures` route handling is explicit and consistent.
- `src/services/candidates.ts` has less duplicated query and mutation orchestration.
- Scrape and enrichment tests reflect the current architecture.
- Stale tracker items are updated to match current repo reality.
- Verification passes for each touched unit: `pnpm lint`, targeted tests, and `pnpm exec tsc --noEmit`.
