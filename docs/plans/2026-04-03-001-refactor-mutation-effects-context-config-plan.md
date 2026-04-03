---
title: "refactor: extract mutation effects, enrich agent context, config-ize thresholds"
type: refactor
status: active
date: 2026-04-03
---

# Refactor: Extract Mutation Effects, Enrich Agent Context, Config-ize Thresholds

## Overview

Architecture cleanup addressing verified findings from the agent-native audit. Mutation handlers in MCP tool modules currently perform domain mutation + cache invalidation + event publishing + Trigger.dev dispatch. This refactor extracts side effects into service-layer coordinators, enriches the AI agent context with user-scoped data, moves hardcoded scoring/search thresholds to settings-backed config, and normalizes delete feedback across all surfaces.

## Problem Frame

Tool transport handlers (MCP and API routes) are responsible for workflow side effects that belong in the service layer. This couples tool code to caching strategy, event bus, and background task dispatch — making tools non-portable and hard to test in isolation. Separately, the AI agent lacks user-specific context (identity, preferences, recent activity) and operational thresholds are scattered across code constants and env vars.

## Requirements Trace

- R1. Mutation side effects (publish, revalidatePath, Trigger dispatch) extracted into service coordinators
- R2. Agent context enriched with userId, saved filters, recent entities
- R3. Scoring/search thresholds moved from code constants to settings-backed config
- R4. Delete feedback normalized: every delete → mutate + publish + structured confirmation
- R5. Legacy `app/api/candidates/[id]/route.ts` reviewed and resolved

## Scope Boundaries

- NOT rewriting all 79 MCP tools — only the 6 mutation-heavy modules
- NOT making business logic prompt-configurable — thresholds go to settings/config, not prompts
- NOT adding user authentication (userId will be a placeholder until auth is added)
- NOT changing the event bus architecture (keep SSE, just normalize usage)

## Key Technical Decisions

- **Effects layer pattern**: `createCandidateWithEffects()` wraps `createCandidate()` + `publish()` + `revalidatePath()`. Tools call the effects function, not the raw mutation + manual side effects.
- **Config over prompts**: Scoring weights, search thresholds, match limits go to the `platformSettings` table via `getAllSettings()`, not into prompt text. Prompt receives rendered values from config.
- **Delete consistency**: All deletes follow: soft-delete → publish event → revalidate → return `{ deleted: true, id }`.

## Implementation Units

- [ ] **Unit 1: Create mutation effects layer for candidates**

**Goal:** Extract side effects from `src/mcp/tools/kandidaten.ts` mutation handlers into service coordinators.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Create: `src/services/candidate-effects.ts`
- Modify: `src/mcp/tools/kandidaten.ts` (lines 149-209)
- Modify: `src/ai/tools/kandidaten.ts` (corresponding AI tool mutations)

**Approach:**
- Create `createCandidateWithEffects(data)`, `updateCandidateWithEffects(id, data)`, `deleteCandidateWithEffects(id)` in new effects file
- Each function: calls service mutation → publishes event → revalidates paths → returns result
- MCP/AI tool handlers become: parse input → call effects function → return result
- Import publish from event-bus, revalidatePath from next/cache

**Patterns to follow:**
- Existing `runCandidateDerivedSync()` pattern in `src/services/candidates.ts`

**Test scenarios:**
- Happy path: createCandidateWithEffects creates candidate, publishes event, revalidates paths
- Happy path: deleteCandidateWithEffects soft-deletes, publishes, revalidates
- Error path: if mutation fails, no event is published

**Verification:** Tool handlers contain zero `publish()` or `revalidatePath()` calls. `pnpm tsc --noEmit` clean.

- [ ] **Unit 2: Create mutation effects layer for vacatures, matches, pipeline**

**Goal:** Same extraction for the other mutation-heavy modules.

**Requirements:** R1

**Dependencies:** Unit 1 (establishes pattern)

**Files:**
- Create: `src/services/job-effects.ts`
- Create: `src/services/match-effects.ts`
- Create: `src/services/pipeline-effects.ts`
- Modify: `src/mcp/tools/vacatures.ts` (lines 165-207)
- Modify: `src/mcp/tools/matches.ts` (lines 111-155)
- Modify: `src/mcp/tools/pipeline.ts` (lines 226-337)
- Modify: `src/mcp/tools/platforms.ts` (lines 122-286)
- Modify: `src/mcp/tools/screening-calls.ts` (lines 104-132)

**Approach:**
- Follow Unit 1 pattern for each module
- `createMatchWithEffects()`, `approveMatchWithEffects()`, `rejectMatchWithEffects()`
- `createApplicationWithEffects()`, `updateApplicationStageWithEffects()`
- `planInterviewWithEffects()`, `updateInterviewWithEffects()`
- Platform tools: extract multi-step setup orchestration into platform service

**Test scenarios:**
- Happy path: each effects function performs mutation + side effects atomically
- Integration: MCP tool calls effects function and returns clean result

**Verification:** All 6 mutation-heavy tool modules contain zero direct `publish()` or `revalidatePath()` calls.

- [ ] **Unit 3: Enrich agent context with user-scoped data**

**Goal:** Add user identity, recent entities, and working set to the AI agent prompt.

**Requirements:** R2

**Dependencies:** None

**Files:**
- Modify: `src/ai/agent.ts` (lines 341-472)
- Create: `src/ai/user-context.ts`

**Approach:**
- Create `getUserContext(sessionId)` that returns: recent entity IDs viewed (from chat session messages), active filters (from session metadata if available), placeholder userId
- Add to `buildSystemPrompt()` after workspace context
- Keep it lightweight — max 10 lines of context text

**Test scenarios:**
- Happy path: system prompt includes user context section when data available
- Edge case: graceful degradation when no session history exists

**Verification:** `buildSystemPrompt()` output includes "Gebruikerscontext:" section.

- [ ] **Unit 4: Move scoring/search thresholds to settings-backed config**

**Goal:** Replace hardcoded constants with settings-backed values.

**Requirements:** R3

**Dependencies:** None

**Files:**
- Modify: `src/services/jobs/hybrid-search-policy.ts` (lines 8-16)
- Modify: `src/services/jobs/detail-page.ts` (lines 8-10)
- Modify: `src/ai/agent.ts` (lines 452-459)
- Modify: `src/services/settings.ts` (add new setting keys)

**Approach:**
- Add setting keys: `scoringSkillWeight`, `scoringLocationWeight`, `scoringRateWeight`, `scoringRoleWeight`, `autoMatchTopN`, `autoMatchMinScore`, `searchVectorMinScore`
- Provide sensible defaults matching current constants
- Settings service already has `getAllSettings()` — extend the schema
- Hybrid search policy reads from settings (with fallback to current constants)
- Agent prompt renders settings values (already done for some)

**Test scenarios:**
- Happy path: changing a setting value changes search/matching behavior
- Edge case: missing setting key falls back to default constant

**Verification:** No hardcoded scoring constants remain in tool/service files. `pnpm test` passes.

- [ ] **Unit 5: Normalize delete feedback + audit legacy route**

**Goal:** Every delete path follows consistent pattern. Remove or document legacy route.

**Requirements:** R4, R5

**Dependencies:** Unit 1 (effects pattern established)

**Files:**
- Modify: `src/mcp/tools/chat-sessions.ts` (lines 71-76, add publish/revalidate)
- Modify: `app/api/candidates/[id]/route.ts` (legacy English route)
- Verify: all other delete handlers in MCP tools

**Approach:**
- `verwijder_chat_sessie`: add `publish("chat_session:deleted", { id })` + `revalidatePath`
- Legacy route: if it duplicates Dutch route functionality, add redirect or remove. If it serves a different consumer (external API), document and keep.
- Audit all delete handlers: verify each does mutate → publish → revalidate → return confirmation

**Test scenarios:**
- Happy path: deleting a chat session publishes event and revalidates
- Integration: UI DataRefreshListener receives delete events

**Verification:** `grep -r 'deletedAt\|deleteJob\|deleteCandidate' src/mcp/tools/` shows every delete calls an effects function.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Effects extraction breaks existing event flow | Keep exact same publish() calls, just move them |
| Settings migration causes scoring regression | Default values match current constants exactly |
| Legacy route removal breaks external consumers | Check git blame and usage before removing |

## Sources & References

- Agent-native audit findings from this session
- Existing patterns: `runCandidateDerivedSync()`, `scheduleDedupeRanksRefresh()`
- Settings service: `src/services/settings.ts`
