---
title: "refactor: Unified vacature search parity across UI and agent surfaces"
type: refactor
status: active
date: 2026-03-06
origin: docs/brainstorms/2026-03-06-unified-job-search-brainstorm.md
---

# ♻️ Unified vacature search parity across UI and agent surfaces

## Overview

Motian currently exposes vacature search through multiple code paths that do not agree on query semantics, filtering, ranking, or pagination. The sidebar on `/opdrachten` calls a custom route at `app/api/opdrachten/zoeken/route.ts`, chat and MCP use `hybridSearch()` plus `listJobs()`, voice uses `listJobs()` only, and the CLI still uses `searchJobsByTitle()` for text queries. The result is search drift across surfaces.

This refactor consolidates vacature search behind one shared service contract so the UI, chat agent, MCP server, voice agent, and CLI all return the same result set in the same order for the same normalized input. The product truth is the agent’s current hybrid search behavior, carried forward from the brainstorm decision to adopt Approach A and make agent parity the canonical search model (see brainstorm: `docs/brainstorms/2026-03-06-unified-job-search-brainstorm.md`).

## Problem Statement

The current architecture violates the documented “shared service layer” principle. The most visible mismatch is:

- `components/opdrachten-sidebar.tsx` fetches `/api/opdrachten/zoeken` and therefore uses bespoke SQL instead of the same path as agent tools.
- `app/api/opdrachten/zoeken/route.ts` searches with multi-field `ILIKE`, province-on-location-only filtering, and page size 10.
- `app/api/opdrachten/route.ts` delegates to `listJobs()`, which uses FTS-or-title search semantics and different province handling.
- `src/ai/tools/query-opdrachten.ts` and `src/mcp/tools/vacatures.ts` use hybrid search for any text query.
- `src/voice-agent/agent.ts` does not currently use hybrid search for text queries, despite the broader parity direction.
- `src/cli/commands.ts` still uses `searchJobsByTitle()` directly, so it also drifts from hybrid behavior.

Users and agents therefore observe inconsistent search behavior depending on the entry point, which undermines trust and makes debugging ranking issues unnecessarily expensive.

## Proposed Solution

Introduce a single shared vacature search service in `src/services/jobs.ts` that owns:

- parameter normalization
- mode selection
- hybrid ranking
- filter application
- explicit sort overrides
- pagination and total count behavior
- result shaping guarantees for ordered output

All search-facing surfaces become thin adapters over that shared contract:

- UI routes
- sidebar query function
- chat tool
- MCP tool
- voice tool
- CLI command

In parallel (or immediately after parity is landed), refactor the **Chat UI** to be more like **ChatJS** (layout, message rendering, streaming UX, attachments/tool output presentation), while keeping Motian-specific agent tooling and Dutch UI copy. This reduces product “surface drift” by making the chat experience the canonical, polished interface for the unified search contract.

The new shared contract should preserve the brainstorm’s core decisions:

- one shared vacature search service is the sole source of truth
- the UI adopts the agent’s hybrid search behavior and ranking model
- all surfaces must produce identical ordering for equivalent inputs
- bespoke search SQL in adapters must be removed or reduced to delegation only

## Technical Approach

### Architecture

Create a new service-level entry point, for example `searchJobsUnified()` in [src/services/jobs.ts](/Users/cortex-air/Developer/motian/src/services/jobs.ts), that accepts the union of currently supported filters and pagination controls:

```ts
type UnifiedJobSearchOptions = {
  q?: string;
  platform?: string;
  province?: string;
  rateMin?: number;
  rateMax?: number;
  contractType?: string;
  workArrangement?: string;
  postedAfter?: Date | string;
  deadlineBefore?: Date | string;
  startDateAfter?: Date | string;
  sortBy?: ListJobsSortBy;
  limit?: number;
  offset?: number;
};
```

Expected semantics:

- No `q`: use the existing filtered listing semantics from `listJobs()`
- With `q`: use the existing hybrid semantics from `hybridSearch()`
- With `sortBy !== "nieuwste"`: explicit sort wins over RRF ranking, preserving the current hybrid behavior
- `offset` and `limit` must behave consistently across all adapters
- `total` must mean the same thing across all surfaces

Instead of letting each adapter decide which lower-level helper to call, the adapter calls the unified service and only maps naming differences such as `provincie` vs `province` or output field shape.

### Implementation Phases

#### Phase 1: Foundation

- Add a single normalized vacature search contract in `src/services/jobs.ts`.
- Move hybrid-vs-list branching out of adapters into the service layer.
- Reuse the existing `hybridSearch()` and `listJobs()` logic internally first, then simplify only if duplication becomes obvious.
- Ensure the unified service exposes deterministic ordering and a stable `total`.
- Add service-level tests for:
  - no-query filtered listing
  - query-driven hybrid search
  - explicit sort override over hybrid ranking
  - province, tarief, and contract type filters

Success criteria:

- One service function can reproduce current chat/MCP search semantics.
- Service tests demonstrate stable ordering for identical inputs.

Estimated effort: medium

#### Phase 2: Surface Migration

- Update [app/api/opdrachten/route.ts](/Users/cortex-air/Developer/motian/app/api/opdrachten/route.ts) to delegate to the unified service.
- Replace [app/api/opdrachten/zoeken/route.ts](/Users/cortex-air/Developer/motian/app/api/opdrachten/zoeken/route.ts) with a thin delegating adapter or remove it entirely if the sidebar can call the canonical route directly.
- Update [components/opdrachten-sidebar.tsx](/Users/cortex-air/Developer/motian/components/opdrachten-sidebar.tsx) to use the canonical service contract via the canonical route.
- Update [src/ai/tools/query-opdrachten.ts](/Users/cortex-air/Developer/motian/src/ai/tools/query-opdrachten.ts) to delegate to the unified service instead of branching itself.
- Update [src/mcp/tools/vacatures.ts](/Users/cortex-air/Developer/motian/src/mcp/tools/vacatures.ts) to do the same.
- Update [src/voice-agent/agent.ts](/Users/cortex-air/Developer/motian/src/voice-agent/agent.ts) so text queries also flow through the canonical hybrid path.
- Update [src/cli/commands.ts](/Users/cortex-air/Developer/motian/src/cli/commands.ts) so `vacatures:zoek` uses the same contract as all other surfaces.

Success criteria:

- All search adapters become thin delegators with no bespoke search semantics.
- Same input across UI, chat, MCP, voice, and CLI yields the same ordered IDs.

Estimated effort: medium-high

#### Phase 3: Verification and Cleanup

- Remove dead code and obsolete helper paths if they no longer provide value.
- Reconcile prompt/help text that still describes older search behavior.
- Add regression coverage for parity between surfaces.
- Update architecture docs where they currently understate parity or omit the unified contract.

Success criteria:

- No surface-specific search divergence remains.
- Tests cover parity-sensitive paths.
- Documentation reflects the new search truth.

Estimated effort: medium

#### Phase 4: Chat UI refactor (ChatJS-inspired)

Goal: make Motian’s chat experience feel “prod-ready” in the same way ChatJS does, while preserving Motian’s agent tools and the unified vacature search behavior.

Scope (UX + component architecture):

- Update the chat page layout to a ChatJS-like structure:
  - left rail / context area (if applicable) + main conversation area
  - sticky composer at bottom with clear send/stop states
  - resilient streaming UX (partial tokens, cancel, retry)
- Improve message rendering:
  - clean assistant/user message bubbles
  - high-quality Markdown rendering, code blocks, and long message handling
  - visible tool-call output as structured “cards” instead of raw JSON
- Add/align affordances commonly expected in ChatJS-like apps:
  - conversation persistence + ability to resume a thread
  - copy buttons (message + code), share/export hooks (if already supported)
  - attachments (at minimum images/files surfaced in UI; even if server support is limited, keep UI ready)
  - model selection / “agent mode” selection surface (only if Motian supports this; otherwise defer)

Engineering tasks (Motian-specific):

- Identify the current chat entry points and components (page route + UI components) and consolidate them into a single Chat UI module with clear boundaries.
- Ensure `queryOpdrachten` results are rendered in a first-class way (job cards, match scores, small charts) and remain consistent with the unified vacature search contract.
- Preserve Dutch UI strings while refactoring (English variable names remain OK).
- Keep adapters thin: Chat UI should not re-implement search semantics; it should call the same tools/services as MCP/voice/CLI.

Success criteria:

- Chat UI feels coherent and “production-grade” (ChatJS-inspired) without changing underlying search semantics.
- Tool outputs (vacature search, scoring, etc.) display as structured UI, not raw text blobs.
- Streaming interactions are smooth and cancelable.
- The same search input still yields the same ordered vacature IDs as MCP/voice/CLI (parity preserved).

Estimated effort: medium-high (depends on current chat UI divergence)

## Alternative Approaches Considered

### 1. Keep separate routes with partially shared query logic

Rejected because this still allows drift in normalization, filtering, total counts, and result ordering. It does not satisfy the brainstorm requirement that identical inputs yield identical ordered results across all surfaces (see brainstorm: `docs/brainstorms/2026-03-06-unified-job-search-brainstorm.md`).

### 2. Route everything through one internal HTTP endpoint

Rejected because the codebase already prefers shared service imports over internal HTTP hops, especially for agent surfaces. The voice-agent parity learning explicitly documents that direct service imports are the desired architecture, not internal fetch chains.

### 3. Make the UI conform only, leave voice and CLI as-is

Rejected because the user explicitly chose identical results and identical ordering across UI, chat, MCP, and voice. Leaving CLI or voice behind would preserve hidden parity bugs and violate the chosen scope boundary.

## System-Wide Impact

### Interaction Graph

Primary flow after refactor:

`UI sidebar query` -> `route adapter` -> `unified vacature search service` -> `hybridSearch()` or `listJobs()` internals -> `db/embedding services` -> ordered result set

`chat queryOpdrachten` -> `unified vacature search service` -> `withJobsCanonicalSkills()` -> summarized tool payload

`MCP zoek_vacatures` -> `unified vacature search service` -> `withJobsCanonicalSkills()` -> MCP response

`voice zoekOpdrachten` -> `unified vacature search service` -> `withJobsCanonicalSkills()` -> voice tool response

`CLI vacatures:zoek` -> `unified vacature search service` -> raw CLI output

Secondary effects:

- ESCO enrichment wrappers remain surface-specific presentation logic, not search logic.
- Pagination helpers still shape HTTP responses but should no longer affect search semantics.

### Error & Failure Propagation

- DB/Drizzle query errors from `listJobs()` and `searchJobsByTitle()` bubble to route/tool callers.
- Embedding import failures inside `hybridSearch()` already fall back to text-only search rather than throwing; this behavior should remain explicit and tested.
- Route-level wrappers such as `withApiHandler` can still shape HTTP error responses, but must not alter search result semantics.
- A parity risk exists if one adapter swallows fallback conditions differently than another. The unified service should centralize fallback decisions to remove that risk.

### State Lifecycle Risks

This work is read-heavy and introduces no new persistent data model, so orphan rows are not the primary concern. The real lifecycle risks are:

- stale drift from leaving old routes in place
- inconsistent paging totals between surfaces
- inconsistent canonical skill enrichment timing
- different behavior when embeddings are unavailable

Cleanup plan:

- remove or neuter `app/api/opdrachten/zoeken/route.ts`
- avoid keeping two “official” search routes alive without one delegating to the other
- keep enrichment outside the core ranking path unless ranking depends on it

### API Surface Parity

Surfaces requiring alignment:

- `/opdrachten` sidebar via [components/opdrachten-sidebar.tsx](/Users/cortex-air/Developer/motian/components/opdrachten-sidebar.tsx)
- canonical HTTP listing via [app/api/opdrachten/route.ts](/Users/cortex-air/Developer/motian/app/api/opdrachten/route.ts)
- legacy sidebar route via [app/api/opdrachten/zoeken/route.ts](/Users/cortex-air/Developer/motian/app/api/opdrachten/zoeken/route.ts)
- chat tool via [src/ai/tools/query-opdrachten.ts](/Users/cortex-air/Developer/motian/src/ai/tools/query-opdrachten.ts)
- MCP tool via [src/mcp/tools/vacatures.ts](/Users/cortex-air/Developer/motian/src/mcp/tools/vacatures.ts)
- voice tool via [src/voice-agent/agent.ts](/Users/cortex-air/Developer/motian/src/voice-agent/agent.ts)
- CLI command via [src/cli/commands.ts](/Users/cortex-air/Developer/motian/src/cli/commands.ts)

### Integration Test Scenarios

1. Same `q`, `platform`, `province`, `rateMin`, and `contractType` through UI route and chat tool return identical ordered job IDs.
2. Same `q` through MCP and voice returns identical ordered job IDs even when embeddings are available.
3. Same `q` through all surfaces falls back identically when vector search is unavailable.
4. Same non-query filter set through UI route and CLI returns identical totals and page-1 ordering.
5. Explicit `sortBy=tarief_hoog` with a text query overrides RRF consistently across HTTP, chat, MCP, voice, and CLI.

## Acceptance Criteria

### Functional Requirements

- [ ] A single shared vacature search service owns query normalization, hybrid/list branching, filtering, sort behavior, pagination, and final ordering (see brainstorm: `docs/brainstorms/2026-03-06-unified-job-search-brainstorm.md`).
- [ ] The `/opdrachten` sidebar no longer uses bespoke search semantics from `app/api/opdrachten/zoeken/route.ts`.
- [ ] The canonical UI route, chat tool, MCP tool, voice tool, and CLI command all delegate to the same service contract.
- [ ] For the same normalized input, UI, chat, MCP, voice, and CLI return the same ordered vacature IDs.
- [ ] `sortBy` override semantics are consistent across all surfaces.
- [ ] Search fallback behavior when embeddings are unavailable is centralized and consistent across all surfaces.
- [ ] Chat UI is refactored toward a ChatJS-like UX baseline (message rendering, streaming UX, tool output presentation) without reintroducing search drift.

### Non-Functional Requirements

- [ ] No additional internal HTTP hop is introduced for agent surfaces.
- [ ] Search remains bounded by existing `limit` caps and does not introduce unbounded result materialization.
- [ ] The refactor preserves Dutch parameter conventions at adapter boundaries where needed, while normalizing internally.

### Quality Gates

- [ ] Add automated tests for unified service behavior and surface parity.
- [ ] Run `pnpm lint`.
- [ ] Run targeted tests covering `src/services/jobs.ts` and adapter parity.
- [ ] If available, run `pnpm tsx scripts/harness/entropy-check.ts`.
- [ ] Run `pnpm exec tsc --noEmit` before landing.

## Success Metrics

- Identical ordered ID lists for canonical parity test fixtures across UI, chat, MCP, voice, and CLI.
- Removal or reduction of bespoke search logic in adapters to thin parameter/output mapping only.
- Fewer search-related support/debugging cases caused by surface-specific behavior.

## Dependencies & Prerequisites

- Existing `hybridSearch()` behavior in [src/services/jobs.ts](/Users/cortex-air/Developer/motian/src/services/jobs.ts) remains the relevance baseline.
- Existing ESCO wrapper functions remain available for surfaces that need enriched output.
- Tests may need fixtures or mocks around vector-search availability to validate fallback behavior deterministically.

## Risk Analysis & Mitigation

- **Risk:** accidental behavior change in the default `/api/opdrachten` experience.
  - **Mitigation:** capture current agent truth in service-level parity tests before adapter cleanup.
- **Risk:** voice and CLI remain out of sync because they currently do not share the same branching logic.
  - **Mitigation:** include them explicitly in acceptance criteria and parity tests.
- **Risk:** keeping both `/api/opdrachten` and `/api/opdrachten/zoeken` alive prolongs confusion.
  - **Mitigation:** either remove the legacy route or make it a thin delegator with zero custom SQL.
- **Risk:** unstable totals for hybrid search if total counting semantics are not defined.
  - **Mitigation:** define total behavior in the unified service and test it explicitly.

## Resource Requirements

- One engineer familiar with Next.js route handlers, Drizzle query services, and agent surfaces.
- No schema migration required.
- No new infrastructure required.

## Future Considerations

- If later needed, expose `mode: "hybrid" | "list"` explicitly for debugging, but do not reintroduce divergent caller-owned branching.
- Consider whether `searchJobsByTitle()` should remain public after the refactor or become an internal helper.
- Consider adding a parity test harness for other domains such as kandidaten and matches, following the same pattern.

## Documentation Plan

- Update [docs/architecture.md](/Users/cortex-air/Developer/motian/docs/architecture.md) so “shared service layer” and hybrid search parity are described accurately.
- Update any prompt/help text that still implies title-only search or route-specific semantics.
- Optionally add a short `docs/solutions/` note after implementation if the refactor uncovers new parity-specific gotchas.

## SpecFlow Analysis

### User Flow Overview

1. Recruiter types a zoekterm in the `/opdrachten` sidebar and expects the same ordering as the AI assistant would return for the same request.
2. Recruiter uses structured filters without a zoekterm and expects normal list behavior, not a different hidden search engine.
3. Agent or MCP client asks for vacatures with a zoekterm and should see the same ordering the recruiter sees in the UI.
4. Voice agent runs a spoken vacature search and should not silently diverge from chat/MCP relevance.
5. CLI operator runs `vacatures:zoek` during debugging and should be able to reproduce what the UI/agents show.

### Missing Elements & Gaps To Resolve In Implementation

- **Total semantics for hybrid search:** current agent tools return `results.length`, but HTTP routes think in paginated totals. The unified contract must define this clearly.
- **Pagination semantics for hybrid search:** current hybrid path slices after scoring, but adapters vary in page sizing and offsets.
- **Fallback visibility:** if embeddings are unavailable, all surfaces must degrade the same way.
- **Prompt drift:** the chat system prompt still describes `queryOpdrachten` with title-word-centric guidance that may become stale after parity unification.

### Critical Questions Resolved For Planning

1. Should the UI use the same search logic as the agent?
   - Resolved: yes, from the brainstorm.
2. Should the ordering also be identical across surfaces?
   - Resolved: yes, from the brainstorm.
3. Which architectural direction should be used?
   - Resolved: Approach A, one shared service with thin adapters.

### Recommended Next Steps

- Define the unified service contract first.
- Capture parity tests before deleting legacy logic.
- Migrate every surface, including voice and CLI, not just the sidebar.

## Sources & References

### Origin

- **Brainstorm document:** [docs/brainstorms/2026-03-06-unified-job-search-brainstorm.md](/Users/cortex-air/Developer/motian/docs/brainstorms/2026-03-06-unified-job-search-brainstorm.md)
  - Key decisions carried forward:
  - one shared vacature search service is the sole source of truth
  - agent parity becomes product truth for the UI
  - identical inputs must yield identical ordered results across UI, chat, MCP, and voice

### Internal References

- Architecture states the platform should share the same service layer: [docs/architecture.md](/Users/cortex-air/Developer/motian/docs/architecture.md)
- Current split search behavior:
  - [src/services/jobs.ts](/Users/cortex-air/Developer/motian/src/services/jobs.ts#L102)
  - [src/services/jobs.ts](/Users/cortex-air/Developer/motian/src/services/jobs.ts#L263)
  - [components/opdrachten-sidebar.tsx](/Users/cortex-air/Developer/motian/components/opdrachten-sidebar.tsx#L74)
  - [app/api/opdrachten/zoeken/route.ts](/Users/cortex-air/Developer/motian/app/api/opdrachten/zoeken/route.ts#L10)
  - [app/api/opdrachten/route.ts](/Users/cortex-air/Developer/motian/app/api/opdrachten/route.ts#L9)
- Current agent-facing search paths:
  - [src/ai/tools/query-opdrachten.ts](/Users/cortex-air/Developer/motian/src/ai/tools/query-opdrachten.ts#L75)
  - [src/mcp/tools/vacatures.ts](/Users/cortex-air/Developer/motian/src/mcp/tools/vacatures.ts#L74)
  - [src/voice-agent/agent.ts](/Users/cortex-air/Developer/motian/src/voice-agent/agent.ts#L77)
  - [src/cli/commands.ts](/Users/cortex-air/Developer/motian/src/cli/commands.ts#L210)

### Institutional Learnings

- **Voice agent parity learning:** [docs/solutions/integration-issues/voice-agent-tool-parity-migration-VoiceAgent-20260305.md](/Users/cortex-air/Developer/motian/docs/solutions/integration-issues/voice-agent-tool-parity-migration-VoiceAgent-20260305.md)
  - Relevant insight: direct service imports are the intended parity model; HTTP indirection and stale contracts caused tool drift.
- **Agent/UI parity learning:** [docs/solutions/api-schema-gaps/agent-ui-parity-kandidaten-20260223.md](/Users/cortex-air/Developer/motian/docs/solutions/api-schema-gaps/agent-ui-parity-kandidaten-20260223.md)
  - Relevant insight: parity gaps emerge when API schemas, tools, and service contracts evolve separately. Changes must be applied across all exposed surfaces.

### External References

- ChatJS documentation (Chat UI UX baseline reference): `https://www.chatjs.dev/docs`

### Related Work

- No directly linked issue number was identified during local research.
