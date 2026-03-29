---
module: Pipeline
date: 2026-03-29
problem_type: performance_issue
component: background_job
symptoms:
  - "Vercel fluid compute costs spiked unexpectedly"
  - "GET /pipeline hitting 2+ requests per second continuously in runtime logs"
  - "Dozens of [slow-query] warnings on /vacatures/[id] pages"
  - "revalidate=30 on data-heavy pages causing frequent re-renders"
root_cause: missing_index
resolution_type: code_fix
severity: high
tags: [vercel, fluid-compute, rate-limiting, isr, revalidate, slow-query, bot-traffic, cost-optimization]
---

# Troubleshooting: Vercel Fluid Compute Cost Spike

## Problem
Vercel fluid compute costs spiked due to three compounding factors: bot traffic hammering `/pipeline` at 2+ req/s, aggressive ISR revalidation (30s) on expensive Server Component pages, and unoptimized GROUP BY queries on `/vacatures/[id]`.

## Environment
- Module: Pipeline, Vacatures, Kandidaten, Agents
- Framework: Next.js 16 + Drizzle ORM + Neon PostgreSQL
- Affected Component: `app/pipeline/page.tsx`, `app/vacatures/[id]/page.tsx`, `proxy.ts`
- Date: 2026-03-29

## Symptoms
- Vercel runtime logs showed `GET /pipeline` at 2+ req/s continuously (not organic traffic)
- Nearly every `/vacatures/[id]` request logged `[slow-query]` warnings
- `revalidate = 30` on `/pipeline`, `/kandidaten`, `/vacatures/[id]`, `/agents` meant ISR re-rendered every 30 seconds
- `endClientRows` query did a full-table GROUP BY on `coalesce(end_client, company)` for sidebar filters — no cache, no partial index

## What Didn't Work

**Attempted Solution 1:** Migrating from Trigger.dev to Vercel Cron
- **Why it failed:** Vercel cron has 800s max duration (vs unlimited on Trigger.dev), UTC-only timezone (project uses Europe/Amsterdam), and up to 1 hour timing jitter. The `scrape-pipeline` task needs 30 minutes.

## Solution

Five changes, applied in parallel:

**1. Rate limiting in proxy.ts** (bot traffic):
```typescript
// Added to proxy.ts — blocks bot UAs and rate-limits to 10 req/10s per IP
function rateLimitPipeline(request: NextRequest): NextResponse | null {
  if (isBotUA(request.headers.get("user-agent"))) {
    return new NextResponse("Too Many Requests", { status: 429 });
  }
  // ... IP-based sliding window rate limiter
}
```

**2. ISR revalidation bumped 30s → 120s** on 4 pages:
- `app/pipeline/page.tsx`
- `app/kandidaten/page.tsx`
- `app/vacatures/[id]/page.tsx`
- `app/agents/page.tsx`

**3. Cached endClient query** with `unstable_cache` (5 min TTL):
```typescript
const getCachedEndClients = unstable_cache(
  async () => { /* GROUP BY query */ },
  ["end-client-filter-options"],
  { revalidate: 300 }
);
```

**4. Added partial index** for visibility + end client lookups:
```typescript
openActiveEndClientIdx: index("idx_jobs_visible_end_client")
  .on(table.status, table.endClient, table.company)
  .where(sql`deleted_at IS NULL AND status <> 'archived'`)
```

**5. Reduced cron frequencies:**
- `sidebar-metadata-refresh`: 5min → 15min
- `agent-orchestrator`: eliminated as primary dispatcher (see related issue)

## Why This Works

1. **Bot traffic** was the biggest single cost driver — 2 req/s × 86,400s/day = 172,800 unnecessary invocations/day. Rate limiting blocks this.
2. **ISR at 30s** meant each unique page visitor triggered a full Server Component re-render (with DB queries) every 30 seconds. At 120s, that's 4x fewer renders.
3. **The endClient GROUP BY** scanned all visible jobs on every `/vacatures/[id]` load. Caching it for 5 minutes means it runs ~288x/day instead of thousands.
4. **The partial index** helps the GROUP BY planner avoid a sequential scan when the cache misses.

## Prevention

- Set `revalidate` based on data change frequency, not UI freshness expectations. Recruitment data changes minutes-to-hours, not seconds.
- Add rate limiting to any page that serves as a dashboard (bots love crawling dashboards)
- Cache expensive aggregation queries (GROUP BY, COUNT, DISTINCT) that don't change per-request
- Monitor Vercel runtime logs for traffic patterns before assuming costs are from features
- Next.js 16 uses `proxy.ts` not `middleware.ts` — cannot have both

## Related Issues

- See also: [orchestrator-polling-to-event-driven-AgentSystem-20260329.md](../workflow-issues/orchestrator-polling-to-event-driven-AgentSystem-20260329.md) — related cron frequency reduction
