<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# packages

## Purpose
Workspace packages that extract reusable database, ESCO, and scraper functionality away from the main app runtime.

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `db/` | Shared database package; see `db/AGENTS.md`. |
| `esco/` | ESCO import and scoring package; see `esco/AGENTS.md`. |
| `scrapers/` | Shared scraper adapters and registries; see `scrapers/AGENTS.md`. |

## For AI Agents

### Working In This Directory
- Treat packages as semi-independent modules with their own public exports.
- Be careful changing exports because both app code and other packages may consume them.

### Testing Requirements
- Run the package-relevant tests in `tests/` and `pnpm lint` from the repo root.

### Common Patterns
- Small workspace packages with `src/index.ts` exports and focused responsibilities.

## Dependencies

### Internal
- Consumed by the main app and related tooling.

### External
- TypeScript workspace package conventions under pnpm.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
