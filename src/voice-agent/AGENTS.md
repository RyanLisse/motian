<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# voice-agent

## Purpose
Realtime voice agent runtime for Motian using LiveKit and Gemini native audio. This subsystem provides spoken interaction backed by direct service imports instead of HTTP hops.

## Key Files
| File | Description |
|------|-------------|
| `main.ts` | Voice agent process entry point. |
| `agent.ts` | Motian voice agent behavior and tool wiring. |
| `env.ts` | Voice-agent-specific environment loading. |

## For AI Agents

### Working In This Directory
- Preserve low-latency behavior; avoid unnecessary indirection or network calls when direct service access already exists.
- Be careful with environment and provider configuration because runtime failures surface only when the agent boots.
- Keep spoken UX Dutch-aligned where the agent talks to recruiters.

### Testing Requirements
- Run `pnpm lint` and targeted voice-agent tests in `tests/`.
- If behavior changes are significant, verify the standalone `agent/` package if the same assumptions apply there.

### Common Patterns
- Direct service imports for tools.
- Runtime-specific env handling and provider wiring separate from the web chat agent.

## Dependencies

### Internal
- `src/services/` for platform operations.
- `src/lib/` and shared env helpers where needed.

### External
- LiveKit Agents.
- Gemini native audio integration.
- Silero VAD.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
