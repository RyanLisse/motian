---
title: "fix: Cron parser replacement and autopilot findings integrity"
type: fix
status: active
date: 2026-04-13
origin: docs/brainstorms/2026-04-13-databronnen-autopilot-bug-fixes-requirements.md
---

# fix: Cron parser replacement and autopilot findings integrity

## Overview

Two operational monitoring systems have confirmed silent runtime bugs. The scraper dashboard (databronnen) shows null for "next run" on every platform that uses a comma-separated hour schedule — which is all production schedules. The autopilot audit system writes findings without a transaction (partial saves are undetectable) and then sorts them in the wrong severity order. Neither bug produces a visible error.

This plan covers four implementation units: extract a correct cron parser utility, replace the two broken copies, wrap autopilot finding saves in a transaction, and fix the severity sort order.

## Problem Frame

- `cronIntervalMs` in `src/services/scraper-dashboard.ts` and `trigger/scrape-pipeline.ts` only handles `*/N` expressions. All production schedules (`0 6,10,14,18 * * *`) return null, making the "Volgende run" column and the overdue badge permanently broken.
- `saveAutopilotFindings` in `src/autopilot/persistence/index.ts` issues one `INSERT` per finding with no wrapping transaction. A mid-loop failure leaves the run partially written with no indication.
- `getRunFindings` sorts by `desc(autopilotFindings.severity)` — alphabetic string DESC — placing "medium" before "high" and "critical" at the bottom.

(see origin: `docs/brainstorms/2026-04-13-databronnen-autopilot-bug-fixes-requirements.md`)

## Requirements Trace

- R1. Replace `cronIntervalMs` in `src/services/scraper-dashboard.ts` with a correct 5/6-field cron parser
- R2. Replace `cronIntervalMs` in `trigger/scrape-pipeline.ts` with the same correct implementation
- R3. `getNextRunAt` must return a correct `Date` for comma-separated hour schedules
- R4. Extract the corrected parser to a shared utility (`src/lib/cron-utils.ts`) used by both call sites
- R5. `saveAutopilotFindings` must wrap all inserts in a single `db.transaction()`
- R6. `getRunFindings` must sort findings: critical → high → medium → low

## Scope Boundaries

- Bug-fix PR only — no circuit-breaker Map changes, no ISR changes, no new UI
- `getOpenFindings` (orders by `createdAt`) is correct — do not change its sort
- No schema migrations — all changes are code only

## Context & Research

### Relevant Code and Patterns

- `src/services/scraper-dashboard.ts:267–296` — `cronIntervalMs` and `getNextRunAt` (broken)
- `trigger/scrape-pipeline.ts:13–40` — second independent copy of `cronIntervalMs` (broken)
- `src/autopilot/persistence/index.ts:39–86` — `saveAutopilotFindings` loop + `getRunFindings` sort
- `src/services/chat-sessions.ts` — canonical `db.transaction(async (tx) => { ... })` pattern
- `src/services/gdpr.ts` — `db.transaction` returning a value (the `tx` parameter has the same API as `db`)
- `src/lib/helpers.ts` — shared utility convention: named exports, JSDoc, camelCase, no default export
- `trigger/scrape-pipeline.ts:1–12` — confirms `@/src/lib/` imports work from `trigger/`

### Cron expressions in production

| Expression | Source | Parser handles today? |
|---|---|---|
| `"0 6,10,14,18 * * *"` | `trigger/scrape-pipeline.ts`, `scraper-dashboard.ts` TRIGGER_TASKS | No — null |
| `"0 6 * * *"` | `scraper-dashboard.ts` TRIGGER_TASKS | Yes — `*/N` match? No, single digit. Returns null |
| `"0 2 * * *"` | `trigger/nightly-maintenance.ts` | Same — returns null |
| `"0 0 */4 * * *"` | DB schema default (6-field) | Yes — 6-field sliced to 5, `*/4` match |

`croner` handles all of these natively (5-field and 6-field). It has zero runtime dependencies.

### Severity column type

`autopilotFindings.severity` is plain Postgres `text` — no DB-level enum. String DESC sort gives: medium > low > high > critical. Fix is app-layer sort using a rank map after the DB query returns.

### Institutional Learnings

- All Drizzle imports must come from `@/src/db` (re-exports `@motian/db`) — not directly from `drizzle-orm`. Prevents version-mismatch instance conflicts.
- `db.transaction(async (tx) => { ... })` — `tx` is a drop-in for `db` inside the callback. No special Neon serverless setup needed.
- Trigger tasks may use dynamic imports (`await import(...)`) to avoid circular dependency between `src/services/` and `trigger/`.

## Key Technical Decisions

- **`croner` over `cron-parser`:** Zero runtime dependencies; native 5-field and 6-field support handles both the trigger schedules and the DB default `"0 0 */4 * * *"` without manual slicing.
- **App-layer severity sort:** `severity` is plain `text` — no Postgres enum ordinal to sort on. An app-layer `SEVERITY_RANK` map on a bounded result set (<50 findings/run) is simpler and avoids raw SQL template literals.
- **Shared utility at `src/lib/cron-utils.ts`:** `trigger/` already imports from `@/src/lib/` (confirmed in `trigger/scrape-pipeline.ts`). No workspace package changes needed.
- **Transaction wrapping only, no bulk-insert rewrite:** Atomicity is the goal. Keeping the existing loop under `db.transaction()` keeps the diff minimal and the existing `onConflictDoUpdate` logic unchanged.

## Open Questions

### Resolved During Planning

- **Can `trigger/` import from `src/lib/`?** Yes — `trigger/scrape-pipeline.ts` already imports `@/src/lib/helpers`, `@/src/lib/event-bus`, and `@/src/lib/notify-slack` via the `@/` alias.
- **DB-layer or app-layer sort for R6?** App-layer — `severity` is plain `text`, bounded result set, simpler and no raw SQL.
- **Does `croner` handle 6-field cron (with seconds)?** Yes — native support.

### Deferred to Implementation

- **Which platforms have `lastRunAt = null`?** Check whether any configured platform has never run, and whether `getNextRunAt` should fall back to `Date.now()` when `lastRunAt` is null (currently returns null). Low risk — null is already the current behavior.
- **`croner` API surface:** Verify the exact `croner` method call for "next run after a given date" before implementing — v8+ API uses `Cron` class with `.nextRun()`.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

**Fix A — Cron parser:**

```
src/lib/cron-utils.ts
  export parseCronNext(expression: string, after?: Date): Date | null
    → uses croner Cron class → .nextRun(after ?? new Date())
    → returns null on invalid expression

scraper-dashboard.ts            trigger/scrape-pipeline.ts
  delete cronIntervalMs()         delete cronIntervalMs()
  delete getNextRunAt()
  import { parseCronNext }        import { parseCronNext }
  use parseCronNext() directly    use parseCronNext() directly
```

**Fix B — Autopilot findings:**

```
saveAutopilotFindings(findings):
  BEFORE: for finding of findings → await db.insert(...)
  AFTER:  await db.transaction(async (tx) => {
            for finding of findings → await tx.insert(...)
          })

getRunFindings(runId):
  BEFORE: .orderBy(desc(autopilotFindings.severity))
  AFTER:  .orderBy() removed → sort in JS:
            const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 }
            results.sort((a, b) => (SEVERITY_RANK[a.severity] ?? 4) - (SEVERITY_RANK[b.severity] ?? 4))
```

## Implementation Units

- [x] **Unit 1: Create shared cron utility**

**Goal:** Install `croner`, create `src/lib/cron-utils.ts` exposing `parseCronNext`, and write unit tests for all production cron expressions.

**Requirements:** R1, R2, R3, R4

**Dependencies:** None

**Files:**
- Modify: `package.json` (add `croner` dependency)
- Create: `src/lib/cron-utils.ts`
- Create: `tests/cron-utils.test.ts`

**Approach:**
- `parseCronNext(expression: string, after?: Date): Date | null` — wraps `croner`'s `Cron` class, catches parse errors, returns null on invalid input
- Handle both 5-field and 6-field expressions (6-field = seconds prepended; `croner` handles natively)
- JSDoc on all exports; named exports only; no default export — follow `src/lib/helpers.ts` convention

**Patterns to follow:**
- `src/lib/helpers.ts` — utility shape and export style

**Test scenarios:**
- Happy path: `"0 6,10,14,18 * * *"` with `after = new Date("2026-04-13T07:00:00Z")` → next run is `2026-04-13T10:00:00Z`
- Happy path: `"0 6 * * *"` → returns a valid future Date
- Happy path: `"0 0 */4 * * *"` (6-field) → returns a valid future Date
- Edge case: `null` input → returns `null`
- Edge case: `""` (empty string) → returns `null`
- Edge case: `"*/N"` malformed → returns `null` without throwing
- Edge case: expression where next run is far in the future → still returns a Date

**Verification:**
- `tests/cron-utils.test.ts` passes with `vitest run tests/cron-utils.test.ts`
- All production cron expressions return a non-null Date

---

- [x] **Unit 2: Replace `cronIntervalMs` in both call sites**

**Goal:** Remove the two broken copies of `cronIntervalMs` and `getNextRunAt`, replace with `parseCronNext` imports.

**Requirements:** R1, R2, R3, R4

**Dependencies:** Unit 1

**Files:**
- Modify: `src/services/scraper-dashboard.ts`
- Modify: `trigger/scrape-pipeline.ts`
- Modify: `tests/scraper-dashboard.test.ts` (add/update cron-related test scenarios if present; add cron smoke test if not)

**Approach:**
- `scraper-dashboard.ts`: Delete `cronIntervalMs` (lines 267–286) and `getNextRunAt` (lines 288–296). Replace the `getNextRunAt` call site with `parseCronNext(config.cronExpression, config.lastRunAt ?? undefined)` imported from `@/src/lib/cron-utils`
- `trigger/scrape-pipeline.ts`: Delete its `cronIntervalMs` function (lines 13–38). Replace the call at line 39 with `parseCronNext(cronExpression)` imported from `@/src/lib/cron-utils`
- The `isDue()` check in `trigger/scrape-pipeline.ts` uses `cronIntervalMs` to compute whether a platform is overdue — verify the call site and adapt to `parseCronNext`'s return type (`Date | null` instead of `number | null`)

**Patterns to follow:**
- Existing `@/src/lib/helpers` import style in `trigger/scrape-pipeline.ts`

**Test scenarios:**
- Integration: `getNextRunAt`-equivalent now returns non-null Date for `"0 6,10,14,18 * * *"` (the previously broken case)
- Integration: Overdue badge logic in the dashboard correctly reflects a past `parseCronNext` result

**Verification:**
- `pnpm lint` passes (no unused variable warnings for deleted functions)
- `pnpm exec tsc --noEmit` passes
- The "Volgende run" column in databronnen renders a non-null timestamp for all configured platforms

---

- [x] **Unit 3: Wrap `saveAutopilotFindings` in a transaction**

**Goal:** Make autopilot finding writes atomic — all findings for a run commit together or none do.

**Requirements:** R5

**Dependencies:** None (independent of Units 1–2)

**Files:**
- Modify: `src/autopilot/persistence/index.ts`
- Modify: `tests/autopilot-persistence.test.ts`

**Approach:**
- Wrap the `for` loop in `saveAutopilotFindings` with `await db.transaction(async (tx) => { ... })`
- Replace `db.insert(...)` calls inside the loop with `tx.insert(...)` — `tx` is a drop-in for `db`
- The `onConflictDoUpdate` clause on each insert remains unchanged
- The early return for `findings.length === 0` stays outside the transaction (no-op guard)

**Patterns to follow:**
- `src/services/chat-sessions.ts` — `db.transaction(async (tx) => { ... })` with multiple `tx.insert` / `tx.update` calls

**Test scenarios:**
- Happy path: 3 findings → all 3 inserted; `db.transaction` called once; callback receives `tx` with `insert`
- Error path: `tx.insert` throws on the second finding → transaction rolled back; no findings persisted (verify `db.transaction` propagates the error)
- Edge case: `findings.length === 0` → `db.transaction` never called, function returns early
- Happy path: existing finding (conflict) → `onConflictDoUpdate` updates status without error

**Execution note:** Update the existing `db` mock in `tests/autopilot-persistence.test.ts` to add `transaction: vi.fn(async (cb) => cb(txMock))` where `txMock` mirrors the `insert` chain mock.

**Verification:**
- `vitest run tests/autopilot-persistence.test.ts` passes
- Existing `saveAutopilotFindings` call sites require no changes (same signature)

---

- [x] **Unit 4: Fix `getRunFindings` severity sort**

**Goal:** Findings returned by `getRunFindings` appear in correct severity order: critical → high → medium → low.

**Requirements:** R6

**Dependencies:** None (independent)

**Files:**
- Modify: `src/autopilot/persistence/index.ts`
- Modify: `tests/autopilot-persistence.test.ts`

**Approach:**
- Remove `.orderBy(desc(autopilotFindings.severity))` from `getRunFindings`
- After the query returns, sort the result array using `const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 }` — sort ascending by rank value, with unknown severities ranked last
- Define `SEVERITY_RANK` as a module-level constant (not inside the function) so it's reusable
- `getOpenFindings` is unchanged — it orders by `createdAt` and is correct

**Patterns to follow:**
- `src/autopilot/analysis/schemas.ts` — the Zod enum `z.enum(["critical", "high", "medium", "low"])` is the canonical severity list; keep `SEVERITY_RANK` keys aligned

**Test scenarios:**
- Happy path: DB returns `[{ severity: "medium" }, { severity: "critical" }, { severity: "low" }, { severity: "high" }]` → output order is `critical, high, medium, low`
- Edge case: All findings have the same severity → original relative order preserved (stable sort)
- Edge case: Finding with unknown/missing severity → ranked last, no crash
- Edge case: Empty result → returns `[]`

**Verification:**
- `vitest run tests/autopilot-persistence.test.ts` passes
- The autopilot findings list in the dashboard shows critical findings first

## System-Wide Impact

- **API surface parity:** `getRunFindings` and `saveAutopilotFindings` are called from `app/autopilot/data.ts` and autopilot Trigger.dev tasks — both call sites pass unchanged data; signatures do not change.
- **Unchanged invariants:** `getOpenFindings`, `saveAutopilotRun`, `updateFindingStatus`, and `getRecentRuns` are not touched.
- **Integration coverage:** The transaction fix cannot be fully proven by unit tests alone — a real DB integration test would confirm rollback behavior. Deferred; the unit mock is sufficient for CI coverage of the call pattern.
- **Error propagation:** A transaction failure in `saveAutopilotFindings` will now throw rather than silently leave partial state. The Trigger.dev task calling it already has retry logic — this is the correct behavior.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `croner` API changed in a recent major version | Verify `.nextRun()` method signature against installed version before implementing Unit 1 |
| `isDue()` in `trigger/scrape-pipeline.ts` depends on `cronIntervalMs` returning `number | null` | Unit 2 explicitly requires checking and adapting the `isDue` call site to `Date | null` return type |
| App-layer severity sort breaks if a new severity value is added later | `SEVERITY_RANK` map ranks unknowns last (no crash); adding new severities requires updating the map — this is explicit and intentional |
| Existing `autopilot-persistence.test.ts` mock doesn't include `transaction` | Unit 3 explicitly requires updating the mock — this is a known prerequisite, not a surprise |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-13-databronnen-autopilot-bug-fixes-requirements.md](docs/brainstorms/2026-04-13-databronnen-autopilot-bug-fixes-requirements.md)
- Transaction pattern: `src/services/chat-sessions.ts`, `src/services/gdpr.ts`
- Utility convention: `src/lib/helpers.ts`
- Severity enum: `src/autopilot/analysis/schemas.ts`
- Persistence test: `tests/autopilot-persistence.test.ts`
- Scraper dashboard test: `tests/scraper-dashboard.test.ts`
