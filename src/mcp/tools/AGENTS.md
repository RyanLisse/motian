<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# tools

## Purpose
MCP tool implementations for external IDE, CLI, and automation clients. This directory mirrors most major Motian domain capabilities through protocol-safe tool handlers.

## Key Files
| File | Description |
|------|-------------|
| `index.ts` | Central MCP tool export surface. |
| `kandidaten.ts` | Candidate MCP tools. |
| `vacatures.ts` | Vacancy MCP tools. |
| `matches.ts` | Match MCP tools. |
| `gdpr-ops.ts` | GDPR operations for MCP clients. |
| `platforms.ts` | Platform onboarding/config tools. |
| `salesforce-feed.ts` | Salesforce XML feed tool parity. |
| `workspace.ts` | Workspace-level summary and coordination tools. |

## For AI Agents

### Working In This Directory
- Maintain parity with service and API behavior where possible.
- Be careful with parameter and result stability because external clients consume these contracts directly.
- Avoid transport-specific logic leaking into the underlying domain services.

### Testing Requirements
- Update MCP-specific tests in `tests/` whenever tool shapes or semantics change.
- Run `pnpm lint` and targeted MCP tests.

### Common Patterns
- Domain-grouped tool files.
- Shared response shapes built on top of service-layer results.

## Dependencies

### Internal
- `src/services/`
- `src/schemas/`
- `src/mcp/server.ts`

### External
- MCP SDK contracts and server runtime.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
