---
date: 2026-04-13
topic: databronnen-autopilot-bug-fixes
---

# Databronnen & Autopilot Bug Fixes

## Problem Frame

Two operational systems — the scraper dashboard (databronnen) and the nightly autopilot audit — have confirmed runtime bugs that make them unreliable for recruiters and operators.

**Databronnen:** The cron parser only handles `*/N`-style expressions. All real production schedules use comma-separated hours (e.g., `0 6,10,14,18 * * *`), so "next run" is permanently null and the overdue badge never fires correctly.

**Autopilot:** Findings are written to the database one row at a time inside a for-loop with no transaction, making partial-write corruption silent and undetectable. Findings are then sorted alphabetically by severity string in DESC order, which puts "medium" above "high" and "critical" at the bottom.

Neither bug produces a visible error — both fail silently, which is why they went undetected.

---

## Requirements

**Databronnen — cron parser**

- R1. Replace `cronIntervalMs` in `src/services/scraper-dashboard.ts` with a correct implementation that handles all standard 5-field cron expressions, including comma-separated values, ranges, and step values — not only `*/N` intervals.
- R2. Replace `cronIntervalMs` in `trigger/scrape-pipeline.ts` with the same correct implementation (two independent copies of the same broken function exist).
- R3. `getNextRunAt` in `src/services/scraper-dashboard.ts` must return a correct `Date` for the schedules currently in production (e.g., `0 6,10,14,18 * * *`). The "next run" column and overdue badge must derive from this corrected value.
- R4. The corrected parser should be extracted to a shared utility so the two call sites use a single implementation going forward.

**Autopilot — findings persistence and sort**

- R5. `saveAutopilotFindings` in `src/autopilot/persistence/index.ts` must wrap all findings inserts in a single database transaction. Either all findings for a run commit together, or none do.
- R6. `getRunFindings` in `src/autopilot/persistence/index.ts` must sort findings in severity order: critical → high → medium → low. The current `desc(autopilotFindings.severity)` string sort produces the wrong order and must be replaced.

---

## Success Criteria

- The "Volgende run" column in databronnen shows a real, non-null timestamp for all platforms using comma-separated hour schedules.
- The overdue badge correctly appears when the calculated next-run time has passed.
- An autopilot run that produces N findings always has exactly N findings in the database — no partial saves.
- The autopilot findings list displays critical findings first, followed by high, medium, low.

---

## Scope Boundaries

- This is a bug-fix PR only. No new UI, no new features, no changes to the circuit-breaker Map or ISR cache strategy (those are separate ideation ideas #3–#7).
- The `getOpenFindings` function (line 95 in `persistence/index.ts`) orders by `createdAt` and is correct — do not change its sort.
- No schema migrations. R5 and R6 require only code changes.

---

## Key Decisions

- **Shared cron utility, not inline fix:** R4 extracts the parser rather than patching each file independently, so a third call site can't silently re-introduce the bug.
- **Transaction wrapping only, no bulk-insert rewrite:** R5 adds a `db.transaction()` wrapper to the existing loop. A full bulk-insert rewrite (`db.insert(...).values([...])`) would be stronger but is out of scope for this fix PR to keep the diff minimal and reviewable.

---

## Dependencies / Assumptions

- A cron parser library (`croner` recommended — zero dependencies, handles standard 5- and 6-field expressions) will be added as a dependency. Verified it is not currently in `package.json`.
- Drizzle's `db.transaction()` is available via the existing `@/src/db` import — no new infrastructure required.

---

## Outstanding Questions

### Deferred to Planning

- [Affects R1, R2][Needs research] Confirm which cron expressions are in active use across all configured platform scrapers so the fix can be validated against real data before merging.
- [Affects R3][Technical] `getNextRunAt` currently requires a non-null `lastRunAt` — verify whether any platform has never run (null `lastRunAt`) and whether a fallback (e.g., calculate from now) is needed.
- [Affects R4][Technical] Verify whether `trigger/scrape-pipeline.ts` and `src/services/scraper-dashboard.ts` share a package boundary that allows a single shared utility import, or whether the shared utility must be placed in a workspace package (e.g., `packages/`).
- [Affects R6][Technical] The current severity sort happens at the DB layer (`orderBy desc`). The fix will likely require an app-layer sort (JS after query) or a SQL `CASE` expression — confirm which approach fits the existing query pattern before implementing.

---

## Next Steps

-> `/ce:plan` for structured implementation planning
