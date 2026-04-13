---
date: 2026-04-13
topic: scraper-databronnen-autopilot-reliability
focus: "scraper/databronnen page is broken, also autopilot is broken, keeps failing"
---

# Ideation: Scraper Databronnen & Autopilot Reliability

## Codebase Context

- **Project:** Motian — Dutch-language Next.js 16 recruitment platform on Vercel
- **Stack:** Neon PostgreSQL + Drizzle ORM + pgvector, Vercel AI SDK, LiveKit voice agent, Trigger.dev v4 background tasks
- **Three agent surfaces** (chat, MCP, voice) share `src/services/` — fixes there ripple everywhere

### Databronnen (scraper dashboard) — confirmed bugs
1. `withTimeoutFallback` in `app/scraper/page.tsx` uses `Promise.race` — after timeout fires, the real load still runs and can incorrectly update circuit-breaker state (timer leak)
2. `scraperPageFailureUntil` is a module-level `Map` — does not persist across Vercel cold starts; page silently shows blank/stale data for 30s with no visible error
3. `cronIntervalMs` only handles `*/N` cron expressions — cannot parse `0 6,10,14,18 * * *` (comma-separated hours) → "next run" column and overdue badge are permanently null/wrong for real schedules
4. Test suite is static source-grep only — catches no runtime data bugs

### Autopilot (nightly browser audit) — confirmed bugs
1. `loadRunEvidenceFromReportUrl` silently returns `[]` on blob storage failure — UI shows "no evidence" with no explanation (most likely root cause of "keeps failing")
2. `deriveSummaryUrl` uses fragile `lastIndexOf("/")` pathname slice — breaks if blob URL has query params or trailing slash
3. `saveAutopilotFindings` does per-finding individual DB inserts in a loop — no transaction wrapping, partial failure leaves silently corrupted run records
4. Severity sort is alphabetic `DESC` — gives wrong order: medium > low > high > critical
5. `export const revalidate = 300` (ISR) on autopilot page — failures during 5-minute cache window are invisible to operators

### Past learnings applied
- Autopilot runs Playwright via Modal Sandbox (not local Chromium) — correct architecture
- Scraper analytics uses DB-level SQL aggregation
- `revalidateTag(tag, "default")` requires the second argument in Next.js 16

---

## Ranked Ideas

### 1. Replace the cron parser with a library
**Description:** Swap the hand-rolled `cronIntervalMs` function (which only handles `*/N` syntax) for `croner` or `cron-parser`. Expose a typed `getNextRun(expression: string): Date | null` utility. Both the "next run" column and the "overdue" badge derive from it. Can also expose `toHumanLabel()` for display.
**Rationale:** The most visibly broken thing in databronnen — every schedule using comma-separated hours shows null as the next run time. One package swap fixes it completely. No schema changes, zero migration risk. A shared utility prevents the bug from being re-introduced in future cron-aware features.
**Downsides:** Adds a dependency; `croner` is zero-dep but needs auditing for DST edge cases on Dutch timezone (CET/CEST).
**Confidence:** 97%
**Complexity:** Low
**Status:** Unexplored

---

### 2. Bulk transactional insert for autopilot findings + fix severity sort
**Description:** Replace the `saveAutopilotFindings` loop of individual inserts with a single `db.transaction(() => db.insert(...).values(allFindings).onConflictDoUpdate(...))`. Bundle with a 5-line fix: replace alphabetic severity `DESC` sort with `const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 }` index lookup in `getRunFindings` and `getOpenFindings`.
**Rationale:** Two independent bugs, both trivially fixable together in one PR. The transaction prevents partial-write silent corruption of audit history. The sort fix means critical findings appear at the top of every findings list, not buried below "medium."
**Downsides:** Transaction adds a single DB round-trip overhead (negligible for typical finding counts of <50 per run).
**Confidence:** 98%
**Complexity:** Low
**Status:** Unexplored

---

### 3. AbortController to fix the `withTimeoutFallback` timer leak
**Description:** Replace the `Promise.race` pattern in `withTimeoutFallback` with `AbortController` + `AbortSignal.timeout()`. Pass the signal into the underlying scraper fetch call. When the timeout fires, the real load is cancelled — it can never fire late and incorrectly update `scraperPageFailureUntil` state.
**Rationale:** The current race doesn't kill the loser — both branches can fire side effects independently. `AbortController` is the correct structural primitive for this pattern, not a patch on top of the race.
**Downsides:** Requires the underlying fetch/scrape call to respect the `AbortSignal` — need to verify the call chain passes the signal all the way down.
**Confidence:** 90%
**Complexity:** Low–Medium
**Status:** Unexplored

---

### 4. Typed `StorageResult<T>` wrapper for blob storage reads
**Description:** Wrap `loadRunEvidenceFromReportUrl` (and any future blob reads in `src/autopilot/`) in a discriminated union return: `{ ok: true; data: T } | { ok: false; reason: 'not-found' | 'timeout' | 'parse-error' }`. Callers must handle the failure branch. The UI renders an amber "Evidence unavailable — blob missing" chip vs. a green "Clean run" chip — never silent empty.
**Rationale:** Silent `[]` on blob failure is the most likely root cause of "autopilot keeps failing." The run completes, evidence is empty, nothing explains why. A typed result makes failure observable at the consumption point, eliminates a debugging path that currently takes 20+ minutes.
**Downsides:** Requires touching all call sites of `loadRunEvidenceFromReportUrl`; small refactor scope (~3 files).
**Confidence:** 94%
**Complexity:** Low–Medium
**Status:** Unexplored

---

### 5. Store canonical `summary_url` at write time — delete `deriveSummaryUrl`
**Description:** When the autopilot Trigger.dev task saves its run record, compute and store the summary URL as a plain string column on `autopilot_runs`. Readers use `SELECT summary_url` directly. Delete `deriveSummaryUrl` and all its `lastIndexOf("/")` string-slicing logic entirely.
**Rationale:** URL derivation at read time is fragile by design — it assumes blob URL shape never changes (it does: signed URLs add query params, CDN cache-busters append fragments). Storing at write time removes the fragility permanently. The function and its bugs cease to exist.
**Downsides:** Requires a Drizzle migration to add `summary_url` column to `autopilot_runs`. Schema changes are medium-risk tier per `harness.config.json` — requires lint + typecheck + tests gate before merging.
**Confidence:** 93%
**Complexity:** Low (code) + Medium (schema migration review)
**Status:** Unexplored

---

### 6. DB-backed circuit-breaker state (replace module-level Map)
**Description:** Replace `scraperPageFailureUntil` Map with writes to a `scraper_state` Neon table (or upsert a row in an existing table) — keyed by scraper source, storing `failedAt` and `cooldownUntil`. Page load reads the DB and gets correct state regardless of cold starts. A Trigger.dev task clears stale rows after TTL.
**Rationale:** Module-level singletons in serverless are functionally ephemeral — every cold start resets the circuit breaker. The page then silently shows blank/stale data for 30s whenever a cold start coincides with a scraper failure. This is the architectural fix; it also gives a queryable audit log of scraper health.
**Downsides:** DB writes on scraper failures add latency to the failure path (though this is already a failed path). Requires schema migration for the state table.
**Confidence:** 88%
**Complexity:** Medium
**Status:** Unexplored

---

### 7. On-demand revalidation via `revalidateTag` instead of ISR 300s
**Description:** Remove `export const revalidate = 300` from `app/autopilot/page.tsx`. Emit `revalidateTag('autopilot-run', 'default')` at the end of each Trigger.dev autopilot task (pass and fail). Apply the same pattern to databronnen — emit `revalidateTag('scraper-dashboard', 'default')` after each scraper run completes.
**Rationale:** A 5-minute stale window on a *failure* is a buried alert. On-demand revalidation is the canonical Next.js 16 pattern and is already required by project conventions (`revalidateTag` with the 2-arg form). Failures surface within seconds.
**Downsides:** Trigger.dev tasks must call a Next.js revalidation API endpoint — that endpoint needs auth (avoid open revalidation). Adds a network call from the task runner; mild operational coupling.
**Confidence:** 85%
**Complexity:** Medium
**Status:** Unexplored

---

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | Invert evidence to DB instead of blob | Blob is correct for binary evidence (screenshots, video, HAR); fix the access layer, not the architecture |
| 2 | Generic React error boundary pattern | Too generic — specific failure sites need specific handling; a catch-all doesn't fix silent `[]` returns |
| 3 | Evidence gap UI distinction (no findings vs. load failed) | Subsumed by idea #4 — typed StorageResult makes this a trivial UI consequence, not a standalone idea |
| 4 | Staleness-aware data display with freshness contracts | Idea #7 is more concrete; staleness contracts are a design principle better suited for brainstorm |
| 5 | Self-reporting `/api/gezondheid/monitoring` health endpoint | Right direction, but a follow-on compound investment after acute fixes land |
| 6 | Daily scraper health digest (email/Slack) | Fix the dashboard to show correct state first; notification layer is additive, not foundational |
| 7 | Runtime integration test harness for `src/services/` | High-leverage but preventive — better as a dedicated follow-on session after acute bugs are patched |

---

## Session Log
- 2026-04-13: Initial ideation — 38 raw candidates generated (4 parallel agents), deduped to 14 distinct ideas, 7 survived adversarial filtering. Symphony not active (port 4000 unreachable).
