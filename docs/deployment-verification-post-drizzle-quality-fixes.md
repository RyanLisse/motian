# Deployment Verification: Post-Drizzle Refactor Quality Fixes

**Date:** 2026-03-14
**Type:** Infrastructure Fix (Database ORM + Test Mocks + Observability)
**Risk Level:** MEDIUM (Build-breaking changes, test failures, but no data modifications)
**Deployment Window:** Production deployment safe during business hours (no database changes)

---

## Executive Summary

This deployment fixes critical build blockers introduced by the Drizzle workspace refactor: pg version mismatch (6 trigger files affected), test mock gaps (29 failing tests), and Sentry sourcemap configuration. **NO DATABASE MIGRATIONS** — all changes are build-time only.

**Key Changes:**
- Force single `pg@8.20.0` version across workspace via pnpm override
- Add missing Drizzle exports (`sql`, `eq`, schema tables) to test mocks
- Configure Sentry auth token for production sourcemap uploads
- Update documentation paths (opdrachten→vacatures migration)

**Data Impact:** NONE (no schema changes, no migrations, no data transformations)

---

## Pre-Deploy Verification

### 1. Environment Readiness

**Local Environment Check (5 minutes):**

```bash
# Verify current branch and working directory
git status
# Expected: Clean working directory or only uncommitted fixes from this plan

# Verify Node and pnpm versions
node --version   # Expected: v22.x or v20.x
pnpm --version   # Expected: 9.15.0

# Verify database connection (no schema validation, just connectivity)
psql $DATABASE_URL -c "SELECT NOW();"
# Expected: Current timestamp returned successfully
```

**Expected Results:**
- Clean git status (or only files from this deployment)
- Node.js v20+ and pnpm 9.15.0 installed
- Database connection successful (confirms Neon is reachable)

**If any check fails:** STOP — resolve environment issues before proceeding

---

### 2. Pre-Deploy Build Verification

**Baseline: Capture Current State (10 minutes):**

```bash
# 1. Record current dependency state
pnpm list pg --depth=0 > pre-deploy-pg-versions.txt
# Expected: Shows pg@8.18.0 in root, different version in workspace packages

# 2. Attempt build to confirm known failure
pnpm build 2>&1 | tee pre-deploy-build.log
# Expected: FAIL with "Types have separate declarations of a private property 'shouldInlineParams'"

# 3. Run tests to confirm failure baseline
pnpm test 2>&1 | tee pre-deploy-tests.log
# Expected: 29 tests fail with "No [export] export is defined on the mock"

# 4. Count failing tests
grep -c "^[[:space:]]*×" pre-deploy-tests.log
# Expected: Approximately 29 failures

# 5. Verify TypeScript compilation fails
pnpm exec tsc --noEmit 2>&1 | tee pre-deploy-typecheck.log
# Expected: Type errors in trigger/*.ts files
```

**Save these files for post-deploy comparison:**
- `pre-deploy-pg-versions.txt`
- `pre-deploy-build.log`
- `pre-deploy-tests.log`
- `pre-deploy-typecheck.log`

**Pre-Deploy Acceptance:**
- ✅ Build fails with known Drizzle type error
- ✅ Tests fail with known "No export" errors
- ✅ Baseline logs saved for comparison

**If unexpected failures appear:** INVESTIGATE — new failures block deployment

---

### 3. Vercel Environment Variables Audit

**Check Required Variables (5 minutes):**

```bash
# Use Vercel CLI to list current env vars
vercel env ls production

# Required variables (must exist):
# - DATABASE_URL (Neon connection string)
# - SENTRY_DSN
# - ANTHROPIC_API_KEY
# - GOOGLE_GENERATIVE_AI_API_KEY
# - OPENAI_API_KEY
# - X_AI_API_KEY
# - LIVEKIT_API_KEY
# - LIVEKIT_API_SECRET

# Variables to be ADDED (not yet present):
# - SENTRY_AUTH_TOKEN (new)
# - SENTRY_ORG=ryan-lisse-bv (verify)
# - SENTRY_PROJECT=motian (verify)
```

**Manual Verification:**
1. Visit https://vercel.com/your-team/motian-recruitment/settings/environment-variables
2. Confirm all required AI provider keys exist
3. Confirm DATABASE_URL points to correct Neon instance
4. Note that SENTRY_AUTH_TOKEN is missing (expected)

**Expected State:**
- DATABASE_URL exists and points to production Neon database
- All AI provider keys are set
- SENTRY_AUTH_TOKEN does NOT exist (will be added in Phase 2)

**If DATABASE_URL is missing or incorrect:** STOP — critical configuration error

---

### 4. Database Invariants (Read-Only Checks)

**Sanity Checks (NO WRITE OPERATIONS) (5 minutes):**

```sql
-- Connect to production database (READ-ONLY SESSION)
-- Run these queries to establish baseline

-- 1. Verify critical tables exist (no schema validation)
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('jobs', 'candidates', 'matches', 'autopilot_runs', 'autopilot_findings')
ORDER BY table_name;
-- Expected: All 5 tables exist

-- 2. Record table row counts (baseline)
SELECT
  'jobs' AS table_name, COUNT(*) AS row_count FROM jobs
UNION ALL
SELECT 'candidates', COUNT(*) FROM candidates
UNION ALL
SELECT 'matches', COUNT(*) FROM matches
UNION ALL
SELECT 'autopilot_runs', COUNT(*) FROM autopilot_runs
UNION ALL
SELECT 'autopilot_findings', COUNT(*) FROM autopilot_findings;
-- Save this output: post-deployment row counts MUST match exactly

-- 3. Verify no schema migrations pending (Drizzle)
-- This deployment has NO migrations, so this is a sanity check
SELECT COUNT(*) FROM drizzle.__drizzle_migrations;
-- Expected: Some number N (record it, should not change post-deploy)

-- 4. Check for any locks or long-running queries (health check)
SELECT
  pid,
  usename,
  application_name,
  state,
  query_start,
  NOW() - query_start AS duration,
  LEFT(query, 100) AS query_preview
FROM pg_stat_activity
WHERE state != 'idle'
  AND query NOT LIKE '%pg_stat_activity%'
ORDER BY query_start;
-- Expected: No long-running queries (>5 minutes) blocking deployment
```

**Save Query Results:**
```bash
# Save baseline to file
psql $DATABASE_URL -f pre-deploy-db-baseline.sql > pre-deploy-db-baseline.txt
```

**Pre-Deploy Database Acceptance:**
- ✅ All critical tables exist
- ✅ Row counts recorded (jobs, candidates, matches, autopilot tables)
- ✅ No pending migrations (this deploy has none)
- ✅ No blocking queries in pg_stat_activity

**If any table is missing:** STOP — database is in unexpected state
**If long-running queries exist:** WAIT — resolve before deploying

---

### 5. Trigger.dev Task Health Check

**Verify Scheduled Tasks (5 minutes):**

```bash
# Visit Trigger.dev dashboard
open https://cloud.trigger.dev/orgs/YOUR_ORG/projects/YOUR_PROJECT/schedules

# Manual verification:
# 1. Check scheduled tasks are healthy:
#    - vacancy-expiry (cron)
#    - match-staleness (cron)
#    - candidate-dedup (cron)
#    - scraper-health (cron)
#    - embeddings-batch (triggered)
#    - scrape-pipeline (triggered)

# 2. Verify last run status for each:
#    - No tasks in FAILED state for >24 hours
#    - Recent successful runs (within expected schedule)

# 3. Check task versions:
#    - All tasks should show current deployment version
```

**Expected State:**
- All scheduled tasks show recent successful runs
- No persistent failures
- Task versions match current production deployment

**If critical tasks are failing:** INVESTIGATE — may indicate pre-existing production issue

---

## Deployment Steps

### Phase 1: Fix pg Version Mismatch (CRITICAL — Unblocks Build)

**Step 1.1: Add pnpm Override (1 minute):**

```bash
# Edit package.json to add pg override
# Add to existing pnpm.overrides section:
{
  "pnpm": {
    "overrides": {
      "pg": "^8.20.0",  // Add this line
      // ... existing overrides ...
    }
  }
}
```

**Step 1.2: Reinstall Dependencies (2 minutes):**

```bash
# Force pnpm to regenerate lockfile with override
pnpm install --force

# Verify single pg version across workspace
pnpm list pg --depth=10 | grep -E "pg@"
# Expected: ALL packages now use pg@8.20.0 (no version conflicts)
```

**Step 1.3: Verify Build Success (3 minutes):**

```bash
# Build should now pass
pnpm build 2>&1 | tee phase1-build.log

# Check exit code
echo $?
# Expected: 0 (success)

# Verify no Drizzle type errors in trigger files
grep -i "shouldInlineParams" phase1-build.log
# Expected: No matches (error resolved)
```

**Phase 1 Success Criteria:**
- ✅ `pnpm install --force` completes successfully
- ✅ `pnpm list pg` shows single version (8.20.0) across all packages
- ✅ `pnpm build` exits with code 0
- ✅ No "shouldInlineParams" errors in build log

**If build still fails:** STOP — investigate unexpected build errors before proceeding

**Commit Phase 1:**
```bash
git add package.json pnpm-lock.yaml
git commit -m "fix: force pg@8.20.0 across workspace to resolve Drizzle type mismatch

- Add pnpm override to force single pg version
- Resolves 'shouldInlineParams' type error in trigger/*.ts files
- Affects: trigger/embeddings-batch, candidate-dedup, scrape-pipeline, scraper-health, match-staleness, vacancy-expiry

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Phase 2: Fix Test Mock Exports (CRITICAL — Unblocks CI/CD)

**Step 2.1: Fix jobs-deduplication Tests (5 minutes):**

Fix `tests/jobs-deduplication-*.test.ts` files (3 files affected):

```typescript
// Add to vi.mock("../src/db") in each file:
vi.mock("../src/db", () => ({
  db: { /* existing mocks */ },
  sql: vi.fn(),  // Add this export
  eq: vi.fn(),   // Add this export
}));
```

**Files to edit:**
- `tests/jobs-deduplication-runtime-fallback.test.ts`
- `tests/jobs-deduplication-compatibility.test.ts`
- `tests/chat-sessions-compatibility.test.ts`

**Step 2.2: Fix autopilot Tests (5 minutes):**

Fix `tests/autopilot-persistence.test.ts`:

```typescript
// Update existing vi.mock("@/src/db"):
vi.mock("@/src/db", () => ({
  db: { /* existing mocks */ },
  eq: vi.fn(),
  desc: vi.fn(),
  and: vi.fn(),
}));

// Add schema mock:
vi.mock("@/src/db/schema", () => ({
  autopilotRuns: {
    runId: "runId",
    startedAt: "startedAt",
    completedAt: "completedAt",
    status: "status",
    reportUrl: "reportUrl",
    triggerRunId: "triggerRunId",
  },
  autopilotFindings: {
    id: "id",
    runId: "runId",
    fingerprint: "fingerprint",
    severity: "severity",
    category: "category",
    surface: "surface",
    title: "title",
    description: "description",
    impact: "impact",
    status: "status",
    githubIssueNumber: "githubIssueNumber",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
}));
```

**Step 2.3: Fix autopilot-run-detail-evidence Test (3 minutes):**

Fix `tests/autopilot-run-detail-evidence.test.ts`:

```typescript
// Add to existing vi.mock("@/src/db"):
vi.mock("@/src/db", () => ({
  db: { select: selectMock },
  eq: vi.fn(),  // Add this export
}));
```

**Step 2.4: Fix platform-config-service Test (2 minutes):**

Fix `tests/platform-config-service-regressions.test.ts`:

```typescript
// Add to existing vi.mock("@/src/db"):
vi.mock("@/src/db", () => ({
  db: { /* existing mocks */ },
  eq: vi.fn(),  // Add this export
}));
```

**Step 2.5: Verify Test Success (5 minutes):**

```bash
# Run full test suite
pnpm test 2>&1 | tee phase2-tests.log

# Check exit code
echo $?
# Expected: 0 (all tests pass)

# Count passing vs failing tests
grep -c "^[[:space:]]*✓" phase2-tests.log
grep -c "^[[:space:]]*×" phase2-tests.log
# Expected: All tests passing, 0 failures

# Verify specific test files pass
pnpm test tests/autopilot-persistence.test.ts
pnpm test tests/jobs-deduplication-compatibility.test.ts
pnpm test tests/autopilot-run-detail-evidence.test.ts
# Expected: All pass
```

**Phase 2 Success Criteria:**
- ✅ All test files pass (0 failures)
- ✅ No "No export is defined" errors
- ✅ Test coverage maintained (no reduction)

**If tests still fail:** INVESTIGATE — check for additional missing exports

**Commit Phase 2:**
```bash
git add tests/*.test.ts
git commit -m "fix: add missing Drizzle exports to test mocks

- Add sql, eq, desc, and exports to vi.mock('@/src/db')
- Add schema table mocks to vi.mock('@/src/db/schema')
- Resolves 29 failing tests after Drizzle workspace refactor
- Affects: autopilot-persistence, jobs-deduplication-*, autopilot-run-detail-evidence, platform-config-service tests

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Phase 3: Configure Sentry Sourcemaps (OBSERVABILITY)

**Step 3.1: Generate Sentry Auth Token (5 minutes):**

```bash
# Manual steps:
# 1. Visit https://sentry.io/settings/account/api/auth-tokens/
# 2. Click "Create New Token"
# 3. Name: "Vercel Sourcemap Upload - Motian Production"
# 4. Scopes: Select "project:releases" and "project:write"
# 5. Copy token (starts with "sntrys_...")

# DO NOT commit this token to git
```

**Step 3.2: Add to .env.example (1 minute):**

```bash
# Edit .env.example, add after existing Sentry variables:
# Sentry (error tracking + performance)
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_ORG=ryan-lisse-bv
SENTRY_PROJECT=motian
SENTRY_AUTH_TOKEN=sntrys_xxx  # Add this line — NEVER commit actual token
```

**Step 3.3: Add to Vercel Environment Variables (5 minutes):**

```bash
# Use Vercel CLI to add token to production
vercel env add SENTRY_AUTH_TOKEN production
# Paste token when prompted (interactive)

# Add to preview environments
vercel env add SENTRY_AUTH_TOKEN preview
# Paste same token

# Verify token was added
vercel env ls production | grep SENTRY_AUTH_TOKEN
# Expected: Shows SENTRY_AUTH_TOKEN with value [hidden]
```

**Step 3.4: Verify Sentry Configuration (3 minutes):**

```bash
# Check Sentry is properly initialized
grep -r "Sentry.init" instrumentation.ts
# Expected: Shows Sentry.init calls for node and edge runtimes

# Verify next.config.ts has withSentryConfig wrapper
grep "withSentryConfig" next.config.ts
# Expected: Shows export default withSentryConfig(nextConfig, {...})

# Check Sentry dashboard for recent events
open https://ryan-lisse-bv.sentry.io/projects/motian/
# Manual check: Should show recent error events (if any)
```

**Phase 3 Success Criteria:**
- ✅ SENTRY_AUTH_TOKEN added to .env.example (with placeholder)
- ✅ SENTRY_AUTH_TOKEN set in Vercel (production + preview)
- ✅ Sentry dashboard accessible and showing project

**If Sentry dashboard shows no data:** ACCEPTABLE — will populate after first production deployment with sourcemaps

**Commit Phase 3:**
```bash
git add .env.example
git commit -m "chore: add Sentry auth token to env example for sourcemap uploads

- Add SENTRY_AUTH_TOKEN placeholder to .env.example
- Token required for production sourcemap upload during build
- Actual token stored in Vercel env vars (not committed)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Phase 4: Update Documentation (LOW PRIORITY)

**Step 4.1: Fix Outdated Paths (2 minutes):**

```bash
# Edit docs/refactor-optimize-backlog.md
# Find and replace:
# app/professionals/[id]/page.tsx → app/kandidaten/[id]/page.tsx

# Verify path exists
ls -la app/kandidaten/[id]/page.tsx
# Expected: File exists

# Verify old path does NOT exist
ls -la app/professionals/[id]/page.tsx 2>&1
# Expected: "No such file or directory"
```

**Commit Phase 4:**
```bash
git add docs/refactor-optimize-backlog.md
git commit -m "docs: update refactor backlog with current paths after migration

- Replace app/professionals/* with app/kandidaten/*
- Reflects opdrachten→vacatures and professionals→kandidaten migration
- No functional changes, documentation hygiene only

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Post-Deploy Verification (Within 5 Minutes of Deployment)

### 1. Build Verification

**Vercel Build Check (3 minutes):**

```bash
# Monitor Vercel deployment
vercel logs --follow

# Expected output:
# - "Building application..." (Next.js build starts)
# - "Compiling..." (TypeScript compilation)
# - "Uploading sourcemaps to Sentry..." (NEW — confirms auth token works)
# - "Build completed successfully"

# Check for errors
vercel logs | grep -i error
# Expected: No critical errors (warnings are acceptable)

# Verify deployment URL
vercel ls | head -5
# Expected: Shows latest deployment with "Ready" status
```

**Success Indicators:**
- ✅ Build completes without Drizzle type errors
- ✅ Sentry sourcemap upload appears in logs (new behavior)
- ✅ Deployment status shows "Ready"
- ✅ No critical errors in build logs

**If build fails:** Check Vercel logs for specific error, may need to rollback

---

### 2. Database Integrity Verification

**Run Post-Deploy Database Checks (5 minutes):**

```sql
-- Connect to production database (READ-ONLY)

-- 1. Verify table row counts UNCHANGED
SELECT
  'jobs' AS table_name, COUNT(*) AS row_count FROM jobs
UNION ALL
SELECT 'candidates', COUNT(*) FROM candidates
UNION ALL
SELECT 'matches', COUNT(*) FROM matches
UNION ALL
SELECT 'autopilot_runs', COUNT(*) FROM autopilot_runs
UNION ALL
SELECT 'autopilot_findings', COUNT(*) FROM autopilot_findings;
-- Compare with pre-deploy baseline: MUST BE IDENTICAL

-- 2. Verify no schema changes
SELECT COUNT(*) FROM drizzle.__drizzle_migrations;
-- Compare with pre-deploy: MUST BE IDENTICAL (no new migrations)

-- 3. Verify no unexpected data modifications
SELECT
  table_name,
  MAX(last_update) AS latest_update
FROM (
  SELECT 'jobs' AS table_name, MAX(updated_at) AS last_update FROM jobs
  UNION ALL
  SELECT 'candidates', MAX(updated_at) FROM candidates
  UNION ALL
  SELECT 'matches', MAX(updated_at) FROM matches
) updates
GROUP BY table_name;
-- Expected: No suspicious mass updates (timestamps should be gradual)
```

**Save Results:**
```bash
psql $DATABASE_URL -f post-deploy-db-verification.sql > post-deploy-db-verification.txt

# Compare with baseline
diff pre-deploy-db-baseline.txt post-deploy-db-verification.txt
# Expected: No differences (row counts identical)
```

**Success Criteria:**
- ✅ Row counts match pre-deploy baseline exactly
- ✅ Migration count unchanged (no new migrations)
- ✅ No mass data updates detected

**If row counts differ:** CRITICAL — investigate data loss/corruption immediately

---

### 3. Application Smoke Tests

**Manual UI Verification (10 minutes):**

```bash
# Open production URL
open https://motian.vercel.app  # Or your production domain

# Test critical user flows:
# 1. Homepage loads without errors
# 2. Navigate to /vacatures (job listings)
# 3. Open a job detail page (/vacatures/[id])
# 4. Navigate to /kandidaten (candidate listings)
# 5. Open a candidate detail page (/kandidaten/[id])
# 6. Open AI chat interface (/chat or /overzicht with chat)
# 7. Trigger a search query (hybrid search)
# 8. Check matches page (/matches)

# Check browser console for errors
# Expected: No critical JavaScript errors, no failed API calls
```

**API Health Check:**

```bash
# Test critical API endpoints
curl https://motian.vercel.app/api/health
# Expected: 200 OK

# Test database connection via API
curl https://motian.vercel.app/api/jobs/stats
# Expected: 200 OK with valid JSON stats

# Test AI chat endpoint (requires auth, manual browser test)
# Navigate to chat interface, send test message
# Expected: AI responds normally
```

**Success Criteria:**
- ✅ All pages load without 500 errors
- ✅ Database queries return data
- ✅ AI chat responds to messages
- ✅ No critical console errors in browser

**If any critical flow fails:** INVESTIGATE — may need rollback

---

### 4. Sentry Verification

**Check Sourcemap Upload (5 minutes):**

```bash
# Visit Sentry releases page
open https://ryan-lisse-bv.sentry.io/organizations/ryan-lisse-bv/releases/

# Manual verification:
# 1. Check for new release corresponding to deployment
# 2. Verify "Sourcemaps" count > 0 (should show uploaded maps)
# 3. Click into release, check "Artifacts" tab
# 4. Confirm source files are uploaded

# Trigger a test error to verify sourcemaps work
# (Optional, only if no recent production errors exist)
# Navigate to /api/test-error (if such endpoint exists)
# Or manually throw error in browser console
```

**Check Error Reporting:**

```bash
# Visit Sentry issues page
open https://ryan-lisse-bv.sentry.io/projects/motian/issues/

# If recent errors exist:
# 1. Open error details
# 2. Check stack trace shows ORIGINAL source code (not minified)
# 3. Verify file paths resolve correctly

# If no recent errors:
# - This is GOOD (no production issues)
# - Sourcemaps will be verified when next error occurs
```

**Success Criteria:**
- ✅ New Sentry release created with sourcemaps
- ✅ Sourcemap artifacts uploaded (count > 0)
- ✅ (If errors exist) Stack traces show original source

**If sourcemaps not uploaded:** Check Vercel logs for upload errors, verify SENTRY_AUTH_TOKEN is set

---

### 5. Trigger.dev Task Verification

**Check Task Health After Deploy (5 minutes):**

```bash
# Visit Trigger.dev dashboard
open https://cloud.trigger.dev/orgs/YOUR_ORG/projects/YOUR_PROJECT/runs

# Manual verification:
# 1. Check tasks that run on deployment (if any)
# 2. Verify no new failures after deployment
# 3. Check scheduled tasks continue running normally
# 4. Verify task versions updated to new deployment

# Trigger a test task (if available)
# Example: Manually trigger embeddings-batch task
# Expected: Task runs successfully with new code version
```

**Success Criteria:**
- ✅ No new task failures after deployment
- ✅ Scheduled tasks continue running on schedule
- ✅ Task versions show updated deployment

**If tasks fail:** Check task logs, may indicate code issue in trigger/*.ts files

---

## Monitoring (First 24 Hours)

### Automated Monitoring Setup

**Dashboards to Monitor:**

1. **Vercel Analytics** (https://vercel.com/your-team/motian-recruitment/analytics)
   - Monitor: Response times, error rate, function invocations
   - Alert if: Error rate > 5% for 10 minutes

2. **Sentry Dashboard** (https://ryan-lisse-bv.sentry.io/projects/motian/)
   - Monitor: Error frequency, new issue types
   - Alert if: New error type appears OR error rate doubles

3. **Neon Database Metrics** (https://console.neon.tech/app/projects/YOUR_PROJECT)
   - Monitor: Connection count, query latency, database size
   - Alert if: Connection count > 80% of limit OR query latency > 1s avg

4. **Trigger.dev Dashboard** (https://cloud.trigger.dev)
   - Monitor: Task success rate, task duration
   - Alert if: Task failure rate > 10% OR any task times out

### Alert Conditions

| Metric | Threshold | Action |
|--------|-----------|--------|
| Vercel Error Rate | > 5% for 10 min | Investigate logs, consider rollback |
| Sentry New Issue Type | Any new critical error | Triage immediately, may need hotfix |
| Database Connections | > 80% of limit | Check for connection leaks, scale if needed |
| Trigger Task Failures | > 3 consecutive failures | Check task logs, verify DB connectivity |
| API Response Time | > 2s p95 for 15 min | Check DB query performance, Vercel logs |

### Manual Checks

**1 Hour Post-Deploy:**
```bash
# Check Vercel deployment logs
vercel logs --since 1h | grep -i error
# Expected: No recurring errors

# Check Sentry for new issues
open https://ryan-lisse-bv.sentry.io/projects/motian/issues/?query=is:unresolved
# Expected: No new unresolved issues

# Verify key metrics
curl https://motian.vercel.app/api/jobs/stats
# Expected: Response time < 500ms, valid data
```

**4 Hours Post-Deploy:**
```bash
# Check Trigger.dev task runs
# Visit dashboard, filter to last 4 hours
# Expected: All scheduled tasks ran successfully

# Check database for any anomalies
psql $DATABASE_URL -c "SELECT COUNT(*) FROM jobs;"
# Expected: Count matches earlier baseline (no data loss)
```

**24 Hours Post-Deploy:**
```bash
# Final health check
pnpm run harness:smoke
# Expected: All smoke tests pass

# Review Sentry issues
# Triage any new issues that appeared
# Document any patterns or recurring problems

# Review Vercel analytics
# Check for any performance regressions
# Compare with pre-deploy baseline if available
```

---

## Rollback Plan

### Can We Roll Back?

**YES — Deployment is FULLY REVERSIBLE with no data loss**

**Rollback Safety:**
- ✅ No database migrations (schema unchanged)
- ✅ No data transformations (no backfills)
- ✅ Code-only changes (dependency versions, test mocks, config)
- ✅ Vercel supports instant rollback to previous deployment

**When to Roll Back:**
- Critical UI flow broken (e.g., jobs list doesn't load)
- Database connection errors spike
- Trigger.dev tasks fail consistently
- Error rate exceeds 10% for 15 minutes
- Sentry shows critical new error affecting >5% of users

### Rollback Steps

**Option 1: Vercel UI Rollback (FASTEST — 2 minutes):**

1. Visit https://vercel.com/your-team/motian-recruitment/deployments
2. Find previous successful deployment (before this one)
3. Click "..." menu → "Promote to Production"
4. Confirm promotion
5. Wait for deployment to complete (30-60 seconds)
6. Verify application loads at production URL

**Option 2: Git Revert + Redeploy (SAFER — 5 minutes):**

```bash
# Create revert commit
git revert HEAD~4..HEAD  # Reverts last 4 commits (all phases)

# Push to trigger new deployment
git push origin main

# Monitor Vercel deployment
vercel logs --follow

# Verify rollback successful
curl https://motian.vercel.app/api/health
# Expected: 200 OK
```

**Option 3: Manual Revert (IF GIT HISTORY COMPLEX — 10 minutes):**

```bash
# Create new branch from pre-deploy state
git checkout -b rollback-post-drizzle-fixes
git reset --hard <commit-before-deploy>

# Force push to main (ONLY if coordinated with team)
git push origin rollback-post-drizzle-fixes:main --force

# Monitor deployment
vercel logs --follow
```

### Post-Rollback Verification

**Immediate Checks (5 minutes):**

```bash
# 1. Verify application loads
curl https://motian.vercel.app/
# Expected: 200 OK

# 2. Check critical API endpoints
curl https://motian.vercel.app/api/jobs/stats
curl https://motian.vercel.app/api/candidates/stats
# Expected: Both return 200 OK with valid JSON

# 3. Check Sentry error rate drops
open https://ryan-lisse-bv.sentry.io/projects/motian/
# Expected: Error rate returns to baseline

# 4. Verify database unchanged
psql $DATABASE_URL -c "SELECT COUNT(*) FROM jobs;"
# Expected: Same count as pre-deploy baseline
```

**Rollback Success Criteria:**
- ✅ Application loads successfully
- ✅ API endpoints respond normally
- ✅ Error rate drops to baseline
- ✅ Database data intact (no data loss)

**If rollback doesn't resolve issue:** Problem may be unrelated to this deployment — investigate separately

---

## Risk Analysis & Contingencies

### Identified Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **pg override breaks other deps** | LOW | MEDIUM | Test full build after override; check pnpm list for conflicts |
| **Test mocks too broad (over-mocking)** | LOW | LOW | Follow reference pattern exactly; verify tests still validate logic |
| **Sentry token leak in git** | MEDIUM | HIGH | Add to .gitignore, use Vercel env vars only, never commit actual token |
| **Sentry sourcemap upload fails** | MEDIUM | LOW | Check Vercel logs for upload errors; deployment succeeds even if upload fails |
| **Trigger tasks fail after deploy** | LOW | MEDIUM | No changes to task logic, only dependency versions; rollback if persistent failures |
| **Vercel build timeout** | LOW | LOW | Build is same complexity as before; no new build steps added |

### Contingency Plans

**If pg override causes conflicts:**
```bash
# Check for version conflicts
pnpm why pg
# If conflicts found, adjust override version or remove conflicting package

# Test alternative override
# Try pg@8.18.0 instead if 8.20.0 causes issues
```

**If test mocks break tests:**
```bash
# Use importOriginal to partially mock
vi.mock("@/src/db", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    db: { /* mock only db */ },
  };
});
```

**If Sentry token is compromised:**
```bash
# 1. Revoke token immediately
# Visit https://sentry.io/settings/account/api/auth-tokens/
# Click "Revoke" on compromised token

# 2. Generate new token
# Create new token with same scopes

# 3. Update Vercel env vars
vercel env rm SENTRY_AUTH_TOKEN production
vercel env add SENTRY_AUTH_TOKEN production
# Paste new token

# 4. Rotate git history if committed
# Use git filter-branch or BFG Repo-Cleaner
# ONLY if token was committed (should not happen)
```

**If Trigger tasks fail persistently:**
```bash
# 1. Check task logs
open https://cloud.trigger.dev/orgs/YOUR_ORG/projects/YOUR_PROJECT/runs

# 2. Identify specific failing task
# Example: embeddings-batch fails with DB connection error

# 3. Test task locally
pnpm dev
# Trigger task manually, check local logs

# 4. If DB connection issue:
# Verify DATABASE_URL in Vercel env vars
# Check Neon database is reachable

# 5. If rollback needed:
# Follow Vercel UI rollback steps
```

---

## Go/No-Go Decision Matrix

### PRE-DEPLOY GO/NO-GO

**GO Criteria (ALL must be met):**
- ✅ Pre-deploy build fails with KNOWN Drizzle error (expected)
- ✅ Pre-deploy tests fail with KNOWN mock export errors (expected)
- ✅ Database baseline queries return expected results
- ✅ Vercel env vars verified (DATABASE_URL, AI keys present)
- ✅ Trigger.dev tasks show recent successful runs
- ✅ No long-running DB queries blocking deployment
- ✅ Git working directory clean or only contains deployment changes
- ✅ Team notified of deployment window

**NO-GO Criteria (ANY causes deployment stop):**
- ❌ Unexpected build failures (different from known Drizzle error)
- ❌ Unexpected test failures (different from known mock errors)
- ❌ Database baseline queries fail or return anomalous data
- ❌ DATABASE_URL missing or incorrect in Vercel
- ❌ Critical Trigger tasks failing for >24 hours
- ❌ Long-running DB queries (>5 min) in pg_stat_activity
- ❌ Production incidents in progress (Sentry alerts firing)

### POST-DEPLOY GO/NO-GO

**CONTINUE (Deployment Successful) Criteria:**
- ✅ Vercel build completes successfully
- ✅ Sentry sourcemap upload appears in logs (or gracefully skipped)
- ✅ Database row counts match pre-deploy baseline
- ✅ Application loads without 500 errors
- ✅ Critical UI flows work (jobs, candidates, chat)
- ✅ Error rate remains below 5%
- ✅ No new critical errors in Sentry

**ROLLBACK Criteria:**
- ❌ Vercel build fails repeatedly
- ❌ Database row counts differ from baseline
- ❌ Application returns 500 errors on homepage
- ❌ Critical UI flows broken (jobs list doesn't load)
- ❌ Error rate exceeds 10% for 15 minutes
- ❌ New critical error in Sentry affecting >5% of users
- ❌ Trigger tasks fail consistently (>3 consecutive failures)

---

## Success Metrics

### Immediate Success (0-5 Minutes Post-Deploy)

- ✅ **Build Success**: Vercel build completes in <5 minutes
- ✅ **No Type Errors**: Zero "shouldInlineParams" errors in build log
- ✅ **Sourcemap Upload**: Sentry shows new release with sourcemaps
- ✅ **Data Integrity**: Database row counts unchanged
- ✅ **Application Available**: Homepage loads with 200 status

### Short-Term Success (24 Hours Post-Deploy)

- ✅ **Error Rate**: Remains below 5% (same as pre-deploy baseline)
- ✅ **Response Time**: P95 < 1s (no regression)
- ✅ **Task Success Rate**: Trigger.dev tasks >95% success rate
- ✅ **Zero Rollbacks**: No rollback required
- ✅ **Sentry Readability**: New errors show original source code (not minified)

### Long-Term Success (1 Week Post-Deploy)

- ✅ **CI/CD Unblocked**: All tests pass consistently
- ✅ **Developer Velocity**: No build-related issues reported
- ✅ **Observability**: Sentry stack traces improve bug triage time by >50%
- ✅ **Production Stability**: No deployment-related incidents

---

## Team Communication

### Pre-Deployment Notification

**Send to:** Engineering team, DevOps, Product (if applicable)

**Subject:** [DEPLOY] Post-Drizzle Quality Fixes — Production Deployment on [DATE]

**Message Template:**
```
Team,

We will be deploying critical quality fixes for the Drizzle refactor:

DEPLOYMENT WINDOW: [DATE] [TIME] ([TIMEZONE])
EXPECTED DURATION: 30 minutes (build + verification)
IMPACT: None (zero downtime, no database changes)

CHANGES:
- Fix pg version mismatch (pnpm override)
- Fix test mocks (29 failing tests resolved)
- Configure Sentry sourcemaps (improved error visibility)
- Update documentation paths

RISKS: Low (no database migrations, code-only changes, full rollback available)

ROLLBACK PLAN: Vercel UI rollback available (instant)

MONITORING: Vercel, Sentry, Trigger.dev dashboards

Please report any issues in #engineering-alerts Slack channel.

Full deployment plan: docs/deployment-verification-post-drizzle-quality-fixes.md
```

### Post-Deployment Notification

**Success Template:**
```
✅ DEPLOYMENT SUCCESSFUL: Post-Drizzle Quality Fixes

- Build completed successfully
- All tests passing (29 failures resolved)
- Sentry sourcemaps uploaded
- Database integrity verified (no data changes)
- Application health: NORMAL

Monitoring continues for 24 hours. Report issues in #engineering-alerts.
```

**Rollback Template:**
```
⚠️ DEPLOYMENT ROLLED BACK: Post-Drizzle Quality Fixes

REASON: [Specific issue, e.g., "Critical UI flow broken"]

ACTION TAKEN: Rolled back to previous deployment via Vercel UI

STATUS: Application restored to pre-deploy state

NEXT STEPS: Investigating root cause, will reschedule deployment after fix

Full incident details in #engineering-alerts.
```

---

## Appendix: SQL Scripts

### Pre-Deploy Database Baseline

Save as `pre-deploy-db-baseline.sql`:

```sql
-- Pre-Deploy Database Baseline
-- Run BEFORE deployment to establish baseline state

-- 1. Table Existence Check
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('jobs', 'candidates', 'matches', 'autopilot_runs', 'autopilot_findings')
ORDER BY table_name;

-- 2. Row Count Baseline
SELECT
  'jobs' AS table_name, COUNT(*) AS row_count FROM jobs
UNION ALL
SELECT 'candidates', COUNT(*) FROM candidates
UNION ALL
SELECT 'matches', COUNT(*) FROM matches
UNION ALL
SELECT 'autopilot_runs', COUNT(*) FROM autopilot_runs
UNION ALL
SELECT 'autopilot_findings', COUNT(*) FROM autopilot_findings;

-- 3. Migration State
SELECT COUNT(*) AS migration_count FROM drizzle.__drizzle_migrations;

-- 4. Active Connections Check
SELECT
  COUNT(*) AS active_connections,
  COUNT(*) FILTER (WHERE state = 'active') AS active_queries,
  COUNT(*) FILTER (WHERE state = 'idle') AS idle_connections
FROM pg_stat_activity
WHERE datname = current_database();

-- 5. Long-Running Queries (potential blockers)
SELECT
  pid,
  usename,
  application_name,
  state,
  query_start,
  NOW() - query_start AS duration,
  LEFT(query, 100) AS query_preview
FROM pg_stat_activity
WHERE state != 'idle'
  AND query NOT LIKE '%pg_stat_activity%'
  AND NOW() - query_start > INTERVAL '5 minutes'
ORDER BY query_start;
```

### Post-Deploy Verification

Save as `post-deploy-db-verification.sql`:

```sql
-- Post-Deploy Database Verification
-- Run AFTER deployment to verify no data changes

-- 1. Row Count Verification (MUST match pre-deploy)
SELECT
  'jobs' AS table_name, COUNT(*) AS row_count FROM jobs
UNION ALL
SELECT 'candidates', COUNT(*) FROM candidates
UNION ALL
SELECT 'matches', COUNT(*) FROM matches
UNION ALL
SELECT 'autopilot_runs', COUNT(*) FROM autopilot_runs
UNION ALL
SELECT 'autopilot_findings', COUNT(*) FROM autopilot_findings;

-- 2. Migration State (MUST match pre-deploy)
SELECT COUNT(*) AS migration_count FROM drizzle.__drizzle_migrations;

-- 3. Recent Data Modifications Check
SELECT
  table_name,
  MAX(last_update) AS latest_update,
  COUNT(*) AS recent_updates
FROM (
  SELECT 'jobs' AS table_name, updated_at AS last_update FROM jobs WHERE updated_at > NOW() - INTERVAL '1 hour'
  UNION ALL
  SELECT 'candidates', updated_at FROM candidates WHERE updated_at > NOW() - INTERVAL '1 hour'
  UNION ALL
  SELECT 'matches', updated_at FROM matches WHERE updated_at > NOW() - INTERVAL '1 hour'
) updates
GROUP BY table_name;

-- 4. Database Health Check
SELECT
  COUNT(*) AS active_connections,
  COUNT(*) FILTER (WHERE state = 'active') AS active_queries
FROM pg_stat_activity
WHERE datname = current_database();
```

---

## Conclusion

This deployment is **LOW-RISK** with **HIGH-VALUE** outcomes:

**Why Low Risk:**
- No database migrations (zero data modification)
- No schema changes (table structure unchanged)
- Code-only changes (dependencies, test mocks, config)
- Instant rollback available (Vercel UI or git revert)
- No downtime (Vercel zero-downtime deployments)

**Why High Value:**
- Unblocks production builds (resolves critical type errors)
- Unblocks CI/CD pipeline (fixes 29 failing tests)
- Improves observability (Sentry sourcemaps for readable errors)
- Prevents future developer friction (tests pass consistently)

**Recommendation:** ✅ **APPROVED FOR PRODUCTION DEPLOYMENT**

---

**Document Version:** 1.0
**Last Updated:** 2026-03-14
**Author:** Deployment Verification Agent
**Reviewed By:** [Pending Engineering Review]
