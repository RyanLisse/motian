<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# matches

## Purpose
Match API routes covering retrieval, generation, automation, and structured matching workflows.

## Key Files
| File | Description |
|------|-------------|
| `route.ts` | Main match collection route. |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `[id]/` | Match detail routes. |
| `auto/` | Automatic matching endpoints. |
| `genereren/` | Match generation endpoints. |
| `structured/` | Structured matching endpoints. |

## For AI Agents

### Working In This Directory
- Keep recommendations, scores, and match contracts aligned with service-layer behavior.

### Testing Requirements
- Run match and structured-matching route tests plus `pnpm lint`.

## Dependencies

### Internal
- `src/services/matches.ts`
- `src/services/structured-matching.ts`
- `src/services/auto-matching.ts`

### External
- Next.js route handlers.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
