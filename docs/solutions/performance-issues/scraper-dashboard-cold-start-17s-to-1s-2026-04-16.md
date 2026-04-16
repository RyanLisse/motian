---
title: "Scraper dashboard cold-start: 17s → 1.1s"
date: 2026-04-16
category: performance-issues
module: scraper_dashboard
problem_type: performance_issue
component: service_object
severity: high
symptoms:
  - "/scraper cold-start TTFB+DOMready ~17.2s in browser (10.4s server)"
  - "Dashboard blocked on dedup CTE window function scanning 53K+ jobs for a scalar count"
  - "Every dashboard load triggered a fresh external Trigger.dev API call (1-3s, spikes to 10s)"
  - "listPlatformCatalog timed out at its 10s withTimeoutFallback budget, rendering the platforms card empty"
  - "Sequential awaits in the Server Component serialized otherwise-independent data fetches behind a single Neon connection"
root_cause: async_timing
resolution_type: code_fix
related_components:
  - database
  - background_job
  - service_object
tags:
  - scraper-dashboard
  - nextjs-app-router
  - neon
  - upstash-cache
  - connection-pool
  - trigger-dev
  - dedup-cte
  - parallel-loading
---

# Scraper dashboard cold-start: 17s → 1.1s

## Problem

The Motian scraper dashboard at `/scraper` took 17 seconds to load (10.4s server render, 17.2s total in the browser). Recruiters waited 15+ seconds just to see scraper health, platform catalog, and recent run activity, making the operations surface feel broken.

## Symptoms

- Server render of `app/scraper/page.tsx` consistently took 10-12s on warm requests, spiking to 17s cold.
- Browser time-to-interactive measured at 17.2s. Lighthouse performance score sat in the low teens.
- `listPlatformCatalog` frequently tripped its 10s `withTimeoutFallback` budget and rendered the platforms card empty.
- Intermittent `Error: connect ETIMEDOUT` from the Trigger.dev `runs.list()` pagination call pushed totals past 20s.
- Sidebar navigation to `/scraper` felt frozen: no skeleton visible because the entire page awaited upstream promises before any Suspense boundary committed.

## What Didn't Work

Several intermediate attempts reduced the load from 17s to ~5-8s but did not solve the root problem (session history):

- **Wrapping `getTriggerVisibility()` in `Promise.race([..., timeout])` alone.** `@trigger.dev/sdk@4`'s `runs.list()` async iterator does not accept an `AbortSignal`, so the underlying HTTP pagination kept running after the race resolved. The timeout masked the symptom but leaked request work.
- **Parallelizing `listPlatformCatalog`'s three internal queries with `Promise.all`.** The Neon serverless driver is configured with `max: 1` in `src/db/index.ts`, so concurrent queries on the same pool produced intermittent `too many connections` errors. The serialized shape inside that function was intentional.
- **Dropping `getActiveVacancyCount`'s dedup CTE for a raw `count(*)`.** The dashboard needs the deduplicated count (same job across multiple sources counted once), so a naive count returned visibly wrong numbers in the KPI card.
- **Shortening the dedup CTE's `limit` from a large page to `limit: 1`.** The CTE materialized the full dedup window over 53K+ rows regardless of `LIMIT`, saving nothing.
- **Using `if (metadata?.totalCount)` as the cache-hit guard** in the first draft of the fix. A legitimate cached `0` fell through to the slow path, masking the cache fix during QA when a fixture had zero open jobs. Surfaced by PR #196 review.
- **Parallelizing the analytics sub-queries inside `getAnalytics()` alone** (commit `7c620815`). Helped by ~1-2s but left the dashboard+catalog sequential pair untouched; load stayed around 5-8s (session history).

## Solution

Four coordinated changes in `src/services/scraper-dashboard.ts` and `app/scraper/page.tsx`.

### Fix 1: reuse cached sidebar metadata for the active vacancy count

`getActiveVacancyCount()` ran a dedup CTE window function over 53K+ jobs just to return a scalar. The sidebar's Trigger.dev cron already computes the same `totalCount` and caches it in Upstash.

```ts
// src/services/scraper-dashboard.ts

// Before:
async function getActiveVacancyCount(database: TransactionDb = db): Promise<number> {
  const whereConditions = buildJobFilterConditions();
  const whereClause = (whereConditions.length > 0 ? and(...whereConditions) : sql`true`) as ReturnType<typeof sql>;
  const page = await fetchDedupedJobsPage({ whereClause, limit: 1, offset: 0 });
  return page.total; // dedup CTE over 53K+ rows, 1-2s
}

// After:
async function getActiveVacancyCountFast(database: TransactionDb): Promise<number> {
  if (database === db) {
    const metadata = await getSidebarMetadata().catch(() => null);
    if (metadata != null) return metadata.totalCount; // `!= null` because 0 is a valid cached count
  }
  return getActiveVacancyCount(database); // fallback to dedup CTE
}
```

### Fix 2: cache `getTriggerVisibility` in Upstash with a real cancellation flag

Trigger.dev's `runs.list()` pagination can hang for 1-10s and has no `AbortSignal` support. Wrap it in `cachedQuery` (5 min TTL) and add an `isCancelled` closure that the iteration checks each step so a timeout actually stops the loop.

```ts
// src/services/scraper-dashboard.ts

async function getCachedTriggerVisibility(limit: number): Promise<TriggerVisibility> {
  try {
    return await cachedQuery(
      `scraper-dashboard-trigger-visibility:${limit}`,
      () => getTriggerVisibility(limit),
      TRIGGER_VISIBILITY_CACHE_TTL_SECONDS, // 300
    );
  } catch (error) {
    return createTriggerVisibilityFallback(
      new Date().toISOString(),
      error instanceof Error ? error.message : "Trigger.dev is niet beschikbaar.",
    );
  }
}

// Inside getTriggerVisibility(): share isCancelled between the timeout and the iterator
let isCancelled = false;
const timeoutId = setTimeout(() => {
  isCancelled = true;
}, TRIGGER_LIST_TIMEOUT_MS);
try {
  for await (const run of runs.list({ limit })) {
    if (isCancelled) break; // hard exit; SDK has no AbortSignal support in v4
    // ... collect run
  }
} finally {
  clearTimeout(timeoutId);
}
```

### Fix 3: parallelize dashboard + platform catalog at the page level, not inside a function

Previously `ScraperDashboardContent` awaited `getScraperDashboardData()` first, then `listPlatformCatalog()`. Moving both promise starts to the page body lets them run concurrently without sharing a function's await frame, while separate Suspense boundaries render independently.

```tsx
// app/scraper/page.tsx

// Before:
async function ScraperDashboardContent() {
  const scraperDashboard = await getScraperDashboardData({
    activityLimit: 20,
    overlapLimit: 8,
    includeTrigger: true,
  });
  const platformCatalog = await withTimeoutFallback(
    () => listPlatformCatalog(),
    [],
    "listPlatformCatalog",
  );
  // render both
}

// After:
export default function ScraperPage() {
  const dashboardPromise = getScraperDashboardData({
    activityLimit: 20,
    overlapLimit: 8,
    includeTrigger: true,
  });
  const platformCatalogPromise = withTimeoutFallback(
    () => listPlatformCatalog(),
    [] as Awaited<ReturnType<typeof listPlatformCatalog>>,
    "listPlatformCatalog",
    SCRAPER_PAGE_CATALOG_TIMEOUT_MS,
  );

  return (
    <>
      <Suspense fallback={<DashboardSkeleton />}>
        <ScraperDashboardContent dashboardPromise={dashboardPromise} />
      </Suspense>
      <Suspense fallback={<PlatformCatalogCardFallback />}>
        <PlatformCatalogCard platformCatalogPromise={platformCatalogPromise} />
      </Suspense>
    </>
  );
}
```

### Fix 4: extend cache TTLs now that the scheduled cron is the source of truth

Trigger.dev refreshes the dashboard cron every 15 minutes, so there is no benefit to expiring caches inside that window.

- `SCRAPER_DASHBOARD_CACHE_TTL_MS`: 30_000 → 300_000 (30s → 5 min). Overlap groups are the most expensive part to rebuild.
- Sidebar metadata Upstash TTL: 300 → 600 (5 min → 10 min).

**Result:** 10.4s server → 1.1s server (9.3x faster). Browser total 17.2s → ~1.8s.

## Why This Works

The dashboard's latency was dominated by two heavy calls serialized behind a single Neon connection, with the platform catalog queued behind them.

**The dedup CTE was wasteful for a scalar.** `fetchDedupedJobsPage` runs a window-function CTE over every non-deleted job row to deduplicate before paginating. `LIMIT 1` does not reduce the CTE's work because the window partition has to materialize first. The sidebar Trigger.dev cron already produces the same `totalCount` and writes it to Upstash every 15 minutes, so reading from that cache is effectively free.

**Upstash absorbs Trigger.dev's latency variance.** `runs.list()` is an external HTTP call with P99 latency in the multi-second range. Caching its result for 5 minutes turns a variable 1-10s call into a single-digit-ms Upstash read on every request but the first-per-window. The cached wrapper stores the *promise*, not just the resolved value, so concurrent cold-start requests share one roundtrip instead of stampeding.

**Neon `max: 1` makes in-function parallelism dangerous, but page-level parallelism safe.** `Promise.all` inside a function that holds a single connection bursts the pool because all branches try to acquire the connection simultaneously. Starting two independent top-level promises in the React Server Component body, each consumed by its own Suspense boundary, lets them interleave naturally: while `getScraperDashboardData` awaits Upstash (not holding a connection), `listPlatformCatalog` can acquire the connection, run its serialized queries, and release it. The two workloads never contend because their bottleneck phases (external I/O vs. DB I/O) are disjoint.

**Suspense boundaries commit independently.** Before Fix 3, the server waited for both promises before sending any HTML. After Fix 3, each Suspense child streams as soon as it resolves, so users see the dashboard skeleton immediately and the catalog card renders whenever its (now-unblocked) query returns.

**The `!= null` check matters because `0` is a real value.** `getSidebarMetadata` returns `{ totalCount: 0 }` for empty datasets or tenants with no open jobs. `if (metadata?.totalCount)` treated that as a cache miss and fell through to the slow path, negating Fix 1 for that case.

## Prevention

- **Keep parallelism at the Server Component page level, not inside service functions**, whenever the Neon `max: 1` pool is in effect. Service functions that need multiple queries should stay serialized; split independent workloads into separate top-level promises consumed by separate Suspense boundaries.
- **Enforce the page-level pattern with a structural test.** `tests/scraper-dashboard-layout-fixes.test.ts` asserts that `app/scraper/page.tsx` starts both `dashboardPromise` and `platformCatalogPromise` in the page body and that `ScraperDashboardContent` does not call `listPlatformCatalog` itself. Any future regression that re-inlines the catalog fetch inside the dashboard component fails CI.
- **Use `!= null`, not truthy checks, when a cached numeric value can legitimately be `0`.**

  ```ts
  // Wrong: 0 is a cache miss.
  if (metadata?.totalCount) return metadata.totalCount;
  // Right: null/undefined is a cache miss; 0 is a hit.
  if (metadata != null) return metadata.totalCount;
  ```

- **For SDKs that do not accept `AbortSignal`, add an explicit `isCancelled` closure** and check it inside every iterator step. `@trigger.dev/sdk@4`'s paginated `runs.list()` is one such case; assume others are too until verified.

  ```ts
  let isCancelled = false;
  const t = setTimeout(() => {
    isCancelled = true;
  }, TIMEOUT_MS);
  try {
    for await (const x of sdk.someList()) {
      if (isCancelled) break;
    }
  } finally {
    clearTimeout(t);
  }
  ```

- **Cache the promise, not the value**, for any route-level data fetch hit by concurrent cold-start requests. Store the in-flight promise so the second caller awaits the same roundtrip.
- **Set TTLs based on upstream refresh cadence, not arbitrary 30s defaults.** If a Trigger.dev cron produces the data every 15 minutes, a 30-second TTL just pays the cold-start tax 30 times per cron cycle for no staleness benefit.
- **Never add a dedup CTE purely to compute a scalar count.** If the sidebar metadata task already produces that count, reuse it; if not, extend the cron rather than recomputing on every request.

## Related Issues

- Linear RJC-153 / PR #196 — the fix itself
- RJC-142 — initial scraper dashboard slowness report and LLM timeout work
- RJC-145 — recharts lazy-load to cut JS bundle on the same page
- RJC-148 — Trigger.dev task `machine` + `maxDuration` tuning that made the sidebar metadata cron reliable enough to trust as source of truth
- RJC-157 — follow-up to land Lighthouse mobile scoring on `/scraper` now that server render is fast enough to measure meaningfully
- `docs/solutions/workflow-issues/scraper-analytics-schedule-optimization-ScraperSystem-20260223.md` — prior scraper dashboard work; distinct problem (UI completeness, not load time)
