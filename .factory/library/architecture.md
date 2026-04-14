# Architecture

How the runtime-critical parts of Motian fit together for the performance mission.

**What belongs here:** system components, hot paths, data flow, invariants, and where performance work is expected to land.  
**What does not belong here:** step-by-step implementation plans or command recipes.

---

## System overview

Motian is a Next.js 16 App Router app whose core recruiter experience runs through:

- `/overzicht`
- `/vacatures`
- `/kandidaten`
- `/pipeline`
- `/scraper` (with `/databronnen` as the compatibility alias)

Those surfaces all depend on shared domain logic in `src/services/`, with vacancy search/list behavior centered in:

- `src/services/jobs.ts`
- `src/services/jobs/search.ts`
- `src/services/jobs/page-query.ts`
- `src/services/jobs/deduplication.ts`
- `src/lib/job-search-runner.ts`
- `src/lib/vacatures-search.ts`

The source of truth database is **Neon PostgreSQL**, configured through environment variables. Optional external search infrastructure may participate, but recruiter-facing behavior must continue to work when the system falls back to Postgres-backed retrieval.

## Primary runtime flows

### 1. Runtime bootstrap

`pnpm dev` -> Next.js app on `3002` -> `/api/gezondheid` -> route loading on the approved recruiter surfaces.

This mission begins by making that bootstrap path reliable again, because browser validation depends on it.

### 2. Vacancy list and search path

Browser -> `/vacatures` and vacancy APIs -> shared search runner -> `searchJobsUnified` / `searchJobsPageUnified` -> list path or hybrid-search path -> dedupe/hydration -> rendered recruiter-facing rows.

Hot spots in this flow:

- request-time settings reads
- request-time text/vector retrieval
- dedupe and count work
- vacancy page hydration
- sidebar metadata and initial list loading

Key invariant: recruiter-facing vacancy behavior must continue to work with **Neon/Postgres as the source of truth**. Optional external search infrastructure may accelerate retrieval, but workers must preserve safe fallback behavior instead of assuming external search is primary.

### 3. Dashboard, candidate, pipeline, and scraper loading

`/overzicht`, `/kandidaten`, `/pipeline`, and `/scraper` each assemble data-heavy views on top of shared services and aggregate queries. They are expected to stay behaviorally stable while reducing unnecessary runtime work.

### 4. Shell and client render path

The recruiter shell and route-specific list/detail surfaces must stay interactive while data resolves. This mission prefers existing cache, streaming, and route-budget mechanisms over introducing parallel abstractions.

## Route ownership and compatibility notes

- User-facing vacancies flow is validated on `/vacatures`, but compatibility layers and shared runners still support adjacent vacature/opdrachten search surfaces.
- User-facing scraper flow is `/scraper`, with `/databronnen` as the compatibility alias that must continue resolving into the same operational workflow.
- Workers should follow the user-facing canonical routes first, then confirm compatibility layers still map into them.

## Invariants

- Preserve Dutch routes and user-facing copy.
- Preserve canonical recruiter behavior on `/vacatures` and `/kandidaten`.
- Preserve the scraper operational workflow on `/scraper` and its `/databronnen` alias.
- Preserve compatibility search endpoints alongside canonical ones.
- Preserve recruiter workflow continuity across list -> detail -> downstream follow-up paths.
- Do not assume a local Postgres service; use the configured Neon database path.
- Treat schema and migration changes as high risk; avoid them unless explicitly justified by a feature.
- Preserve dedupe correctness; deduplication affects both latency and the recruiter-visible total/list behavior.
- Be mindful that mutation paths fan out `revalidatePath()` invalidations across list, detail, and dashboard routes, so performance fixes must not accidentally increase invalidation pressure.

## Performance-critical evidence surfaces

The mission relies on these existing measurement surfaces:

- `pnpm benchmark:hybrid-search`
- `pnpm metrics:search-path-latency`
- `pnpm metrics:search-explain`
- `pnpm perf:budget:shell`

These outputs are part of the contract surface, not just internal diagnostics.
