---
module: Platform
date: 2026-04-14
problem_type: performance_audit
component: full_stack
symptoms:
  - "End-to-end performance audit requested"
  - "Identify highest-ROI optimizations across Trigger.dev, search, DB, and app layer"
root_cause: architecture_review
resolution_type: audit_and_optimization
severity: medium
tags: [performance, trigger-dev, search, database, react, audit, optimization]
---

# Full-Stack Performance Audit — Motian Recruitment Platform

## See also (implementation docs)

This audit is the diagnostic layer. The concrete fixes it informs live in
dedicated docs — prefer those for the "how" and use this one for the "why":

- `docs/solutions/performance-issues/scraper-dashboard-cold-start-17s-to-1s-2026-04-16.md`
  — implementation of the dashboard cold-start fix (PR #196 / RJC-153).
- `docs/solutions/best-practices/neon-serverless-driver-vercel-2026-04-10.md`
  — the Neon pool config (`max: 1`, `DATABASE_URL_UNPOOLED`) referenced
  throughout this audit.
- `docs/solutions/performance-issues/vercel-fluid-compute-spike-Pipeline-20260329.md`
  — rate-limiting and ISR tuning called out in sections 3 and 8 below.

## Executive Summary

Comprehensive audit of the Motian recruitment platform across four layers: Trigger.dev
background jobs, hybrid search architecture, database schema/queries, and app-layer
rendering performance. The platform is architecturally sound with good patterns already
in place. This audit identifies concrete optimization opportunities ordered by ROI.

**Overall assessment: The stack is well-structured.** The biggest wins come from
incremental improvements, not architectural changes.

---

## 1. Trigger.dev Audit

### Inventory: 20 Tasks

| Category | Tasks | Schedule |
|----------|-------|----------|
| Agent Workflow | agent-intake, agent-matcher, agent-communicator, agent-scheduler, agent-sourcing, agent-orchestrator | Event-driven + 12h fallback |
| CV & Analysis | cv-analysis-pipeline, ai-enrichment-batch | On-demand + 4x daily |
| Scraping | scrape-pipeline, platform-onboard, scraper-health | 4x daily + daily + on-demand |
| Maintenance | nightly-maintenance, cache-refresh, daily-kpi-snapshot, daily-platform-sync | Daily/post-scrape |
| Utility | embeddings-batch, defer-embedding-sync, candidate-dedup, match-staleness, slack-notifications | Periodic + on-demand |

### Findings

**Positive patterns already in place:**
- Event-driven dispatch with inline triggering (zero-delay, orchestrator is fallback only)
- Fire-and-forget for non-blocking operations
- Circuit breaker on scrape pipeline
- Sentry integration for all task failures
- PII-safe logging (payload keys only)

**Idempotency coverage:**
- CV analysis: Uses `cv-${fileHash}-pipeline` idempotency key (good)
- All other tasks: No explicit idempotency keys
- Risk: Low for scheduled tasks (cron prevents duplicates), but event-driven agent
  tasks (matcher, communicator) could theoretically process duplicate events

**Recommendations:**
1. Add idempotency keys to `agent-matcher` (`match-${candidateId}-${jobId}-v${version}`)
2. Add idempotency keys to `agent-communicator` (`comm-${channel}-${matchId}-${template}`)
3. Consider Trigger.dev queue concurrency limits for embedding tasks to prevent
   OpenAI rate limit exhaustion under burst load
4. The scrape-pipeline 1800s max duration is acceptable for Firecrawl fallback but
   should be monitored — consider splitting werkzoeken scraping into its own task

---

## 2. Search Architecture Audit

### Architecture: 3-Layer Hybrid Search + Vector

```text
Layer 1: Typesense (multi-word queries, fast fuzzy)
Layer 2: PostgreSQL FTS (single-word, GIN-indexed tsvector)
Layer 3: PostgreSQL ILIKE (fallback, trigram-indexed)
+ Optional: pgvector cosine similarity (512-dim OpenAI embeddings)
→ Combined via Reciprocal Rank Fusion (RRF, K=60)
```

### Findings

**Positive patterns:**
- SLO tracking: 800ms for search, 500ms for list operations
- Query embedding cache: 256-entry LRU, 5-minute TTL
- Deduplication materialized in `jobDedupeRanks` table (avoids window functions)
- Hydration modes: mini-selection for ranking, full selection only for page results
- Observability: textSearchMs, embeddingMs, vectorSearchMs, rrfMs, hydrateMs tracked
- Pre-fetch cap at 500 rows bounds CPU on window functions

**Projection tables already exist:**
- `sidebarMetadata` — precomputed facet data (platforms, clients, categories, skills)
- `jobDedupeRanks` — materialized deduplication rankings with freshness tracking

**Bottleneck: OpenAI embedding latency (~900ms per uncached query)**
- Mitigation already in place: 5-min cache, single-word queries skip vector search
- Further mitigation: Pre-warm top-10 query embeddings after cache-refresh

**Recommendations:**
1. Consider HNSW index on pgvector columns for faster ANN search at scale
2. The vector min score threshold (0.3) is appropriate — monitor for precision
3. Search is well-optimized; focus effort elsewhere

---

## 3. Database Audit

### Schema: 31 Tables, 60+ Indexes

**Index coverage: EXCELLENT**
- Jobs table: 21 indexes including 3 partial/conditional indexes for hot paths
- GIN indexes for full-text search (tsvector) and fuzzy matching (gin_trgm_ops)
- Composite indexes for common filter combinations (status+platform, status+province)
- Auto-maintained tsvector via trigger

**Pagination: MIXED**
- Offset-based: Most list queries (candidates, jobs, matches, applications)
- Cursor-based: Chat sessions only (keyset pagination with compound cursor)
- Risk: Offset pagination degrades on high page numbers for large tables

**N+1 Prevention: GOOD**
- Pipeline counts use grouped subquery + LEFT JOIN (single query for 100 jobs)
- Batch operations use `inArray()` consistently
- Hydration after dedup uses single `loadJobPageRowsByIds()` query
- Batch embedding updates use VALUES syntax (not per-row)

**Connection pooling: CORRECT**
- Neon serverless pool with `max: 1` per Lambda invocation
- 5s connection timeout
- Pool metrics tracked every 60s

**Recommendations:**
1. Migrate high-traffic list endpoints from offset to cursor-based pagination
2. Add HNSW index for pgvector if candidate/job table exceeds 100K rows
3. Monitor `idx_agent_events_pending_type` usage via EXPLAIN ANALYZE
4. Consider adding composite index `(candidateId, status)` on jobMatches for
   candidate detail pages that filter by match status

---

## 4. App-Layer Audit

### TanStack Query: Well-configured
- Global: staleTime=5min, gcTime=10min, refetchOnWindowFocus=false
- Sidebar filters: staleTime=30s with placeholderData for smooth pagination
- Query keys: Well-structured with entity+ID dependencies

### Virtualization: Selective, threshold-based
- Job list: Virtualized at >18 items (112px compact / 252px overview)
- Candidate list: Mobile-only virtualization at >18 items
- Chat messages: Virtualized at >50 messages
- All use ResizeObserver + measureElement for accurate sizing

### API Payloads: Minimal by default
- Raw CV text: Never in list responses
- rawPayload: Only from `/api/vacatures/[id]/raw` (inspector UI)
- Field projections used consistently
- Cache-Control headers appropriate per endpoint

### Caching: Tiered strategy
- Page-level: revalidate=60-300s depending on data volatility
- Function-level: unstable_cache with tag-based revalidation
- HTTP-level: s-maxage + stale-while-revalidate for public endpoints

### Findings identified (addressed in this PR — see Section 5):

**1. Sequential queries in match-kandidaten endpoint**
- File: `app/api/vacatures/[id]/match-kandidaten/route.ts`
- `autoMatchJobToCandidates()` and `listApplications()` run sequentially
- Fix: Parallelize with `Promise.all()`

**2. Missing React.memo on list item components**
- `CandidateResultCard` in `components/candidate-results-list.tsx`
- `JobListItem` in `components/job-list-item.tsx`
- `ChatMessageItem` in `components/chat/chat-messages.tsx`
- Impact: Prevents unnecessary re-renders when parent list updates
- Note: Mitigated by virtualization (only visible items render), but still valuable

---

## 5. Implemented Optimizations

### 5a. Parallelized match-kandidaten API (Priority: HIGH)

**Before:** Sequential — `autoMatchJobToCandidates` completes before `listApplications` starts
**After:** Parallel — both queries run concurrently via `Promise.all()`
**Expected impact:** ~30-50% latency reduction on this endpoint

### 5b. React.memo on CandidateResultCard (Priority: MEDIUM)

Wrapped with `React.memo` to prevent re-renders when parent list updates but
individual card props haven't changed.

### 5c. React.memo on JobListItem (Priority: MEDIUM)

Wrapped with `React.memo` to prevent re-renders in sidebar job list scrolling.

### 5d. React.memo on ChatMessageItem (Priority: LOW)

Wrapped with `React.memo` to prevent re-renders during chat streaming when
only the latest message changes.

---

## 6. Architecture Validation

### Current Stack Assessment

| Layer | Technology | Status | Notes |
|-------|-----------|--------|-------|
| Framework | Next.js 16 | Optimal | SSR + streaming + ISR well-utilized |
| ORM | Drizzle on Neon | Optimal | Type-safe, good projection patterns |
| Background | Trigger.dev v4 | Optimal | 20 tasks, event-driven, well-structured |
| Search | Typesense + pgvector | Optimal | 3-layer hybrid with RRF |
| State | TanStack Query | Optimal | Conservative staleness, good keys |
| Rendering | react-virtual | Good | Selective virtualization |
| Monitoring | Sentry + PostHog + Speed Insights | Excellent | SLO tracking, web vitals |

### Convex Migration Assessment: NOT RECOMMENDED NOW

The current architecture handles the recruitment domain well:
- Source of truth: Neon PostgreSQL with Drizzle ORM
- Background compute: Trigger.dev with event-driven dispatch
- Search: Sophisticated hybrid strategy with SLO tracking
- Read models: sidebarMetadata + jobDedupeRanks already materialized

**When to reconsider Convex:** Only if profiling reveals pain in:
- Multi-user realtime pipeline state synchronization
- Live updates between concurrent recruiters
- Complex client-state invalidation across browser tabs

---

## 7. Prioritized Recommendations (Not Yet Implemented)

### Priority 1 — Short-term (this sprint)
1. Add idempotency keys to agent-matcher and agent-communicator tasks
2. Pre-warm top-10 query embeddings in cache-refresh task
3. Add Trigger.dev queue concurrency limits for embedding tasks

### Priority 2 — Medium-term (next 2 sprints)
4. Migrate candidate list pagination from offset to cursor-based
5. Add HNSW index on jobs.embedding and candidates.embedding
6. Create `candidate_match_projection` table for candidate detail pages
7. Split werkzoeken Firecrawl scraping into dedicated task

### Priority 3 — Long-term (backlog)
8. Add composite index `(candidateId, status)` on jobMatches
9. Implement TanStack Query prefetching on sidebar hover
10. Evaluate search result pre-computation for high-frequency queries

---

## 8. Monitoring Checklist

Post-deployment, verify these metrics:
- [ ] match-kandidaten p95 latency decreased
- [ ] No new Biome lint errors
- [ ] TypeScript compilation clean
- [ ] Existing tests pass
- [ ] Web Vitals (INP) unchanged or improved on list pages
