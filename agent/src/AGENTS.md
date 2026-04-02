<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# src

## Purpose
Source files for the standalone voice-agent package.

## Key Files
| File | Description |
|------|-------------|
| `main.ts` | CLI/runtime entry point for the packaged agent. |
| `agent.ts` | Voice-agent behavior definition. |
| `tools.ts` | Tool wiring used by the standalone runtime. |

## For AI Agents

### Working In This Directory
- Keep this package aligned with the root voice-agent assumptions without introducing unnecessary divergence.
- Prefer explicit runtime-safe imports because this code is bundled and executed outside the web app.

### Testing Requirements
- Run the standalone package build or dev command when changing source behavior.

### Common Patterns
- Small entrypoint + behavior + tool split.

## Dependencies

### Internal
- Related conceptually to `src/voice-agent/` in the main app.

### External
- LiveKit agent libraries and TypeScript runtime build tooling.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
