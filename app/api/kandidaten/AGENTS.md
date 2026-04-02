<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# kandidaten

## Purpose
Candidate API routes for listing, creation, detail access, and intake-specific workflows.

## Key Files
| File | Description |
|------|-------------|
| `route.ts` | Main kandidaat collection route. |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `[id]/` | Candidate detail and mutation routes. |
| `intake/` | Candidate intake-specific route flow. |

## For AI Agents

### Working In This Directory
- Preserve Dutch route naming and candidate terminology (`kandidaten`).
- Reuse candidate services instead of adding route-local data logic.

### Testing Requirements
- Run candidate API tests and `pnpm lint`.

## Dependencies

### Internal
- `src/services/candidates.ts`
- candidate-related schemas and shared API helpers.

### External
- Next.js route handlers and Zod-backed validation.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
