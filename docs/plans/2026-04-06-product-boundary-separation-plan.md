---
title: "architecture: separate Motian by product boundary with AI Platform as the anchor"
type: architecture
status: active
date: 2026-04-06
origin: docs/brainstorms/2026-04-06-product-boundary-separation-requirements.md
---

# Architecture: separate Motian by product boundary with AI Platform as the anchor

## Overview

Motian needs an ownership-first boundary split. Today, the repo mixes recruiter workflows, ingestion pipelines, AI surfaces, Trigger orchestration, and compliance concerns across `app/`, `src/services/`, `src/ai/`, `src/mcp/`, `src/voice-agent/`, and `trigger/`. Some infrastructure has already been extracted into workspace packages, but the product seams are still implicit.

This plan introduces a phased split with **AI Platform** as the anchor product boundary, while preserving three neighboring product boundaries:

1. **AI Platform** — shared AI capabilities, agent surfaces, and runtime/tooling
2. **Recruiter Operations** — recruiter-facing workflows and cockpit behavior
3. **Sourcing & Ingestion** — scraping, normalization, enrichment, embeddings, indexing prep
4. **Ops & Compliance** — GDPR, reporting, settings, monitoring, governance

The sequencing optimizes for ownership clarity and lower cross-cutting change cost before it optimizes for deployment isolation.

## Problem Statement

The current monorepo has three overlapping kinds of structure:
- **Runtime structure**: Next.js app, voice runtime, Trigger tasks, MCP server, CLI, agent package
- **Technical structure**: `src/services/`, `src/lib/`, `src/ai/`, `trigger/`, `packages/*`
- **Implicit domain structure**: jobs, candidates, matching, scraping, GDPR, chat, reporting

Because these structures do not align to a single boundary model:
- changes often touch multiple directories with no obvious owner
- agent surfaces duplicate domain decisions instead of consuming a clear platform contract
- package extraction risks following technical convenience rather than durable product seams
- runtime splits could harden the wrong seams if done before ownership is explicit

## Requirements Trace

Source of truth: `docs/brainstorms/2026-04-06-product-boundary-separation-requirements.md`

- **R1-R4** → define the boundary model first, then package and runtime mapping
- **R5-R8** → make AI Platform a full-stack internal platform boundary
- **R9-R11** → keep Recruiter Operations, Sourcing & Ingestion, and Ops & Compliance as explicit neighbors
- **R12-R16** → create public contracts and dependency rules that reduce cross-boundary churn
- **R17-R19** → migrate incrementally without breaking current external behavior

## Proposed Boundary Model

### 1. AI Platform (anchor boundary)

**Owns**
- Shared AI capabilities used across surfaces: search/match reasoning, structured evaluation, agent workflows, prompt/runtime composition, surface parity helpers
- Surface adapters and runtime/tooling for chat, MCP, voice, and autopilot-style orchestration
- Shared contracts for how other boundaries ask for AI-powered behavior

**Likely current sources**
- `src/ai/`
- `src/mcp/`
- `src/voice-agent/`
- AI-facing parts of `src/autopilot/`
- Selected shared logic in `src/lib/` and `src/services/` that is truly platform capability rather than recruiter-product behavior
- `agent/` as a downstream consumer or sibling runtime, depending on final contract shape

**Does not own**
- Recruiter-specific page flows
- Scraper-specific ingestion pipelines
- GDPR and reporting policy logic

### 2. Recruiter Operations

**Owns**
- Recruiter cockpit and domain workflows around vacatures, kandidaten, matches, sollicitaties, interviews, berichten
- User-facing pages and UI composition for recruiter work
- Domain policies specific to operating the recruitment product

**Likely current sources**
- `app/overzicht/`
- `app/vacatures/` and `app/opdrachten/`
- `app/kandidaten/`
- `app/interviews/`
- Recruiter-facing components in `components/`
- Domain services such as `src/services/jobs.ts`, `src/services/candidates.ts`, `src/services/matches.ts`, `src/services/applications.ts`, `src/services/interviews.ts`, `src/services/messages.ts`

### 3. Sourcing & Ingestion

**Owns**
- Scraper execution, raw intake, normalization, enrichment, embeddings generation, scrape result recording, search-index preparation
- Scheduled and asynchronous ingestion pipelines

**Likely current sources**
- `packages/scrapers/`
- `src/services/scrape-pipeline.ts`
- `src/services/normalize.ts`
- `src/services/ai-enrichment.ts`
- `src/services/embedding.ts`
- `src/services/search-index/`
- `src/services/scrapers.ts`
- Ingestion-oriented Trigger tasks in `trigger/`

### 4. Ops & Compliance

**Owns**
- GDPR export/deletion flows
- Reporting, settings, monitoring, and operational governance
- Cross-cutting compliance rules and auditability

**Likely current sources**
- `src/services/gdpr.ts`
- `src/services/report-generator.ts`
- `src/services/settings.ts`
- `src/services/operations-console.ts`
- Relevant admin/report routes under `app/` and `app/api/`
- Selected maintenance and notification tasks in `trigger/`

## Runtime Mapping Strategy

### Near-term rule
Do **not** split runtimes first. First make boundary ownership explicit and enforce public contracts inside the current repo shape.

### Target runtime shape
After contracts are stable, move toward:
- `apps/web` — Next.js product runtime, primarily Recruiter Operations, embedding AI Platform surfaces where needed
- `apps/background` — Trigger.dev runtime for ingestion, maintenance, and orchestration jobs
- `apps/voice-agent` — voice runtime owned by AI Platform
- `agent/` — keep as a separate consumer/runtime unless planning discovers it should be folded into AI Platform packaging
- `packages/*` — boundary-owned packages and shared infrastructure packages

### Important nuance
Chat can remain visually embedded in the web app while still being **owned by AI Platform**. Runtime location and product ownership are not identical; this distinction should be explicit in the boundary map.

## Dependency Rules

1. **AI Platform may depend on domain contracts, not domain internals.**
2. **Recruiter Operations may consume AI Platform contracts, but should not reach into `src/ai/`, `src/mcp/`, or voice/runtime internals directly once the seam exists.**
3. **Sourcing & Ingestion may publish normalized/searchable artifacts and may call AI Platform contracts for enrichment or reasoning, but it should not own recruiter cockpit behavior.**
4. **Ops & Compliance may read from other boundaries through explicit service contracts and shared persistence models, but it should not become a dumping ground for unrelated admin code.**
5. **Runtime entrypoints (`app/api/`, `trigger/`, `src/mcp/server.ts`, `src/voice-agent/main.ts`) should become thin adapters over boundary exports.**
6. **Non-platform boundaries should not cross-import each other's internals once contracts exist; they should use explicit boundary exports or shared infrastructure contracts instead.**

## Implementation Phases

### Phase 1 — Boundary inventory and ownership map

Goal: create the durable product-boundary map before moving code.

Work:
- Add a new architecture document that maps current directories/modules to the four product boundaries.
- Classify current runtime entrypoints as **owner**, **consumer**, or **adapter** relative to those boundaries.
- Identify current cross-boundary hotspots, especially in `src/services/`, `src/lib/`, and `trigger/`.
- Write explicit allowed-dependency rules for the first extraction wave.

Primary files:
- `docs/architecture.md`
- `docs/architecture/product-boundaries.md` (new)
- `docs/plans/2026-04-06-product-boundary-separation-plan.md`

Test coverage to add/update:
- `tests/product-boundary-map.test.ts` (new) — verifies every targeted module group is assigned to exactly one primary boundary

Test scenarios:
- Assert the boundary map covers `app/`, `src/services/`, `src/ai/`, `src/mcp/`, `src/voice-agent/`, `trigger/`, and `packages/*`
- Assert no module group is marked as primary owner in more than one boundary
- Assert runtime entrypoints are labeled as owner/consumer/adapter

### Phase 2 — Extract AI Platform public contracts

Goal: create the first real seam around AI Platform without yet moving every implementation file.

Work:
- Introduce an AI Platform package boundary, likely `packages/ai-platform/`.
- Move or re-export platform-owned contracts there: shared tool/runtime types, platform service interfaces, surface-parity abstractions, and stable entrypoints for recruiter/integration consumers.
- Refactor chat, MCP, voice, and autopilot-facing code to import through public platform exports.
- Keep implementation moves incremental: start with public API seams and facades, not wholesale file relocation.

Primary files:
- `pnpm-workspace.yaml`
- `package.json`
- `packages/ai-platform/package.json` (new)
- `packages/ai-platform/src/index.ts` (new)
- `src/ai/`
- `src/mcp/`
- `src/voice-agent/`
- `src/autopilot/`

Test coverage to add/update:
- `tests/ai-platform-contracts.test.ts` (new) — verifies public exports exist for the chosen platform contract surface
- `tests/runtime-entrypoints-boundaries.test.ts` (new) — verifies runtime entrypoints import boundary facades rather than internals

Test scenarios:
- Assert chat, MCP, voice, and autopilot compose through platform exports for selected shared capabilities
- Assert no runtime entrypoint imports newly-forbidden internal modules across the platform seam
- Assert the package can be imported without pulling web-only code into non-web runtimes

### Phase 3 — Align neighbor boundaries around the platform seam

Goal: make the three non-platform product boundaries explicit and reduce ambiguous `src/services/` ownership.

Work:
- Introduce boundary-aligned packages or at minimum boundary-aligned directory ownership markers for Recruiter Operations, Sourcing & Ingestion, and Ops & Compliance.
- Start with the highest-churn modules:
  - Recruiter Operations: jobs/candidates/matches/applications/interviews/messages
  - Sourcing & Ingestion: scrape/normalize/enrich/embed/index
  - Ops & Compliance: gdpr/reporting/settings/ops-console
- Preserve stable facades during the move so runtime adapters do not break.
- Update AGENTS/docs where necessary so future changes follow the new map.

Primary files:
- `src/services/`
- `packages/recruiter-operations/` (new or deferred package target)
- `packages/ingestion/` (new or deferred package target)
- `packages/ops-compliance/` (new or deferred package target)
- `packages/scrapers/`
- `packages/db/`
- `packages/esco/`

Test coverage to add/update:
- `tests/boundary-import-rules.test.ts` (new) — verifies forbidden cross-boundary imports
- Existing service tests under `tests/` for moved modules

Test scenarios:
- Assert moved modules continue to satisfy existing service behavior tests
- Assert new boundary packages expose only approved entrypoints
- Assert no direct imports from Recruiter Operations into ingestion internals or vice versa

### Phase 4 — Runtime/app separation

Goal: let runtime layout follow the product-boundary map instead of defining it.

Work:
- Move the current Next.js runtime toward `apps/web` once package seams are stable.
- Extract Trigger runtime into `apps/background` when job ownership and contracts are clear.
- Move `src/voice-agent/` into `apps/voice-agent` when the AI Platform package seam is proven.
- Keep runtime entrypoints thin and boundary-oriented.

Primary files:
- `app/`
- `trigger/`
- `src/voice-agent/`
- `pnpm-workspace.yaml`
- `tsconfig.json`
- `tsconfig.base.json`
- build and config files such as `trigger.config.ts`, `next.config.ts`, and package manifests

Test coverage to add/update:
- `tests/runtime-smoke-boundaries.test.ts` (new) — verifies each runtime starts from approved boundary entrypoints
- Relevant existing integration tests and harness tests

Test scenarios:
- Assert web runtime imports Recruiter Operations and AI Platform through public package exports
- Assert background runtime composes domain jobs through boundary contracts
- Assert voice runtime depends on AI Platform exports and not recruiter UI code

## Sequencing Decisions

- **Do not** start with deployment isolation.
- **Do** start with documentation, ownership, and contract enforcement.
- Extract **AI Platform contracts first**, because that is the chosen anchor seam and it reduces churn for all other boundaries.
- Extract neighbor boundaries second, because their borders become clearer once the platform seam is explicit.
- Move runtimes/apps last, because that change should reflect the boundary map rather than invent it.

## Risks and Mitigations

- **Risk: AI Platform becomes a vague umbrella.**
  - Mitigation: define explicit ownership and explicit non-goals for the platform in Phase 1.
- **Risk: package sprawl before contracts are stable.**
  - Mitigation: create facades and ownership docs before large-scale file movement.
- **Risk: runtime extraction hardens the wrong seams.**
  - Mitigation: delay runtime moves until boundary imports and contracts are proven.
- **Risk: `src/services/` remains a catch-all even after planning.**
  - Mitigation: require every moved or newly touched service module to declare a primary owning boundary during the migration.
- **Risk: AI surfaces drift again.**
  - Mitigation: add structural tests that enforce chat/MCP/voice/background entry through the same platform exports.

## Open Technical Questions

These are planning-owned, not product blockers:
- Should `packages/ai-platform/` expose TypeScript service contracts only, or also adapter factories for chat/MCP/voice?
- Which current modules should remain infrastructure packages (`packages/db`, `packages/esco`, `packages/scrapers`) versus being absorbed into product-boundary packages?
- Should Trigger jobs be grouped by owning boundary under `apps/background`, or should orchestration stay centralized with domain-owned handlers?
- Which import-boundary enforcement mechanism is best here: Vitest structural tests, Biome rules, TS path boundaries, or a combination?

## Recommended First Execution Slice

Start with a non-destructive planning-to-implementation slice:
1. Create `docs/architecture/product-boundaries.md`
2. Map current modules and runtimes to the four boundaries
3. Add structural tests for coverage of the boundary map
4. Define the first public AI Platform facade before moving implementation files

This yields a real seam without forcing immediate large-scale code movement.
