---
date: 2026-04-09
topic: speed-performance-mobile-first
focus: "speed and performance, mobile-first UI, check recent plan implementation status"
---

# Ideation: Speed, Performance & Mobile-First UI

## Codebase Context

- **Project:** Motian — Dutch-language Next.js 16 recruitment platform on Vercel
- **Stack:** Neon PostgreSQL + Drizzle ORM + pgvector + Typesense, Vercel AI SDK, LiveKit voice agent
- **Three agent surfaces** (chat, MCP, voice) share `src/services/` — improvements there ripple everywhere
- **Performance plan (Apr 2):** 7 units, 5 DONE, 2 PARTIAL (embedding sync blocks writes, no debounced refresh)
- **Mobile work (Apr 7 weekly):** bottom nav, safe-area, virtualized sidebar shipped; list virtualization, image/font opt, bundle analysis NOT done
- **Unified UI/UX plan (Mar 28):** navigation simplification 11→5 items — NOT IMPLEMENTED
- **Recruiter scorecards (Apr 5):** match briefs + pipeline health — NOT SHIPPED
- **Institutional learnings:** ISR 120s baseline, force-dynamic + Cache-Control for API routes, never headers()/cookies() in root layout, all request interception in proxy.ts
- **Zero documented work on:** Core Web Vitals, bundle analysis, image optimization, font subsetting, real-device mobile testing

## Ranked Ideas

### 1. Async Embedding Pipeline — Decouple Writes from Vector Generation
**Description:** Move embedding generation + Typesense sync into Trigger.dev v4 background tasks. Return immediately from create/update with `embeddingStatus: 'pending'`.
**Rationale:** #1 user-facing latency bottleneck. Blocks every write path across all three agent surfaces. Deferring cuts perceived write latency by 60-80%.
**Downsides:** Brief window where new records aren't vector-searchable. Needs UI indicator.
**Confidence:** 90%
**Complexity:** Medium
**Status:** Unexplored
**Linear:** RJC-61 (Urgent)

### 2. Debounced DataRefreshListener + Optimistic UI
**Description:** Centralized SSE listener with 500ms debounce + optimistic state updates for mobile interactions.
**Rationale:** Eliminates refresh storms causing jank. Optimistic updates make mobile feel native-fast.
**Downsides:** Optimistic rollback on errors needs careful handling.
**Confidence:** 85%
**Complexity:** Medium
**Status:** Unexplored
**Linear:** RJC-62 (High)

### 3. Lazy Typesense Bootstrap — Off the Hot Path
**Description:** Remove `ensureTypesenseCollection()` from write/search paths. Bootstrap at deploy time only.
**Rationale:** Zero-cost win. Removes unnecessary network round-trip from every operation.
**Downsides:** Needs graceful fallback if collection doesn't exist.
**Confidence:** 95%
**Complexity:** Low
**Status:** Unexplored
**Linear:** RJC-63 (High)

### 4. Complete List Virtualization — Shared VirtualList Primitive
**Description:** Reusable `<VirtualList>` component (TanStack Virtual) for kandidaten, vacatures, and chat history.
**Rationale:** Explicitly flagged as "next priority" in Apr 7 weekly. Prevents DOM bloat on mobile.
**Downsides:** Row height estimation with variable-height cards.
**Confidence:** 85%
**Complexity:** Medium
**Status:** Unexplored
**Linear:** RJC-64 (Medium)

### 5. Mobile-First GenUI Cards + Chunked Loading
**Description:** Redesign 16 GenUI components for mobile: stacked cards, 44px touch targets, collapsible details. Group top 5 into eager chunk.
**Rationale:** Chat is primary mobile interaction. Currently untested on mobile.
**Downsides:** Requires usage analytics or heuristic for chunking decisions.
**Confidence:** 75%
**Complexity:** Medium
**Status:** Unexplored
**Linear:** RJC-65 (Medium)

### 6. Image/Font Optimization Pass
**Description:** next/font/google with Dutch subsetting + next/image for all photos/logos.
**Rationale:** Table-stakes Next.js features currently missing. Biggest LCP contributor on mobile.
**Downsides:** Dynamic scraped image URLs need loader audit.
**Confidence:** 90%
**Complexity:** Low
**Status:** Unexplored
**Linear:** RJC-66 (Medium)

### 7. CWV Instrumentation + Bundle Analysis + Lighthouse CI Gate
**Description:** web-vitals reporting, @next/bundle-analyzer, Lighthouse CI with mobile profile on 5 core routes.
**Rationale:** "Cannot improve what you do not measure." Creates accountability ratchet.
**Downsides:** CI pipeline adds ~2-3 min.
**Confidence:** 90%
**Complexity:** Low-Medium
**Status:** Unexplored
**Linear:** RJC-67 (High)

### 8. Ship 5-Item Navigation Simplification
**Description:** Collapse 11 sidebar items to 5 primary. Mobile bottom nav mirrors 5 tabs. "Meer" overflow for secondary.
**Rationale:** Planned Mar 28, never shipped. 11 items hostile on mobile.
**Downsides:** Users learn new nav; command palette as escape hatch.
**Confidence:** 80%
**Complexity:** Medium
**Status:** Unexplored
**Linear:** RJC-68 (Medium)

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | Per-Route ISR TTLs | Marginal gain over 120s baseline; config sprawl risk |
| 2 | Offline Service Worker | Too expensive for current stage; data is server-authoritative |
| 3 | Touchstart Prefetch | Too narrow; Next.js Link already prefetches on viewport |
| 4 | Streaming Suspense Refactor | Deep refactor; caching achieves similar perceived speed cheaper |
| 5 | Background Auto-Match Notify | Overlaps async embedding + existing scorecards plan |
| 6 | Edge Rate Limiting + Geo-Routing | Over-engineered for Dutch-only user base |
| 7 | Kill ISR → Webhook Revalidation | Operational complexity outweighs freshness gain |
| 8 | Collapse Typesense → pgvector Only | Loses faceted search, autocomplete, typo tolerance |
| 9 | Dedicated Mobile PWA Shell | Too expensive vs responsive improvements to existing shell |
| 10 | Neon Connection Pooling + Read Replicas | No evidence of connection saturation |
| 11 | Split Service Layer Read/Write | Over-design; service-layer caching achieves same speed win |
| 12 | Offline IndexedDB Pipeline | Same as offline service worker |
| 13 | Edge + KV Rate Limiting | In-memory works at current scale |
| 14 | Speculative Prefetch | Hard to maintain prediction accuracy |
| 15 | Runtime Cache API | Beta; service-layer caching more stable |
| 16 | Edge Config Feature Flags | Adds dependency; nav simplification should just ship |
| 17 | Service-layer revalidateTag Caching | Strong but merged conceptually into async embedding pattern |

## Session Log
- 2026-04-09: Initial ideation — 38 generated across 4 parallel agents, deduped to 25, 8 survived adversarial filtering. All 8 created as Linear tickets (RJC-61 through RJC-68) in Todo state.
