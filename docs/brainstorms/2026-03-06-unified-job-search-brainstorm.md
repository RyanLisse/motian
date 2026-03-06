date: 2026-03-06
topic: unified-job-search

# Unified Job Search

## What We're Building
We are standardizing vacature search so the web UI, chat agent, MCP server, and voice agent all return the same results in the same order for the same input. The product truth becomes the agent's current hybrid search behavior rather than the sidebar's custom search route.

The search experience should no longer depend on which surface initiated the request. A user typing a query in the opdrachten search bar should see the same matching set, ranking, and filter behavior as an agent calling vacature search tools with equivalent parameters.

## Why This Approach
We considered three directions: keeping separate search paths with shared fragments, routing everything through one HTTP endpoint, or using one shared service layer as the sole source of truth. We chose the shared service-layer approach because it preserves the current architecture while eliminating ranking drift.

This is the minimum design that satisfies the requirement for identical results across surfaces. Separate routes or partial query sharing would still allow subtle differences in filtering, normalization, pagination, or ranking order.

## Key Decisions
- Single source of truth: one shared vacature search service will own normalization, hybrid search, filtering, sorting, pagination, and final ordering.
- Agent parity as product truth: the UI will adopt the same hybrid search behavior and ranking model currently used by the agent-facing vacature tools.
- Thin adapters only: UI routes, chat tools, MCP tools, and voice tools should delegate to the shared search service instead of embedding their own search SQL.
- Identical ordering requirement: same input and filters must produce the same ordered result list across UI, chat, MCP, and voice.
- Remove search drift: the dedicated sidebar search path should be removed or reduced to a thin adapter over the shared service contract.

## Resolved Questions
- Should the UI use the same search logic as the agent? Yes.
- Should the ranking and ordering also be identical across all surfaces? Yes.
- Which architectural direction should we choose? Approach A: one shared search service with all surfaces delegating to it.

## Open Questions
- None.

## Next Steps
-> Run `/prompts:workflows-plan` to produce an implementation plan for consolidating vacature search onto one shared service contract and migrating all surfaces to it.
