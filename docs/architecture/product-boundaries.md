# Motian product boundaries

This document is the current ownership map for the product-boundary split. It is intentionally opinionated: the goal is to reduce cross-cutting changes, make ownership obvious, and keep the AI Platform as the anchor boundary without pretending everything AI-related belongs there.

## Purpose

Motian currently has strong technical surfaces but weak product seams. The repo mixes recruiter workflows, ingestion, AI surfaces, compliance, and runtime orchestration across `app/`, `src/services/`, `src/ai/`, `src/mcp/`, `src/voice-agent/`, `trigger/`, and `packages/*`. The purpose of this split is to make those seams explicit so each area has one primary owner, a clear public contract, and a predictable migration path.

The four product boundaries are:

1. **AI Platform** — the anchor boundary; shared AI capabilities, agent surfaces, and runtime/tooling
2. **Recruiter Operations** — recruiter-facing workflows and cockpit behavior
3. **Sourcing & Ingestion** — scraping, normalization, enrichment, embeddings, indexing prep
4. **Ops & Compliance** — GDPR, reporting, settings, monitoring, governance

## Decision Rules

- **One primary owner per major subsystem.** Every major area should have a single primary boundary even if it is consumed elsewhere.
- **Ownership follows the product value, not the technical location.** A file under `src/services/` is not automatically “platform”; a file under `app/` is not automatically “recruiter ops.”
- **AI usage does not imply AI Platform ownership.** If a domain flow merely uses AI, it still belongs to its domain boundary unless the AI capability itself is reusable platform logic.
- **Platform boundaries expose contracts, not internals.** Other boundaries should consume public exports or explicit service interfaces, not deep implementation files.
- **Runtime location and ownership are separate concerns.** A runtime can host a boundary’s UI or entrypoint without owning the underlying product behavior.
- **Ingestion is upstream of AI, not inside it.** Data acquisition and normalization belong to Sourcing & Ingestion even when AI tools consume the output.
- **Non-platform boundaries should not cross-import each other’s internals.** Recruiter Operations, Sourcing & Ingestion, and Ops & Compliance should meet through boundary-owned contracts or shared infrastructure packages.

## Current-State Ownership Map

### App router and UI

| Current area | Primary boundary | Why |
|---|---|---|
| `app/vacatures/`, `app/opdrachten/` | Recruiter Operations | Recruiter-facing vacancy flow and list/detail pages |
| `app/kandidaten/` | Recruiter Operations | Candidate directory and candidate profile workflow |
| `app/interviews/` | Recruiter Operations | Interview scheduling and feedback workflows |
| `app/overzicht/` | Recruiter Operations | Recruiter cockpit and operational summary views |
| `app/chat/` | AI Platform | AI surface with shared tooling, model interaction, and agent-style behavior |
| `app/scraper/`, `app/pipeline/` | Sourcing & Ingestion | Ingestion monitoring and manual trigger surfaces |
| `app/settings/` | Ops & Compliance | Settings and governance controls |
| `app/api/*` | Mixed; see runtime map | Thin adapters that should delegate to the owning boundary |

### Core domain and service layer

| Current area | Primary boundary | Why |
|---|---|---|
| `src/ai/` | AI Platform | Agent prompts, tool registry, and AI-facing orchestration |
| `src/mcp/` | AI Platform | MCP runtime and tool transport |
| `src/voice-agent/` | AI Platform | Voice runtime and shared AI interactions |
| `src/autopilot/` | AI Platform | Autonomous AI workflows and evidence/reporting around agent behavior |
| `src/services/jobs.ts`, `src/services/candidates.ts`, `src/services/matches.ts`, `src/services/applications.ts`, `src/services/interviews.ts`, `src/services/messages.ts` | Recruiter Operations | Core recruiter domain workflows |
| `src/services/scrape-pipeline.ts`, `src/services/normalize.ts`, `src/services/ai-enrichment.ts`, `src/services/embedding.ts`, `src/services/search-index/*`, `src/services/scrapers.ts` | Sourcing & Ingestion | Acquisition, normalization, enrichment, and index prep |
| `src/services/gdpr.ts`, `src/services/report-generator.ts`, `src/services/settings.ts`, `src/services/operations-console.ts` | Ops & Compliance | Compliance, reporting, settings, and governance |
| `src/services/workspace.ts`, `src/lib/*` | Mixed infrastructure | Shared infrastructure helpers; keep only truly generic utilities here |

### Workspace packages and external surfaces

| Current area | Primary boundary | Why |
|---|---|---|
| `packages/db` | Shared infrastructure | Persistence package, not a product boundary |
| `packages/esco` | Sourcing & Ingestion | Classification/enrichment support for sourcing workflows |
| `packages/scrapers` | Sourcing & Ingestion | Shared scraper adapters and registries |
| `agent/` | AI Platform consumer/runtime | Separate runtime today, but it consumes the same AI/platform contracts |
| `trigger/` | Mixed; see runtime map | Job entrypoints should be owned by the boundary whose work they perform |

## Runtime Owner / Consumer / Adapter Map

| Runtime / entrypoint | Role | Primary boundary | Notes |
|---|---|---|---|
| `src/voice-agent/main.ts` | Owner runtime | AI Platform | Voice runtime should stay platform-owned even when it reuses domain services |
| `src/mcp/server.ts` | Adapter runtime | AI Platform | MCP should register platform-owned tools through a thin transport wrapper |
| `app/chat/` and related chat surfaces | Consumer surface | AI Platform | UI can live in the web app while the behavior stays platform-owned |
| `app/vacatures/`, `app/opdrachten/`, `app/kandidaten/`, `app/interviews/`, `app/overzicht/` | Owner surfaces | Recruiter Operations | These are the recruiter cockpit surfaces |
| `trigger/scrape-pipeline.ts`, `trigger/embeddings-batch.ts`, `trigger/scraper-health.ts` | Owner jobs | Sourcing & Ingestion | Ingestion jobs should be owned by the ingestion boundary |
| `trigger/vacancy-expiry.ts`, `trigger/data-retention.ts`, `trigger/match-staleness.ts` | Owner jobs | Ops & Compliance | Maintenance and compliance jobs belong here unless they are clearly recruiter-op flows |
| `trigger/slack-notifications.ts` | Shared operational adapter | Ops & Compliance | Notifications are operational; keep them boundary-aware |
| `agent/` | Consumer runtime | AI Platform | The separate agent package should consume platform contracts, not duplicate them |
| `app/api/*` | Thin adapters | Varies | Each route should be treated as an adapter that delegates to one primary boundary |

## Migration Guidance

1. **Create an ownership map before moving code.** If a module’s owner is unclear, write it down first instead of relocating it blindly.
2. **Extract the platform seam first.** The first durable seam should be AI Platform public contracts, because chat, MCP, voice, and agent-style orchestration all depend on it.
3. **Keep runtime moves last.** Runtimes should follow the ownership map, not define it.
4. **Prefer facades over large file moves.** Start by introducing boundary-owned exports and thin adapters, then move implementation files only when the seam is proven.
5. **Preserve end-user behavior.** Boundary changes should not alter Dutch route names, expected API behavior, or current recruiter flows.
6. **Treat shared infrastructure separately.** `packages/db`, generic helpers in `src/lib/`, and other cross-cutting utilities should remain infrastructure unless they clearly become boundary-owned.
7. **Use tests to enforce the seam.** Structural tests should verify that major modules have a primary boundary and that runtime entrypoints import through public boundary exports.

## Migration Sequence

1. Publish this ownership map.
2. Lock the major subsystem mapping in tests.
3. Introduce `packages/ai-platform` as the first public seam.
4. Convert runtime entrypoints to consume boundary exports.
5. Split remaining recruiter, ingestion, and compliance modules into boundary-aligned packages or clearly marked directories.
6. Move runtime/app layout only after boundary contracts are stable.

## Working Summary

- **AI Platform** is the anchor boundary and should stay focused on reusable AI capability, agent surfaces, and runtime/tooling.
- **Recruiter Operations** owns the day-to-day recruiter product.
- **Sourcing & Ingestion** owns data acquisition and preparation.
- **Ops & Compliance** owns governance, reporting, and policy-heavy operational flows.

When in doubt, ask a simple question: *which boundary would break if this behavior changed?* The answer should determine ownership.
