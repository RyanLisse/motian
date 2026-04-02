<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# db

## Purpose
Shared database workspace package exposing reusable schema and connection helpers for other packages or external consumers.

## Key Files
| File | Description |
|------|-------------|
| `package.json` | Export map for package entry points. |
| `src/index.ts` | Main package entry. |
| `src/schema.ts` | Shared schema export. |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `scripts/` | Package-local maintenance or generation scripts. |
| `src/` | Source files exported by the package. |

## For AI Agents

### Working In This Directory
- Keep exports stable unless all downstream import sites are updated.
- Coordinate schema-level changes with the root app DB layer and migration expectations.

### Testing Requirements
- Run relevant DB and package tests from the repo root plus `pnpm lint`.

### Common Patterns
- Minimal workspace package with direct source exports.

## Dependencies

### Internal
- Related to `src/db/` in the main app.

### External
- `drizzle-orm` and `pg`.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
