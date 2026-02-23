---
module: Scraper System
date: 2026-02-23
problem_type: workflow_issue
component: background_job
symptoms:
  - "No scraper analytics dashboard — run history visible only in raw DB table"
  - "Scrape frequency set to hourly but only needed every 4 hours"
  - "Redundant files from incomplete Vercel-to-Trigger.dev migration"
root_cause: missing_workflow_step
resolution_type: workflow_improvement
severity: medium
tags: [scraper, analytics, trigger-dev, cron, dashboard, migration-cleanup]
---

# Troubleshooting: Scraper Analytics Dashboard & Schedule Optimization

## Problem
The Motian scraper system had no visual analytics for scrape runs — all data lived in the `scrape_results` DB table with no UI to surface success rates, job counts, or platform health. Additionally, the cron schedule ran hourly when 4-hourly was sufficient, and redundant files from the Vercel-to-Trigger.dev migration cluttered the codebase.

## Environment
- Module: Scraper System
- Framework: Next.js 16 + Trigger.dev v4 + Drizzle ORM
- Affected Component: `trigger/scrape-pipeline.ts`, `app/scraper/page.tsx`, `src/services/scrape-results.ts`
- Date: 2026-02-23

## Symptoms
- No scraper analytics dashboard — run history visible only in raw database table via `app/scraper/page.tsx` which showed a flat history list with no summary stats
- Scrape frequency set to `0 * * * *` (hourly) via Trigger.dev cron but business need was only every 4 hours
- Dead Vercel Cron API routes (`app/api/cron/scrape/route.ts`, `app/api/cron/data-retention/route.ts`, `app/api/cron/vacancy-expiry/route.ts`) still in codebase after migration to Trigger.dev
- Duplicate trigger task files in both `src/trigger/` and `trigger/` directories

## What Didn't Work

**Direct solution:** The problems were identified through codebase analysis and fixed systematically.

## Solution

### 1. Schedule Change (`trigger/scrape-pipeline.ts:47`)

```typescript
// Before:
cron: {
  pattern: "0 * * * *", // Every hour
  timezone: "Europe/Amsterdam",
},

// After:
cron: {
  pattern: "0 */4 * * *", // Every 4 hours
  timezone: "Europe/Amsterdam",
},
```

### 2. Analytics Service (`src/services/scrape-results.ts`)

Added `getAnalytics()` function that computes per-platform stats using PostgreSQL `FILTER` clauses:

```typescript
export async function getAnalytics(): Promise<ScrapeAnalytics> {
  const rows = await db
    .select({
      platform: scrapeResults.platform,
      totalRuns: sql<number>`count(*)::int`,
      successCount: sql<number>`count(*) filter (where ${scrapeResults.status} = 'success')::int`,
      failedCount: sql<number>`count(*) filter (where ${scrapeResults.status} = 'failed')::int`,
      totalJobsFound: sql<number>`coalesce(sum(${scrapeResults.jobsFound}), 0)::int`,
      totalJobsNew: sql<number>`coalesce(sum(${scrapeResults.jobsNew}), 0)::int`,
      // ... more aggregates
    })
    .from(scrapeResults)
    .groupBy(scrapeResults.platform);
  // Returns per-platform stats + overall totals
}
```

### 3. Enhanced Scraper Page (`app/scraper/page.tsx`)

- Added 6 KPI summary cards: total runs, jobs found, new, duplicates, success rate, avg duration
- Added per-platform analytics cards with success rate progress bars, stats grids, circuit breaker indicators
- Promoted "Scraper Analytics" to top-level sidebar nav item

### 4. Cleanup

```bash
# Removed dead Vercel Cron routes
git rm app/api/cron/scrape/route.ts
git rm app/api/cron/data-retention/route.ts
git rm app/api/cron/vacancy-expiry/route.ts

# Removed duplicate trigger files
rm src/trigger/scrape-pipeline.ts
rm src/trigger/data-retention.ts
rm src/trigger/vacancy-expiry.ts
```

## Why This Works

1. **PostgreSQL FILTER clause** — Computing conditional aggregates (`count(*) filter (where ...)`) in a single `GROUP BY` query is far more efficient than fetching all rows and computing in JavaScript. As `scrape_results` grows, this scales without code changes.

2. **Unified cron with per-platform isDue()** — The 4-hour Trigger.dev cron fires once, but each platform's individual `cronExpression` in the DB is still respected via `isDue()`. This acts as a scheduler multiplexer — a single cron trigger evaluates all platforms independently.

3. **Cleanup matters** — Dead Vercel Cron routes could confuse developers into thinking those routes were still active. The duplicate `src/trigger/` directory (vs canonical `trigger/`) caused Trigger.dev to potentially compile tasks from the wrong location.

## Prevention

- When migrating from one scheduler to another (e.g., Vercel Cron → Trigger.dev), delete the old routes immediately — don't leave them as "fallback"
- Always check for duplicate directories when `trigger.config.ts` specifies `dirs: ["./trigger"]` — files in `src/trigger/` are NOT compiled by Trigger.dev
- When adding background jobs, also add an analytics/monitoring UI from the start — it's much harder to retrofit observability later
- Prefer DB-level aggregation (SQL `GROUP BY` + `FILTER`) over application-level computation for analytics queries

## Related Issues

No related issues documented yet.
