---
title: "fix: Scraper silent failure bug — scrapers swallow errors and report false success"
type: fix
date: 2026-02-24
---

## Enhancement Summary

**Deepened on:** 2026-02-24
**Sections enhanced:** 6
**Review agents used:** kieran-typescript-reviewer, deployment-verification-agent, code-simplicity-reviewer, architecture-strategist, pattern-recognition-specialist

### Key Improvements
1. Two surviving `return []` paths identified and must be fixed (flextender empty HTML, striive missing marker)
2. Safety net decision: keep it as defense-in-depth but fix the surviving paths so it's truly a last resort
3. Empty `catch {}` blocks should log errors instead of silently swallowing
4. Comprehensive deployment checklist with SQL verification queries added

### Institutional Learning Applied
- From `docs/solutions/workflow-issues/scraper-analytics-schedule-optimization-ScraperSystem-20260223.md`: Trigger.dev canonical task directory is `trigger/` (not `src/trigger/`). Scheduler multiplexer pattern with per-platform `isDue()` is working correctly.

---

# fix: Scraper silent failure bug

## Overview

All three scrapers (Flextender, Striive, Opdrachtoverheid) catch errors internally and `return []` instead of throwing. When this happens, the pipeline records `status: "success"` with zero jobs — a false positive. The circuit breaker never trips, so broken scrapers keep running silently.

## Problem Statement

**Before fix:** Scraper throws internally → catches error → returns `[]` → pipeline sees 0 listings, 0 errors → records `"success"` → `consecutiveFailures` stays 0 → circuit breaker never trips.

**Root cause:** Error handling at the wrong layer. Scrapers should propagate errors to the pipeline, which already has proper failure recording logic.

## Changes Already Made

### 1. `src/services/scrapers/flextender.ts`
- `return []` after retry exhaustion → `throw new Error(...)` with descriptive message
- Unreachable `return []` at end → `throw` for TypeScript exhaustiveness

### 2. `src/services/scrapers/striive.ts`
- Missing credentials: `return []` → `throw new Error("STRIIVE_USERNAME en STRIIVE_PASSWORD moeten ingesteld zijn")`
- Modal sandbox failure: `return []` → `throw new Error(...)` with original error message

### 3. `src/services/scrapers/opdrachtoverheid.ts`
- `return []` after retry exhaustion → `throw new Error(...)` with descriptive message
- Unreachable `return []` at end → `throw` for TypeScript exhaustiveness

### 4. `src/services/scrape-pipeline.ts`
- Added safety net at line 47-63: if `listings.length === 0`, record as `"failed"` with descriptive error
- Future-proof: catches any new scraper that returns empty array without throwing

## Additional Changes Required (from review)

### 5. `src/services/scrapers/flextender.ts:62-65` — Surviving silent return
```typescript
// BEFORE (still returns [] on empty HTML — bypasses retry loop):
if (!html) {
  console.warn("Flextender: lege HTML response");
  return [];
}

// AFTER (throw triggers retry, then exhaustion throw if persistent):
if (!html) {
  throw new Error("Flextender: lege HTML response van AJAX endpoint");
}
```

### 6. `src/services/scrapers/striive.ts:377-381` — Surviving silent return
```typescript
// BEFORE (returns [] when Modal sandbox output has no result marker):
if (markerIdx === -1) {
  console.error("[striive] No result marker found in Modal sandbox output");
  console.error(`[striive] Full stdout: ${stdout}`);
  return [];
}

// AFTER (throw with diagnostic info):
if (markerIdx === -1) {
  const stdoutSnippet = stdout.substring(0, 500);
  throw new Error(
    `Striive Modal: geen resultaat-marker in sandbox output. stdout: ${stdoutSnippet}`,
  );
}
```

### 7. `src/services/scrape-pipeline.ts` — Log `recordScrapeResult` failures
```typescript
// BEFORE (3x in file — silent swallow):
} catch {}

// AFTER (log so DB write failures are visible):
} catch (recordErr) {
  console.error(`[scrape-pipeline] recordScrapeResult mislukt voor ${platform}:`, recordErr);
}
```

## Acceptance Criteria

- [x] All surviving `return []` paths fixed (flextender:64, striive:381)
- [x] Empty `catch {}` blocks replaced with logging
- [x] All files committed and pushed to `main`
- [x] Biome lint passes
- [x] CI pipeline passes (lint → typecheck → test → build) — qlty biome parse error is pre-existing, unrelated
- [x] Vercel deployment succeeds (Next.js app) — auto-deployed on push to main
- [x] Trigger.dev deployment succeeds (scrape-pipeline task updated) — version 20260224.1, 20260224.2
- [ ] Next scrape cycle correctly reports failures when a scraper errors

## Deployment Steps

1. **Fix** the two surviving `return []` paths + empty catch blocks
2. **Lint** — `pnpm lint` to verify
3. **Commit** all changed scraper files to `main`
4. **Push** to origin — triggers CI (lint, typecheck, test, build) and Vercel auto-deploy
5. **Deploy Trigger.dev** — `npx trigger.dev@latest deploy` (ensure no run is executing)
6. **Verify** — run post-deploy SQL queries below

## Deployment Verification

### Pre-Deploy Baseline (save output)
```sql
-- Circuit breaker state
SELECT platform, is_active, consecutive_failures, last_run_status, last_run_at
FROM scraper_configs ORDER BY platform;

-- Recent results per platform
SELECT DISTINCT ON (platform) platform, status, jobs_found, jobs_new, errors, run_at
FROM scrape_results ORDER BY platform, run_at DESC;
```

### Post-First-Run Verification
```sql
-- Confirm new run recorded correctly
SELECT DISTINCT ON (platform) platform, status, jobs_found, jobs_new, duplicates, errors, duration_ms, run_at
FROM scrape_results ORDER BY platform, run_at DESC;

-- Confirm circuit breaker behaves correctly
SELECT platform, consecutive_failures, last_run_status FROM scraper_configs ORDER BY platform;

-- Confirm job counts stable
SELECT platform, COUNT(*) AS total_jobs FROM jobs WHERE deleted_at IS NULL GROUP BY platform;
```

### Rollback
```bash
git revert HEAD && git push origin main && npx trigger.dev@latest deploy
```

## Risk Analysis

- **Low risk**: Changes only affect error propagation paths — happy path (successful scrapes) is unchanged
- **Circuit breaker safety**: If a platform genuinely has issues, it will now correctly trip after 5 failures instead of silently continuing
- **Rollback**: Simple git revert + redeploy

## References

- `src/services/scrape-pipeline.ts:30-63` — error handling + safety net
- `src/services/record-scrape-result.ts:43-52` — circuit breaker logic
- `src/lib/helpers.ts` — `CIRCUIT_BREAKER_THRESHOLD = 5`
- `src/lib/retry.ts` — existing `withRetry` utility (future: scrapers could adopt this)
- `docs/solutions/workflow-issues/scraper-analytics-schedule-optimization-ScraperSystem-20260223.md` — related scraper system learning
