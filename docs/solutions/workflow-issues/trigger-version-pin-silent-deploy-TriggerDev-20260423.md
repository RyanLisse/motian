---
title: Remove `TRIGGER_VERSION` pin from prod env — it silently overrides deploys
date: 2026-04-23
category: workflow-issues
module: Trigger.dev
problem_type: workflow_issue
component: background_job
symptoms:
  - "Manual `tasks.trigger()` runs keep hitting an old bundle even after a successful deploy"
  - "Trigger.dev dashboard shows new deployments but prod runs use an older version"
  - "Trigger.dev task crashes are invisible to Sentry"
severity: high
applies_when:
  - "A scheduled Trigger.dev task keeps failing after you deployed a fix"
  - "Scheduled runs pick up new code but API-invoked runs don't"
  - "You don't remember setting TRIGGER_VERSION but it's in `vercel env ls`"
tags: [trigger-dev, deploy, observability, sentry, silent-failure]
---

# Remove `TRIGGER_VERSION` pin from prod env — it silently overrides deploys

## Context

Our Trigger.dev prod env had `TRIGGER_VERSION="20260402.1"` set 21 days before anyone noticed. Scheduled crons run on Trigger.dev's "latest" resolution and picked up each deploy normally. But `tasks.trigger(...)` invocations via the `@trigger.dev/sdk` client (both from our own API routes and from smoke-test scripts) respected the pin and kept running the old bundle. Result: multiple hot-fix deploys over three days appeared to land on Trigger.dev but weren't actually executed by any of the code paths we were debugging with.

Compounding the blindness: Trigger.dev task-level crashes don't propagate to Sentry unless the task explicitly calls `Sentry.captureException`. So the pinned 21-day-old code was crashing on every invocation with no external signal.

## Guidance

- **Don't pin `TRIGGER_VERSION` in any environment unless you're actively A/B-testing a specific bundle.** In steady state, leave it unset so Trigger.dev resolves the latest active deployment. The env var is invisible in code (no import references it, no `.env.example` entry) and will quietly drift.
- **Every scheduled task must route crashes to Sentry.** Wrap task bodies in a try/catch that calls `Sentry.captureException(err, { tags: { trigger_task: id } })` before re-throwing, OR rely on `trigger-health-check` (`trigger/trigger-health-check.ts` — daily 07:00 Amsterdam) to fire a Sentry event on ≥3/5 recent failures.
- **When debugging "my fix isn't working in prod", check the pin first.** `grep TRIGGER_VERSION .env.local` or `vercel env ls production | grep TRIGGER` is a 10-second diagnostic. It's the Trigger.dev equivalent of browser cache when debugging a frontend deploy.

## Why This Matters

The pin is a latent deploy bug that scales with the number of `tasks.trigger()` call sites. Our codebase has that call in 5+ places (ad-hoc smoke scripts, API routes that kick off background work, chained task-to-task calls). Each one silently runs a 21-day-old bundle. The impact isn't "some tasks are slow" — it's "your fix never shipped to this invocation path" with no error anywhere.

Combined with the Sentry gap, this class of bug can eat weeks before anyone runs a manual test.

## When to Apply

- Before shipping a Trigger.dev fix to a task that's been failing: verify `TRIGGER_VERSION` is unset in the target env
- When a task's `runs.list()` shows a mix of "success" scheduled runs and "failed" manual runs
- When rolling out a new task the first time — confirm it's callable on the latest version, not gated by a pin

## Examples

Diagnostic:

```bash
# Check the pin
vercel env ls production | grep TRIGGER_VERSION
# Or, after `vercel env pull`:
grep TRIGGER_VERSION .env.local
```

Fix:

```bash
vercel env rm TRIGGER_VERSION production --yes
vercel env pull .env.local --environment=production --yes
# Re-trigger the task to confirm it now runs the latest bundle:
pnpm tsx scripts/trigger-test.ts <task-id>
```

Verify Sentry pathway (each cron task body):

```ts
run: async () => {
  try {
    // ... actual work
  } catch (err) {
    Sentry.captureException(err, { tags: { trigger_task: "nightly-maintenance" } });
    throw err;
  }
}
```

## Related

- `trigger/trigger-health-check.ts` (PR #228) — the catch-all observability layer for this class of silent failure.
- `docs/solutions/integration-issues/drizzle-sql-array-use-inarray-Database-20260423.md` — one of the fixes whose deploy was masked by the pin.
- `docs/solutions/integration-issues/drizzle-having-needs-group-by-Trigger-20260423.md` — the other one.
