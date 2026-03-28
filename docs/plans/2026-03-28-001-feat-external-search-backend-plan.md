---
date: 2026-03-28
topic: external-search-backend
depth: deep
---

# External Search Backend Plan

## Problem Frame

Motian already has a solid PostgreSQL search core:

- Vacatures use full-text search plus pgvector hybrid retrieval and RRF in [`src/services/jobs/search.ts`](src/services/jobs/search.ts)
- Paginated vacature search uses the same contract in [`src/services/jobs/page-query.ts`](src/services/jobs/page-query.ts)
- Kandidaten search is still database-bound in [`src/services/candidates.ts`](src/services/candidates.ts)

The new request is to add an external search engine. The goal is not to rewrite every search caller, but to introduce an optional backend that improves text retrieval speed, typo tolerance, and future extensibility while preserving existing API/UI/AI/CLI contracts and keeping Postgres as the source of truth.

## Requirements Traceability

- R1. Add an external search backend, evaluating Typesense, Meilisearch, and OpenSearch.
- R2. Keep existing public search contracts stable for vacatures and kandidaten.
- R3. Preserve the current vacature hybrid-search direction instead of regressing to text-only relevance.
- R4. Make the rollout optional and env-gated, with safe fallback to the current PostgreSQL implementation.
- R5. Keep indexing synchronized from existing write paths rather than duplicating business logic across routes.
- R6. Provide a one-shot backfill/reindex path so a fresh environment can build the search index from the database.

## Decision Summary

### Chosen Direction: Typesense

Typesense is the best fit for this repository because it supports the same operational primitives we need immediately and aligns with the platform’s existing hybrid-search trajectory:

- Filtering, faceting, sorting, and both page-based and offset-based pagination are first-class in the search API.
- Vector search is built in, which keeps the door open to moving more of vacature hybrid retrieval out of PostgreSQL later without changing providers.
- The schema-first model fits the typed filter surface already centralized in `opdrachten-filters`.
- It is materially lighter to operate than OpenSearch for this repository size and deployment posture.

### Rejected For Initial Rollout: Meilisearch

Meilisearch is a reasonable fallback option for instant text search, but it is less attractive here because:

- The immediate value would mostly be text retrieval, while the repo already depends on embeddings and hybrid ranking for vacatures.
- Its upgrade path is more stateful and version-coupled, which increases operational footguns for a repo that does not currently run separate search infrastructure.

### Rejected For Initial Rollout: OpenSearch

OpenSearch is not the right initial choice unless the team already operates it elsewhere. It can support hybrid and vector search, but the official setup requires materially more infrastructure and configuration:

- Search pipelines for hybrid ranking
- Vector index mappings and k-NN configuration
- Heavier Docker/system settings and security setup

That operational weight is not justified for this codebase’s current scale.

## External Research Notes

- **Typesense official docs:** search supports `filter_by`, `sort_by`, faceting, grouping, caching, and both `page/per_page` and `offset/limit`. Vector search is available in the API docs, which keeps future hybrid migration viable.
- **Meilisearch official docs:** index settings and upgrades are straightforward to use but require more care because database compatibility is version-specific and some upgrades rely on dumps or explicit migration steps.
- **OpenSearch official docs:** current hybrid search uses a dedicated `hybrid` query and search pipeline; official setup docs show substantially heavier operational setup for Docker and vector/hybrid indexing.
- **Deprecation check:** as of Saturday, March 28, 2026, I found no official deprecation or sunset notice for Typesense, Meilisearch, or OpenSearch themselves. The decision is therefore based on implementation fit and operational weight, not sunset risk.

## Existing Patterns To Preserve

- [`src/services/jobs.ts`](src/services/jobs.ts) is the stable barrel for every vacature search surface.
- [`src/lib/job-search-runner.ts`](src/lib/job-search-runner.ts) and [`src/lib/vacatures-search.ts`](src/lib/vacatures-search.ts) already centralize URL/query parsing.
- Vacature callers across API, AI tools, MCP, voice, and CLI already route through `searchJobsUnified()` or `searchJobsPageUnified()`.
- Candidate callers across API, AI tools, MCP, voice, and CLI already route through `searchCandidates()` / `listCandidates()`.
- Normalization and enrichment already define the durable write seams:
  - [`src/services/normalize.ts`](src/services/normalize.ts)
  - [`src/services/jobs/repository.ts`](src/services/jobs/repository.ts)
  - [`src/services/candidates.ts`](src/services/candidates.ts)
  - [`src/services/embedding.ts`](src/services/embedding.ts)

## High-Level Technical Design

Introduce an optional Typesense-backed text retrieval layer behind a small search-index abstraction. The new backend will not become the source of truth; it will only produce ranked IDs and totals. Hydration, canonical skill enrichment, and existing domain logic will remain in PostgreSQL.

### Search Read Path

For vacatures:

1. Keep `searchJobsUnified()` and `searchJobsPageUnified()` as the public contract.
2. When Typesense is not configured, preserve the current PostgreSQL code path exactly.
3. When Typesense is configured:
   - Use Typesense for the text-retrieval branch of vacature search.
   - Keep the existing embedding/vector branch in PostgreSQL for the initial rollout.
   - Fuse Typesense text IDs with pgvector IDs using the current RRF-style ranking flow.
   - Hydrate final rows from PostgreSQL so downstream code sees the same job shape.

For kandidaten:

1. Keep `searchCandidates()` and `countCandidates()` as the public contract.
2. When Typesense is configured:
   - Use Typesense as the ranked retrieval source for text filters.
   - Hydrate candidates from PostgreSQL by ID.
3. When Typesense is unavailable or queryless list mode is used, preserve the current database path.

### Search Write Path

Add a Typesense sync layer that mirrors document state from existing write seams:

- `normalizeAndSaveJobs()` after upsert batches
- `updateJob()`
- `updateJobEnrichment()`
- `deleteJob()`
- `createCandidate()`
- `updateCandidate()`
- `deleteCandidate()`
- `enrichCandidateFromCV()`

The initial rollout does not need transactional dual-write guarantees across PostgreSQL and Typesense. Instead:

- Database write remains authoritative
- Typesense sync is best-effort but awaited when the write path already does non-trivial async work
- A reindex script and scheduled embedding backfill keep the index recoverable

### Index Shape

Create two collections:

- `jobs`
- `candidates`

Each document should include:

- stable `id`
- searchable text fields
- filterable fields used by current query surfaces
- sortable timestamps and numeric values
- soft-delete visibility flags so deleted rows can be removed or excluded

For jobs, do **not** move vector retrieval to Typesense in the first implementation. The collection shape should still leave room for a future `embedding` field, but search behavior remains text-in-Typesense plus vector-in-Postgres for rollout safety.

## Alternative Approaches Considered

- **Full Typesense replacement for vacature search in phase 1**
  - Rejected for now because it would couple provider rollout to relevance changes, vector migration, and new failure modes all at once.
- **Meilisearch as text-only engine for both vacatures and kandidaten**
  - Viable, but weaker long-term alignment with the repo’s existing embedding-heavy direction.
- **OpenSearch as unified search platform**
  - Technically capable, but too operationally heavy for the current repository unless the team already runs a managed OpenSearch estate.
- **No external engine; keep PostgreSQL only**
  - Safest operationally, but it does not satisfy the request and leaves candidate search and instant retrieval headroom limited to the database path.

## Implementation Units

### 1. Add Typesense client, config, and document mappers

- [ ] Add the `typesense` dependency in [`package.json`](package.json)
- [ ] Add env docs for:
  - `TYPESENSE_URL`
  - `TYPESENSE_API_KEY`
  - `TYPESENSE_JOBS_COLLECTION`
  - `TYPESENSE_CANDIDATES_COLLECTION`
  in [`.env.example`](.env.example)
- [ ] Create a small Typesense client/config module, for example:
  - [`src/lib/typesense.ts`](src/lib/typesense.ts)
- [ ] Create document mapping helpers, for example:
  - [`src/services/search-index/typesense-documents.ts`](src/services/search-index/typesense-documents.ts)
- [ ] Create collection bootstrap helpers, for example:
  - [`src/services/search-index/typesense-schema.ts`](src/services/search-index/typesense-schema.ts)

**Technical design notes**

- Keep collection names configurable for previews and shared environments.
- Normalize optional arrays and nullable values into Typesense-friendly shapes.
- Store only fields needed for ranking/filtering/hydration, not raw payload blobs.

### 2. Add search-index sync service

- [ ] Create a sync module, for example:
  - [`src/services/search-index/typesense-sync.ts`](src/services/search-index/typesense-sync.ts)
- [ ] Expose operations such as:
  - `ensureCollections()`
  - `upsertJobsByIds(ids)`
  - `deleteJobsByIds(ids)`
  - `upsertCandidatesByIds(ids)`
  - `deleteCandidatesByIds(ids)`

**Technical design notes**

- Sync helpers should load authoritative rows from PostgreSQL and then map them into index documents.
- Missing/deleted rows should become delete operations in Typesense.
- This module should absorb Typesense-specific API details so the rest of the codebase stays provider-agnostic.

### 3. Wire job writes into index sync

- [ ] Update [`src/services/normalize.ts`](src/services/normalize.ts) so successful upsert batches trigger `upsertJobsByIds()`
- [ ] Update [`src/services/jobs/repository.ts`](src/services/jobs/repository.ts):
  - `updateJob()` → reindex changed job
  - `updateJobEnrichment()` → reindex changed job
  - `deleteJob()` → delete or tombstone the job in Typesense

**Execution note**

Treat this as characterization-first work: preserve current job write behavior and only add index side effects after tests prove existing behavior is unchanged.

### 4. Wire candidate writes into index sync

- [ ] Update [`src/services/candidates.ts`](src/services/candidates.ts):
  - `createCandidate()`
  - `updateCandidate()`
  - `deleteCandidate()`
  - `enrichCandidateFromCV()`
- [ ] Keep ESCO sync and embedding refresh ordering intact; add Typesense sync without losing either side effect

### 5. Add Typesense-backed vacature text retrieval

- [ ] Create a search adapter, for example:
  - [`src/services/search-index/typesense-search.ts`](src/services/search-index/typesense-search.ts)
- [ ] Update [`src/services/jobs/search.ts`](src/services/jobs/search.ts) so the text branch can use Typesense retrieval when configured
- [ ] Update [`src/services/jobs/page-query.ts`](src/services/jobs/page-query.ts) so paginated search uses the same adapter

**Technical design notes**

- Build `filter_by` from the same normalized options currently used by `buildJobFilterConditions()`
- Preserve current short-query policy from `getHybridSearchPolicy()`
- Keep the current vector retrieval branch in PostgreSQL for rollout safety
- Preserve RRF behavior and public totals contract as closely as possible

### 6. Add Typesense-backed kandidaat retrieval

- [ ] Update [`src/services/candidates.ts`](src/services/candidates.ts) so `searchCandidates()` and `countCandidates()` can use Typesense when configured

**Technical design notes**

- Use Typesense only when a search/filter query exists
- Preserve `listCandidates()` as the DB-backed default listing path
- Hydrate results through PostgreSQL to preserve row shape and soft-delete rules

### 7. Add rollout and recovery tooling

- [ ] Add a one-shot reindex script, for example:
  - [`scripts/reindex-typesense.ts`](scripts/reindex-typesense.ts)
- [ ] Add a package script entry such as `search:reindex`
- [ ] Ensure the script can:
  - create collections if missing
  - page through jobs and candidates
  - rebuild the entire external index from PostgreSQL

### 8. Documentation and ops notes

- [ ] Update [README.md](README.md) with a short “external search” section
- [ ] Document that Typesense is optional and PostgreSQL remains the fallback
- [ ] Document the initial reindex step for a new environment

## System-Wide Impact

- **Frontend/API routes:** no public route contract should change because vacature and kandidaat routes already go through shared runners and services.
- **AI chat tools:** vacature and kandidaat query tools inherit the new backend automatically if `searchJobsUnified()` and `searchCandidates()` stay stable.
- **MCP tools:** same benefit as AI tools; no direct provider-specific logic should leak into tool implementations.
- **Voice agent:** inherits the same search behavior through shared service imports, so parity risk is low if the service contracts stay unchanged.
- **CLI:** search output ordering may improve automatically; CLI code should not need provider-specific branching.
- **Background jobs:** `normalize`, enrichment-related job updates, and candidate embedding refresh paths become indexing seams and therefore need explicit sync coverage.

## Success Metrics

- Search behavior remains contract-compatible across API, UI, AI, MCP, voice, and CLI surfaces.
- With Typesense disabled, all current tests and behavior stay unchanged.
- With Typesense enabled, vacature and kandidaat query paths return stable totals, offsets, and hydration shapes.
- Index rebuild from PostgreSQL succeeds on a clean environment without manual document crafting.
- A transient Typesense outage degrades to PostgreSQL search instead of failing user-visible surfaces.

## Phased Delivery

### Phase 1: Provider foundation

- Add dependency, config, schema bootstrap, document mappers, and sync helpers.
- Add reindex script.
- Add provider-focused tests before changing read paths.

### Phase 2: Write-path indexing

- Wire jobs and candidates write seams into sync helpers.
- Preserve existing ESCO and embedding side effects.
- Verify fallback-safe behavior with sync mocked or disabled.

### Phase 3: Read-path adoption

- Switch vacature text retrieval to Typesense when configured.
- Switch kandidaat retrieval to Typesense when configured.
- Preserve PostgreSQL fallback and current public contracts.

### Phase 4: Rollout hardening

- Run initial reindex in a configured environment.
- Verify parity on vacature API/UI and kandidaat API/UI.
- Measure search latency and watch for stale-index drift before treating Typesense as default infra.

## Test Coverage

### New Tests

- [ ] [`tests/typesense-config.test.ts`](tests/typesense-config.test.ts)
  - env-gated enable/disable behavior
  - collection-name defaults
- [ ] [`tests/typesense-documents.test.ts`](tests/typesense-documents.test.ts)
  - job document mapping
  - candidate document mapping
  - null/array normalization
- [ ] [`tests/typesense-sync.test.ts`](tests/typesense-sync.test.ts)
  - upsert/delete behavior
  - missing-row handling

### Existing Tests To Update Or Extend

- [ ] [`tests/unified-search.test.ts`](tests/unified-search.test.ts)
  - Typesense-enabled vacature text path delegates correctly
  - fallback path remains unchanged when Typesense is disabled or fails
- [ ] [`tests/jobs-page-unified.test.ts`](tests/jobs-page-unified.test.ts)
  - paginated vacature search preserves page/total contract with Typesense text retrieval
- [ ] Add or extend candidate search tests, for example:
  - [`tests/candidate-search.test.ts`](tests/candidate-search.test.ts)
  to prove Typesense path and DB fallback
- [ ] Add structural wiring tests similar to:
  - [`tests/esco-ingestion-wiring.test.ts`](tests/esco-ingestion-wiring.test.ts)
  for search-index sync on write paths

## Risks & Mitigations

- **Risk:** Search totals drift from hydrated rows when the external index is stale.
  - **Mitigation:** keep PostgreSQL as source of truth, add reindex tooling, and fall back on retrieval failure.
- **Risk:** Write latency increases if every mutation waits on Typesense.
  - **Mitigation:** keep sync code compact, reuse authoritative row loads, and avoid per-route bespoke indexing logic.
- **Risk:** Vacature relevance regresses if Typesense replaces the vector branch too early.
  - **Mitigation:** initial rollout uses Typesense for text retrieval only and keeps pgvector retrieval in place.
- **Risk:** Candidate enrichment/update flows lose existing side effects.
  - **Mitigation:** preserve ESCO sync and embedding refresh ordering, then add Typesense sync in tests first.
- **Risk:** OpenSearch-like operational sprawl sneaks into the solution.
  - **Mitigation:** explicitly keep the provider narrow and avoid pipeline-heavy infrastructure for the initial rollout.

## Dependencies / Prerequisites

- Typesense instance reachable from the app environment
- API key with collection/document read-write access
- Existing database credentials remain unchanged

## Operational / Rollout Notes

- Default behavior should remain PostgreSQL-only until Typesense env vars are present.
- First deployment with Typesense enabled should run the reindex script before depending on external search results.
- If Typesense becomes unavailable at runtime, search should degrade to the current PostgreSQL path instead of failing the surface.

## Sources & References

- User request on March 28, 2026: “add typesense or meilisearch” and follow-up “also check opensearch”
- Related repo code:
  - [`src/services/jobs/search.ts`](src/services/jobs/search.ts)
  - [`src/services/jobs/page-query.ts`](src/services/jobs/page-query.ts)
  - [`src/services/jobs.ts`](src/services/jobs.ts)
  - [`src/services/candidates.ts`](src/services/candidates.ts)
  - [`src/services/normalize.ts`](src/services/normalize.ts)
  - [`src/services/jobs/repository.ts`](src/services/jobs/repository.ts)
  - [`src/services/embedding.ts`](src/services/embedding.ts)
  - [`src/lib/job-search-runner.ts`](src/lib/job-search-runner.ts)
- Adjacent requirements doc:
  - [`docs/brainstorms/2026-03-26-instant-vacatures-search-requirements.md`](docs/brainstorms/2026-03-26-instant-vacatures-search-requirements.md)
- Official docs consulted:
  - [Typesense Search API](https://typesense.org/docs/30.1/api/search.html)
  - [Typesense Vector Search](https://typesense.org/docs/27.1/api/vector-search.html)
  - [Meilisearch update guide](https://www.meilisearch.com/docs/resources/migration/updating)
  - [OpenSearch hybrid query](https://docs.opensearch.org/latest/query-dsl/compound/hybrid/)
  - [OpenSearch hybrid search](https://docs.opensearch.org/latest/vector-search/ai-search/hybrid-search/index/)
  - [OpenSearch Docker install](https://docs.opensearch.org/latest/install-and-configure/install-opensearch/docker/)
