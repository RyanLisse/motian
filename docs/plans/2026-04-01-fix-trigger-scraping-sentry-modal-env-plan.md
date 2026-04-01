---
title: "fix: Restore Trigger scraping, Sentry, Modal, and Vercel env flow"
type: fix
status: active
date: 2026-04-01
---

# fix: Restore Trigger scraping, Sentry, Modal, and Vercel env flow

## Overview

Trigger.dev scraping and observability are partially wired but fragile. The scrape scheduler, Modal-based Striive scraping, and Sentry error capture depend on environment variables being present inside the Trigger.dev runtime. Current configuration syncs only a hand-picked subset of env vars, and the subset does not include the Striive credentials or `SENTRY_DSN` that the scraping and failure-reporting paths require.

This plan restores the production path end-to-end:

1. ensure Trigger.dev tasks receive the env vars they actually need;
2. verify Striive/Modal scraping works again from scheduled and manual task paths;
3. verify Sentry still captures Next.js and Trigger.dev failures;
4. document and, where needed, automate the Vercel env pull workflow used for local debugging.

## Problem Statement

### Confirmed findings from repo research

1. `trigger.config.ts` uses `syncEnvVars(...)` with an explicit allowlist, but the allowlist omits:
   - `STRIIVE_USERNAME`
   - `STRIIVE_PASSWORD`
   - `STRIIVE_SESSION_COOKIE`
   - `STRIIVE_USE_MODAL`
   - `SENTRY_DSN`
2. `packages/scrapers/src/striive.ts` requires `STRIIVE_USERNAME` and `STRIIVE_PASSWORD` before it can run the Modal-backed scrape path.
3. `trigger.config.ts` initializes `@sentry/node` and captures Trigger.dev task failures in `onFailure`, but without `SENTRY_DSN` in the task environment this path can silently no-op in deployed tasks.
4. `instrumentation.ts`, `instrumentation-client.ts`, and `next.config.ts` already provide the main Next.js Sentry wiring, so the likely breakage is environment/config drift rather than missing framework setup.
5. The Striive scraper comments still mention an older “webhook mode” path, while the current implementation uses a direct Modal sandbox. That mismatch increases maintenance risk and makes debugging harder.
6. The repo documents Vercel env usage, but there is no clear single source of truth in code or docs for the exact local recovery workflow when Trigger.dev, Sentry, or Modal credentials drift.

### Why this matters

- Scheduled scrapes can fail in production even when local runs succeed.
- Trigger.dev failures can go unreported if Sentry is not present in the worker runtime.
- Modal-backed scraping is especially sensitive to missing credentials and is one of the known platform blockers.
- Debugging remains expensive unless local `.env.local` refresh from Vercel is explicit and repeatable.

## Research Summary

### Local patterns

- Trigger.dev task registration lives under `trigger/` and uses `task(...)` / `schedules.task(...)` from `@trigger.dev/sdk`.
- Scrape orchestration entry points:
  - `trigger/scrape-pipeline.ts`
  - `src/services/scrape-pipeline.ts`
  - `src/services/scrapers/index.ts`
  - `packages/scrapers/src/striive.ts`
- Next.js Sentry wiring lives in:
  - `instrumentation.ts`
  - `instrumentation-client.ts`
  - `next.config.ts`
- Existing docs already reference Vercel env and Sentry sourcemap setup:
  - `docs/deployment-verification-post-drizzle-quality-fixes.md`
  - `docs/deployment-verification-summary.md`
  - `docs/autopilot-configuration.md`

### External docs findings

- Trigger.dev recommends either `syncEnvVars(...)` with an explicit callback or `syncVercelEnvVars(...)` for environment synchronization into task runtimes.
- Vercel recommends `vercel env pull .env.local` for local development env refresh, with `vercel pull` used when relying on `.vercel/` metadata for Vercel CLI workflows.
- Sentry recommends keeping Next.js wrapped with `withSentryConfig(...)` and providing `SENTRY_AUTH_TOKEN` for source map upload in deployment environments.

## SpecFlow Analysis

### Flow 1: Scheduled scrape pipeline

1. Trigger.dev schedule runs `trigger/scrape-pipeline.ts`
2. Due scraper configs are selected from the database
3. `runScrapePipelinesWithConcurrency(...)` dispatches each platform scrape
4. Striive delegates to `packages/scrapers/src/striive.ts`
5. The scraper launches a Modal sandbox, logs in, fetches jobs, and returns listings
6. The pipeline records scrape results and emits status events

### Flow 2: Failure observability

1. A Trigger.dev task throws or rejects
2. `trigger.config.ts` `onFailure` runs
3. `@sentry/node` captures the exception and flushes
4. Operators can inspect the error in Sentry

### Flow 3: Local recovery and verification

1. Developer links the repo to the Vercel project
2. Developer refreshes local env with `vercel env pull .env.local`
3. Developer runs targeted Trigger.dev or app validation locally
4. Config drift is detected before deploy

### Critical gaps

1. **Trigger runtime env gap** — task runtime env sync does not include the Striive credentials or `SENTRY_DSN` required by the actual runtime paths.
2. **Verification gap** — there is no focused regression test asserting that Trigger.dev env sync covers scraping + observability requirements.

### Important gaps

1. **Documentation drift** — Striive scraper comments describe an older webhook model instead of the current Modal sandbox execution path.
2. **Recovery workflow drift** — local Vercel env pull exists in docs, but not as a crisp, task-specific operational flow for scraper recovery.

### Default assumptions if unanswered

- We should keep the current explicit-sync model unless it is simpler and safer to switch to a supported Vercel sync extension.
- We should validate only the envs needed for Trigger scraping and Sentry, not refactor unrelated task config.
- We should prefer minimal code changes plus targeted tests and docs updates.

## Implementation Plan

## Key Technical Decisions

### Decision 1: Keep explicit env sync unless migration buys clear safety

**Options considered**

1. **Keep `syncEnvVars(...)` and expand the allowlist**
2. Switch to a broader Vercel-driven sync mechanism for Trigger.dev

**Decision**

Start with option 1 unless implementation reveals that the current deployment flow already depends on Vercel-native env sync and the migration is smaller than maintaining the allowlist.

**Why**

- The existing config already uses explicit sync and was recently expanded for Autopilot.
- The likely failure is omission, not architectural unsuitability.
- A surgical fix is lower-risk than changing the entire environment loading model mid-recovery.

**Guardrail**

If the allowlist expands further during implementation, document the boundary between app-only env vars and Trigger-runtime env vars so drift is less likely to recur.

### Decision 2: Verify the worker runtime contract, not just source code presence

**Decision**

Add regression coverage around the env list itself, because the root cause class here is configuration drift rather than algorithmic logic.

**Why**

- The repo already has working Sentry and Modal integration code paths.
- The fragile seam is whether the Trigger.dev runtime receives the values those code paths require.
- A focused config-contract test is the cheapest durable protection.

### Decision 3: Treat comment drift as operational risk

**Decision**

Update outdated Striive scraper comments as part of the recovery, even if runtime behavior does not change.

**Why**

- The current comments still describe “webhook mode,” while the current code uses direct Modal sandbox execution.
- This exact area has already changed quickly in recent commits, so stale comments increase the chance of future misdiagnosis.

### 1. Fix Trigger.dev env synchronization

**Primary files:** `trigger.config.ts`, possible docs/tests updates

- Add the missing scraping env vars needed by the Striive scraper runtime.
- Add `SENTRY_DSN` to the synced task env set.
- Decide whether to keep `syncEnvVars(...)` or migrate to a Vercel-backed sync approach if that materially reduces drift.
- Keep the change minimal and scoped to scraping/observability recovery.

### 2. Tighten Striive/Modal runtime clarity

**Primary file:** `packages/scrapers/src/striive.ts`

- Update misleading comments so they describe the real Modal-backed execution path.
- Verify runtime assumptions around required credentials and failure messages.
- Avoid changing scraping behavior unless required by validation findings.

### 3. Restore/verify Sentry worker observability

**Primary files:** `trigger.config.ts`, possibly `next.config.ts` docs references only

- Confirm Trigger.dev task failures are reportable with synced env.
- Verify existing Next.js Sentry setup remains intact.
- Ensure docs and examples reflect the correct env requirements:
  - `SENTRY_DSN`
  - `NEXT_PUBLIC_SENTRY_DSN`
  - `SENTRY_ORG`
  - `SENTRY_PROJECT`
  - `SENTRY_AUTH_TOKEN`

### 4. Add regression coverage

**Primary location:** `tests/`

- Add at least one targeted test for Trigger.dev env sync coverage.
- Add or extend tests around the Striive runtime contract if there is already an adjacent test pattern.

### 5. Document the Vercel env recovery path

**Primary files:** docs file to update after implementation

- Document the exact local recovery path using:
  - `vercel link` if needed
  - `vercel env pull .env.local`
- Keep the documentation focused on scraper/Sentry/Modal recovery, not a broad deployment rewrite.

## Implementation Units

### Unit A: Trigger runtime env contract

**Files:** `trigger.config.ts`, related tests in `tests/`

- Define the exact minimum env set required by:
  - Trigger.dev scrape orchestration
  - Striive Modal scraping
  - Trigger.dev Sentry failure reporting
- Update the sync list to match that contract.
- Add a regression test that fails when one of these required env names is removed.

### Unit B: Striive runtime clarity

**Files:** `packages/scrapers/src/striive.ts`, related tests if needed

- Update comments and diagnostics so the file accurately describes the current Modal-backed execution.
- Preserve the current silent-failure protections from the earlier scraper hardening work.

### Unit C: Observability verification surface

**Files:** `trigger.config.ts`, docs if required

- Confirm that Trigger.dev failures remain capturable with the synced runtime env.
- Keep Next.js Sentry wiring untouched unless a concrete misconfiguration is discovered.

### Unit D: Operator recovery docs

**Files:** existing deployment/config docs

- Add a short recovery path for “pull env, verify config, rerun targeted checks.”
- Ensure the doc clearly distinguishes:
  - local `.env.local` refresh;
  - Vercel deployment env;
  - Trigger.dev runtime env sync.

## Sequencing Rationale

1. **Fix config contract first** — without the env contract, runtime verification is noisy and misleading.
2. **Add config-focused tests second** — this locks the root cause before docs or cleanup work.
3. **Clean up scraper comments third** — safe once the runtime contract is restored.
4. **Update recovery docs last** — document the final behavior, not a transient intermediate state.

This order minimizes the risk of validating the wrong runtime assumptions.

## Risks and Mitigations

- **Risk:** Over-broad env synchronization could expose unnecessary secrets to Trigger.dev.
  - **Mitigation:** Sync only the vars required for scraping and observability.
- **Risk:** Changing Trigger config could affect unrelated jobs.
  - **Mitigation:** Keep config edits surgical and verify targeted tests first.
- **Risk:** Modal or Vercel verification may require credentials not available in the current shell.
  - **Mitigation:** Make code and docs resilient, then verify live integration paths only where credentials and approvals allow.

## Operational Notes

- Recent history matters here:
  - `4248fd5e` introduced explicit `syncEnvVars(...)` to fix missing Trigger.dev runtime env for Firecrawl.
  - `739193ab` expanded env sync for the Autopilot Modal sandbox path.
- Those changes suggest the current problem is part of an established failure pattern in this repo: new external-runtime features are added faster than the Trigger.dev env allowlist is updated.
- The deepened plan therefore treats env drift prevention as a first-class deliverable, not a side effect.

## Open Questions

1. Should Trigger.dev continue using a curated env allowlist, or has the project reached the point where Vercel-backed env sync is safer operationally?
   - **Default if unanswered:** keep the allowlist and make it complete for this recovery.
2. Do we want one shared documentation location for “runtime env recovery” across Trigger.dev, Vercel, and Sentry?
   - **Default if unanswered:** update the most relevant existing deployment/config doc rather than creating new documentation sprawl.
3. Are there additional platform scrapers beyond Striive that now depend on Trigger-runtime-only secrets not yet covered by tests?
   - **Default if unanswered:** scope code changes to confirmed Striive/Sentry gaps, but mention follow-up audit potential in review.

## Acceptance Criteria

- [x] Trigger.dev config syncs every env var required for Striive scraping and Trigger.dev Sentry reporting.
- [x] The Striive scraper code/comments reflect the actual Modal execution model.
- [x] Focused regression tests cover the restored env contract.
- [x] Documentation explains how to refresh local env from Vercel for this recovery workflow.
- [x] Lint/tests relevant to the touched files pass, or any unrelated pre-existing failures are clearly identified.

## Verification Plan

1. Run targeted tests for the Trigger config and scraper paths.
2. Run `pnpm lint`.
3. If credentials are available, verify local env refresh with `vercel env pull .env.local`.
4. If credentials are available, verify at least one Trigger.dev scrape path or task config path end-to-end.

## Additional Deepening Inputs

- **Git history evidence:** recent commits already show this repo fixing missing Trigger.dev runtime env for external integrations rather than changing the overall task architecture.
- **Institutional learning:** `docs/solutions/integration-issues/playwright-externalized-triggerdev-AutopilotSystem-20260329.md` reinforces two patterns that apply here:
  - external-runtime features fail when Trigger.dev runtime assumptions differ from app runtime assumptions;
  - every new external integration should trigger an explicit `trigger.config.ts` env sync review.
- **Prior related plan:** `docs/plans/2026-02-24-fix-scraper-silent-failure-bug-plan.md` shows the scraper subsystem has already been hardened against silent empty-result failures, so this recovery should preserve those protections rather than bypass them.

## Sources

- `trigger.config.ts`
- `trigger/scrape-pipeline.ts`
- `src/services/scrape-pipeline.ts`
- `src/services/scrapers/index.ts`
- `packages/scrapers/src/striive.ts`
- `instrumentation.ts`
- `instrumentation-client.ts`
- `next.config.ts`
- `docs/deployment-verification-post-drizzle-quality-fixes.md`
- `docs/deployment-verification-summary.md`
- `docs/autopilot-configuration.md`
