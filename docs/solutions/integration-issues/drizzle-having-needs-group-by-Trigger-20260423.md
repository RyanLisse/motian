---
title: Drizzle `.having()` needs `.groupBy()` — row-level predicates belong in `.where()`
date: 2026-04-23
category: integration-issues
module: Database
problem_type: database_issue
component: database
symptoms:
  - "column \"jobs.id\" must appear in the GROUP BY clause or be used in an aggregate function"
  - "nightly-maintenance Trigger.dev task FAILED 22 runs in a row"
  - "query works locally on a small table, crashes in prod"
root_cause: wrong_api
resolution_type: code_fix
severity: medium
tags: [drizzle, postgres, having, group-by, trigger-dev, subquery]
---

# Drizzle `.having()` needs `.groupBy()` — row-level predicates belong in `.where()`

## Problem

`trigger/nightly-maintenance.ts` step 3 (proactive sourcing) used `.having(...)` on a non-aggregated select to filter underserved jobs by their match count. The query had no `GROUP BY`, so Postgres rejected it with `column "jobs.id" must appear in the GROUP BY clause or be used in an aggregate function`. The task had been silently failing every night at 02:00 Amsterdam for 22 consecutive nights.

```ts
// ❌ BROKEN — HAVING without GROUP BY
.from(jobs)
.where(and(getVisibleVacancyCondition(), isNotNull(jobs.embedding)))
.having(
  sql`coalesce(
    (select count(*) from job_matches jm where jm.job_id = ${jobs.id} ...), 0
  ) < 3`,
)
```

## Symptoms

- `column "jobs.id" must appear in the GROUP BY clause or be used in an aggregate function`
- nightly-maintenance dashboard showed FAILED every night, durations all < 50s (aborted at the query step)
- 22 consecutive failures with zero Sentry alerts (Trigger.dev task-level crashes don't propagate to Sentry without explicit wiring)

## What Didn't Work

- Assuming HAVING was interchangeable with WHERE — it is not. HAVING filters groups produced by GROUP BY (and operates on aggregates); without GROUP BY, every non-aggregated column is illegal.

## Solution

The correlated subquery was always meant to be a row-level predicate (filter rows where "underserved" = `< 3` active matches). It belongs in `WHERE`, not `HAVING`:

```ts
// ✅ CORRECT — row-level predicate in the WHERE chain
.from(jobs)
.where(
  and(
    getVisibleVacancyCondition(),
    isNotNull(jobs.embedding),
    sql`coalesce(
      (select count(*) from job_matches jm
       where jm.job_id = ${jobs.id}
       and jm.status in ('pending', 'accepted')),
      0
    ) < 3`,
  ),
)
.limit(10);
```

## Why This Works

- WHERE evaluates per-row before grouping. Correlated subqueries that return one scalar per candidate row are per-row predicates.
- HAVING only makes sense when you're grouping rows into aggregates and want to filter those groups. Intent: "give me groups where SUM(x) > N". Not: "give me rows where subquery(row) < N".

Rule of thumb: if there's no `GROUP BY` in the query, there should be no `.having()`.

## Prevention

- Default to `.where()` for all row-level predicates (including correlated subqueries).
- Only reach for `.having()` when you actually have a `.groupBy()` and want to filter the resulting groups.
- PR #228's `trigger-health-check` cron now catches silent cron failures within 24h — ≥3/5 recent failures per task raises a `Sentry.captureException`. This was the second task found silently dead on the same day; the health-check makes future recurrences loud.

## Related Issues

- RJC-229 — the fix (same PR as MiPublic `<5%` no-JSON-LD tolerance).
- `docs/solutions/integration-issues/drizzle-sql-array-use-inarray-Database-20260423.md` — sibling bug in `agent-orchestrator` found the same day; same class (ORM footgun that only shows up at runtime).
- PR #228 (`trigger-health-check`) — the observability layer that would have surfaced this within a day of its first failure.
