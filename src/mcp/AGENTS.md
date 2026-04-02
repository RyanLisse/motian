<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# mcp

## Purpose
Model Context Protocol server implementation for Motian. This subsystem exposes the platform’s capabilities to IDEs, CLIs, and other MCP-compatible clients.

## Key Files
| File | Description |
|------|-------------|
| `server.ts` | Primary stdio MCP server entry point. |
| `create-server.ts` | Server construction helper used by runtime surfaces. |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `tools/` | MCP tool implementations grouped by domain. |

## For AI Agents

### Working In This Directory
- Keep MCP tool contracts aligned with existing service behavior and route parity.
- Avoid duplicating domain logic inside tool handlers.
- Be careful with transport-level changes because CLI, HTTP, and IDE integrations may depend on them.

### Testing Requirements
- Update MCP-specific tests in `tests/` whenever tool schemas or behavior changes.
- Run `pnpm lint` and targeted MCP coverage.

### Common Patterns
- Tool handlers map almost directly to service-layer functions.
- Stdio-first server setup with shared creation helpers.

## Dependencies

### Internal
- `src/services/` for domain execution.
- `src/schemas/` for validation contracts.

### External
- `@modelcontextprotocol/sdk` and related protocol helpers.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
