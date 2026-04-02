<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# src

## Purpose
Core application code outside the App Router surface. This directory contains domain services, AI systems, database access, schemas, MCP and voice agents, autopilot infrastructure, and shared runtime utilities.

## Key Files
| File | Description |
|------|-------------|
| `env.ts` | Central environment variable loading and validation entry point. |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `services/` | Main business logic and orchestration; see `services/AGENTS.md`. |
| `ai/` | Chat agent prompt and tool registry; see `ai/AGENTS.md`. |
| `mcp/` | MCP server implementation; see `mcp/AGENTS.md`. |
| `voice-agent/` | LiveKit voice agent runtime; see `voice-agent/AGENTS.md`. |
| `autopilot/` | Autopilot analysis, evidence, persistence, and reporting; see `autopilot/AGENTS.md`. |
| `db/` | Drizzle schema and Neon connection; see `db/AGENTS.md`. |
| `schemas/` | Zod schemas for API and domain validation; see `schemas/AGENTS.md`. |
| `lib/` | Shared helpers and infrastructure utilities. |
| `hooks/` | React hooks shared across the app. |
| `cli/` | CLI-facing integration code. |

## For AI Agents

### Working In This Directory
- Read the existing subsystem conventions before editing a deep feature area.
- Keep service and protocol boundaries clean: route code in `app/`, domain logic in `src/services/`, transport code in `src/mcp/` or `app/api/`.
- Favor minimal edits to existing modules rather than introducing parallel abstractions.

### Testing Requirements
- Add or update Vitest coverage for behavior changes, especially in services and schemas.
- Run `pnpm lint`; run targeted tests for the subsystem you touched.

### Common Patterns
- Zod for validation, Drizzle for persistence, AI SDK model wrappers for LLM access.
- Separate runtime surfaces reuse the same domain services.

## Dependencies

### Internal
- Consumed by both `app/` and standalone subprojects like `agent/` and `extension/` where applicable.

### External
- Drizzle ORM, Neon PostgreSQL, Vercel AI SDK, LiveKit, and Zod.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
