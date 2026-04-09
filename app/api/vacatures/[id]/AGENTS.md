<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# [id]

## Purpose
Vacancy detail API routes keyed by vacancy ID. This folder handles vacancy detail retrieval and vacancy-scoped linking, raw data access, and candidate matching actions.

## Key Files
| File | Description |
|------|-------------|
| `route.ts` | Main vacature detail route. |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `koppel/` | Vacancy-to-candidate linking routes. |
| `match-kandidaten/` | Vacancy-scoped candidate matching routes. |
| `raw/` | Raw vacancy payload/debug data route. |

## For AI Agents

### Working In This Directory
- Keep detail behavior and action routes aligned with vacancy service modules.
- Treat `raw/` outputs as compatibility-sensitive for debugging and operator workflows.

### Testing Requirements
- Run vacancy detail and matching route tests plus `pnpm lint`.

### Common Patterns
- ID-scoped detail route with a few tightly related action subroutes.

## Dependencies

### Internal
- `src/services/jobs.ts`
- vacancy matching and linking services.

### External
- Next.js route handlers.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
