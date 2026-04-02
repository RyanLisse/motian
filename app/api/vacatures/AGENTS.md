<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# vacatures

## Purpose
Vacancy API routes for collection access, detail operations, and search-specific endpoints.

## Key Files
| File | Description |
|------|-------------|
| `route.ts` | Main vacature collection route. |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `[id]/` | Vacancy detail and mutation routes. |
| `zoeken/` | Vacancy search endpoint group. |

## For AI Agents

### Working In This Directory
- Use vacatures terminology in routes and responses intended for the product surface.
- Search behavior should stay aligned with the vacancy service modules.

### Testing Requirements
- Run vacancy route/search tests and `pnpm lint`.

## Dependencies

### Internal
- `src/services/jobs.ts` and `src/services/jobs/`

### External
- Next.js route handlers.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
