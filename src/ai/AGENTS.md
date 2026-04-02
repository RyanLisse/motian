<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# ai

## Purpose
Main chat-agent definition for the web application. This subsystem owns the system prompt, tool registry wiring, and model-facing orchestration for the recruiter chat experience.

## Key Files
| File | Description |
|------|-------------|
| `agent.ts` | Central chat agent configuration and system prompt builder. |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `tools/` | Tool definitions exposed to the chat agent. |

## For AI Agents

### Working In This Directory
- Keep prompts and tool wiring aligned with real service capabilities.
- Prefer reusing service-layer behavior instead of implementing business logic directly in tools.
- Be careful with model names and provider wrappers; this repo centralizes model access patterns elsewhere in `src/lib/`.

### Testing Requirements
- Update prompt or tool regression tests in `tests/` when behavior changes.
- Run `pnpm lint` and targeted AI/agent tests.

### Common Patterns
- Thin tool wrappers over `src/services/`.
- System prompt composition with Dutch user-facing behavior and explicit tool constraints.

## Dependencies

### Internal
- `src/services/` for tool execution.
- `src/schemas/` for typed inputs and validation.

### External
- Vercel AI SDK and configured model providers.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
