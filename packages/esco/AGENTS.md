<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# esco

## Purpose
Workspace package for ESCO data import, backfill, normalization, and related scoring helpers.

## Key Files
| File | Description |
|------|-------------|
| `package.json` | Export map for ESCO package entry points. |
| `src/index.ts` | Main package export surface. |
| `src/esco-import.ts` | ESCO import workflow logic. |
| `src/esco-backfill.ts` | ESCO backfill helpers. |
| `src/escape-like.ts` | Shared string escaping helper. |

## For AI Agents

### Working In This Directory
- Keep ESCO-specific logic centralized here instead of scattering it back into app services.
- Coordinate changes with app-level ESCO tests and any DB assumptions.

### Testing Requirements
- Run ESCO-focused tests from `tests/` and `pnpm lint` from the repo root.

### Common Patterns
- Small focused exports around import and scoring workflows.

## Dependencies

### Internal
- Depends on `@motian/db`.
- Consumed by ESCO-related service code and tests in the root app.

### External
- `drizzle-orm`.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
