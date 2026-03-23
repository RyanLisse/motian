# Deployment Verification Summary: Post-Drizzle Quality Fixes

**Quick Reference for Engineering Team**

---

## Executive Decision: GO/NO-GO

**RECOMMENDATION: ✅ GO FOR PRODUCTION DEPLOYMENT**

**Risk Level:** LOW (code-only changes, no database modifications)
**Deployment Window:** Business hours acceptable (zero downtime)
**Rollback Time:** <2 minutes (Vercel UI instant rollback)

---

## 30-Second Summary

This deployment fixes three critical issues from the Drizzle refactor:

1. **Build Blocker**: pg version mismatch (force single version via pnpm override)
2. **CI/CD Blocker**: 29 failing tests (add missing mock exports)
3. **Observability Gap**: Sentry sourcemaps (add auth token to Vercel)

**Data Impact:** NONE — No database migrations, no schema changes, no data transformations

**Rollback Safety:** FULL — Instant rollback via Vercel UI or git revert

---

## Pre-Deploy Checklist (15 Minutes)

```bash
# 1. Baseline Build Failure (Expected)
pnpm build 2>&1 | tee pre-deploy-build.log
grep "shouldInlineParams" pre-deploy-build.log
# ✅ PASS: Build fails with known Drizzle type error

# 2. Baseline Test Failures (Expected)
pnpm test 2>&1 | tee pre-deploy-tests.log
grep -c "^[[:space:]]*×" pre-deploy-tests.log
# ✅ PASS: ~29 tests fail with "No export" errors

# 3. Database Baseline
psql $DATABASE_URL -f pre-deploy-db-baseline.sql > baseline.txt
# ✅ PASS: All tables exist, row counts recorded

# 4. Vercel Env Vars
vercel env ls production | grep -E "(DATABASE_URL|SENTRY)"
# ✅ PASS: DATABASE_URL exists, SENTRY_AUTH_TOKEN missing (expected)

# 5. Trigger.dev Health
open https://cloud.trigger.dev
# ✅ PASS: Recent successful task runs, no persistent failures
```

**GO Criteria:** All 5 checks pass
**NO-GO Criteria:** Any unexpected failures

---

## Deployment Steps (30 Minutes)

### Phase 1: Fix Build (5 min)
```bash
# Add to package.json pnpm.overrides:
"pg": "^8.20.0"

pnpm install --force
pnpm build  # Should pass now
```

### Phase 2: Fix Tests (15 min)
```typescript
// Add to test files:
vi.mock("../src/db", () => ({
  db: { /* existing */ },
  sql: vi.fn(),
  eq: vi.fn(),
  desc: vi.fn(),
}));

vi.mock("@/src/db/schema", () => ({
  autopilotRuns: { /* columns */ },
  autopilotFindings: { /* columns */ },
}));
```

```bash
pnpm test  # Should pass now
```

### Phase 3: Configure Sentry (10 min)
```bash
# 1. Generate token: https://sentry.io/settings/account/api/auth-tokens/
# 2. Add to Vercel:
vercel env add SENTRY_AUTH_TOKEN production
vercel env add SENTRY_AUTH_TOKEN preview

# 3. Update .env.example (placeholder only)
```

---

## Post-Deploy Verification (5 Minutes)

```bash
# 1. Build Success
vercel logs | grep -i "uploading sourcemaps"
# ✅ PASS: Sentry sourcemap upload appears (new behavior)

# 2. Database Integrity
psql $DATABASE_URL -f post-deploy-db-verification.sql > post-deploy.txt
diff baseline.txt post-deploy.txt
# ✅ PASS: No differences (row counts identical)

# 3. Application Health
curl https://motian.vercel.app/api/health
curl https://motian.vercel.app/api/jobs/stats
# ✅ PASS: Both return 200 OK

# 4. Sentry Verification
open https://ryan-lisse-bv.sentry.io/organizations/ryan-lisse-bv/releases/
# ✅ PASS: New release with sourcemaps uploaded

# 5. Smoke Test
open https://motian.vercel.app
# Navigate: /vacatures → /kandidaten → /chat
# ✅ PASS: All pages load, no console errors
```

**Success Criteria:** All 5 checks pass
**Rollback Criteria:** Any critical failure (see below)

---

## Rollback Decision Tree

```
Is homepage loading?
├─ NO → ROLLBACK IMMEDIATELY
└─ YES → Are critical API endpoints working?
    ├─ NO → ROLLBACK IMMEDIATELY
    └─ YES → Is error rate < 10%?
        ├─ NO → ROLLBACK IMMEDIATELY
        └─ YES → Are database row counts correct?
            ├─ NO → ROLLBACK IMMEDIATELY
            └─ YES → ✅ DEPLOYMENT SUCCESSFUL
```

### Instant Rollback (2 Minutes)

**Option 1: Vercel UI (FASTEST)**
1. Visit https://vercel.com/your-team/motian-recruitment/deployments
2. Find previous deployment
3. Click "Promote to Production"
4. Verify application loads

**Option 2: Git Revert**
```bash
git revert HEAD~4..HEAD  # Reverts all 4 phase commits
git push origin main
vercel logs --follow
```

---

## Monitoring (24 Hours)

### Automated Alerts

| Metric | Threshold | Dashboard |
|--------|-----------|-----------|
| Error Rate | >5% for 10 min | Vercel Analytics |
| New Error Type | Any critical | Sentry Issues |
| DB Connections | >80% limit | Neon Console |
| Task Failures | >3 consecutive | Trigger.dev Runs |

### Manual Checks

**+1 Hour:**
```bash
vercel logs --since 1h | grep -i error
# Expected: No recurring errors
```

**+4 Hours:**
```bash
# Check Trigger.dev tasks ran successfully
open https://cloud.trigger.dev
```

**+24 Hours:**
```bash
pnpm run harness:smoke
# Expected: All smoke tests pass
```

---

## Key Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| pg override breaks deps | LOW | Check pnpm list after install, rollback if conflicts |
| Test mocks too broad | LOW | Follow reference pattern exactly, verify tests still validate |
| Sentry token leak | MEDIUM | Never commit, use Vercel env vars only, rotate if compromised |
| Trigger tasks fail | LOW | No task logic changes, rollback if persistent failures |

---

## Team Communication

### Pre-Deployment Announcement

```
[DEPLOY] Post-Drizzle Quality Fixes
DATE: [YOUR DATE]
TIME: [YOUR TIME]
DURATION: 30 minutes
IMPACT: None (zero downtime, no DB changes)
ROLLBACK: Available (instant)
```

### Post-Deployment Success

```
✅ DEPLOYMENT SUCCESSFUL
- Build: PASS (Drizzle errors resolved)
- Tests: PASS (29 failures resolved)
- Sentry: CONFIGURED (sourcemaps uploaded)
- Database: VERIFIED (no data changes)
```

### Post-Deployment Failure

```
⚠️ DEPLOYMENT ROLLED BACK
REASON: [Specific issue]
STATUS: Application restored to pre-deploy state
NEXT STEPS: Investigating, will reschedule
```

---

## Critical Files

**Full Documentation:**
- `/Users/cortex-air/Developer/motian/docs/deployment-verification-post-drizzle-quality-fixes.md`

**SQL Scripts:**
- `pre-deploy-db-baseline.sql` (run before deploy)
- `post-deploy-db-verification.sql` (run after deploy)

**Implementation Plan:**
- `/Users/cortex-air/Developer/motian/docs/plans/2026-03-14-fix-post-drizzle-refactor-quality-fixes-plan.md`

---

## Final Recommendation

**✅ APPROVED FOR PRODUCTION DEPLOYMENT**

**Reasoning:**
- No database changes (zero data risk)
- Instant rollback available (zero recovery time)
- Critical bug fixes (unblocks build + CI/CD)
- High value improvements (Sentry observability)

**Deployment Confidence:** HIGH

---

**Document Version:** 1.0
**Last Updated:** 2026-03-14
**Quick Reference Only** — See full deployment-verification document for complete details
