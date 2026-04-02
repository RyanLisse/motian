<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# agent

## Purpose
Standalone voice-agent subproject packaged separately from the main app. It can be installed independently and bundles a LiveKit-based voice runtime.

## Key Files
| File | Description |
|------|-------------|
| `package.json` | Standalone scripts and runtime dependencies. |
| `README.md` | Local setup, commands, and troubleshooting. |
| `vite.config.ts` | Build configuration targeting Node 22. |
| `tsconfig.json` | TypeScript config for the subproject. |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `src/` | Voice-agent source files; see `src/AGENTS.md`. |
| `dist/` | Built output; do not hand-edit. |

## For AI Agents

### Working In This Directory
- Treat this as a standalone package with its own install/build loop.
- Do not hand-edit generated `dist/` output.
- Keep runtime env expectations consistent with the README and the root project’s voice guidance.

### Testing Requirements
- Run the relevant local script (`pnpm build`, `pnpm dev`, or `pnpm start`) when changing package runtime behavior.
- Run root-level `pnpm lint` if shared code is affected.

### Common Patterns
- Vite-bundled Node runtime.
- Minimal standalone wrapper around the voice-agent functionality.

## Dependencies

### Internal
- Mirrors some assumptions from `src/voice-agent/` in the main app.

### External
- `@livekit/agents`, Google plugin, Silero plugin, Vite, and TypeScript.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
