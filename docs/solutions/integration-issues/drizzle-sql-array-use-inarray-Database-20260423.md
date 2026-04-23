---
title: Don't pass a JS array to Postgres `= ANY(...)` via Drizzle's `sql` template — use `inArray`
date: 2026-04-23
category: integration-issues
module: Database
problem_type: database_issue
component: database
symptoms:
  - "op ANY/ALL (array) requires array on right side"
  - "Trigger.dev scheduled task FAILED every run for weeks with no Sentry alert"
  - "Drizzle query silently fails on a correlated IN-clause"
root_cause: wrong_api
resolution_type: code_fix
severity: high
tags: [drizzle, postgres, sql-template, inarray, trigger-dev, silent-failure]
---

# Don't pass a JS array to Postgres `= ANY(...)` via Drizzle's `sql` template — use `inArray`

## Problem

`trigger/agent-orchestrator.ts` had been crashing on every scheduled run for weeks (every 12h, ~60 failures total) with `error: op ANY/ALL (array) requires array on right side`. The reason: it used a Drizzle `sql` template to inline a JS array directly on the right-hand side of `= ANY(...)`:

```ts
// ❌ BROKEN — serialises the array as a single text parameter
sql`${agentEvents.eventType} = ANY(${PROCESSABLE_EVENTS})`
```

Drizzle's `sql\`...\`` template binds every `${...}` interpolation as a parameterised value. Passing a JS array produces a single bound param of type text, not a Postgres array literal, and Postgres rejects it.

## Symptoms

- `error: op ANY/ALL (array) requires array on right side` on every `schedules.task` invocation
- `scrape_results`-style ledger (or any wrapping try/catch) didn't fire because the top-level query crashed before the per-event loop
- Nothing in Sentry — Trigger.dev logs the task failure to its own dashboard but doesn't propagate to Sentry unless the task calls `Sentry.captureException` explicitly

## What Didn't Work

- Staring at the query and assuming Drizzle would JSON-serialise the array (it doesn't — `sql` templates bind every `${}` as a single param).
- Hoping Sentry would have caught it. Trigger.dev task-level crashes are invisible to Sentry without explicit wiring.

## Solution

Use Drizzle's `inArray` helper, which serialises correctly to `= ANY($1)` with `$1` bound as a Postgres text array:

```ts
// ✅ CORRECT
import { and, db, eq, inArray } from "@/src/db";

await db
  .select()
  .from(agentEvents)
  .where(
    and(
      eq(agentEvents.status, "pending"),
      inArray(agentEvents.eventType, PROCESSABLE_EVENTS),
    ),
  )
  .orderBy(agentEvents.createdAt)
  .limit(20);
```

Verified with a reproduction script: the `sql` template variant throws synchronously on first execution; the `inArray` variant returns the expected rows.

## Why This Works

Drizzle's `inArray` knows the column's type (`text` here), so it serialises the JS array as the matching Postgres array type (`text[]`). The `sql` template is type-agnostic — every `${}` is a single `$n` parameter — so it can't distinguish "I want this array expanded as `('a','b','c')`" from "I want this array sent as a single value". When in doubt, prefer Drizzle's typed helpers (`inArray`, `notInArray`, `arrayContains`) over hand-rolled `sql` templates.

## Prevention

- Default to `inArray(column, values)` for IN-clauses; only drop to `sql` when you need something `inArray` can't express (e.g. a correlated subquery).
- Add a `trigger-health-check` cron (PR #228) that fetches the last 5 runs per scheduled task via `runs.list` and `Sentry.captureException`s on ≥3/5 failures. This closes the "Trigger task silently crashes" observability gap for every task, not just this one.
- Reproduce Postgres-layer bugs locally before shipping them — one `tsx` script that runs the failing query against the real DB would have caught this in <1 minute.

## Related Issues

- RJC-228 — the fix.
- `docs/solutions/workflow-issues/orchestrator-polling-to-event-driven-AgentSystem-20260329.md` — the event-driven dispatch this task is a fallback for.
- `docs/solutions/integration-issues/drizzle-having-needs-group-by-Trigger-20260423.md` — sibling bug found the same day in `nightly-maintenance`.
