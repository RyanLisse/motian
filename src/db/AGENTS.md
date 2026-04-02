<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# db

## Purpose
Database access layer for the main app. This directory defines the Neon/Drizzle connection and the canonical application schema.

## Key Files
| File | Description |
|------|-------------|
| `schema.ts` | Main Drizzle schema for Motian tables and indexes. |
| `index.ts` | Database connection and shared DB exports. |

## For AI Agents

### Working In This Directory
- Treat schema changes as high risk and coordinate with migration strategy.
- Do not change table contracts casually; many services, APIs, and tests depend on them.
- Prefer reading all affected query and service code before modifying DB definitions.

### Testing Requirements
- Run `pnpm exec tsc --noEmit`, `pnpm lint`, and the relevant DB/schema tests after changes.
- If schema changes are intentional, verify migration tooling expectations in `drizzle/`.

### Common Patterns
- Drizzle schema definitions in one file and connection wiring in another.
- Soft-delete and vector-search-aware columns are common cross-cutting conventions.

## Dependencies

### Internal
- `src/services/` consumes the DB layer heavily.
- `packages/db/` mirrors related database exports for workspace reuse.

### External
- `drizzle-orm`.
- Neon PostgreSQL with `pgvector`.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
