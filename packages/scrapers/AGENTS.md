<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# scrapers

## Purpose
Workspace package for reusable scraper adapters, public job board integrations, platform definitions, and registry logic.

## Key Files
| File | Description |
|------|-------------|
| `package.json` | Package exports and runtime dependencies. |
| `src/index.ts` | Main package export surface. |
| `src/platform-definitions.ts` | Canonical platform definitions. |
| `src/platform-registry.ts` | Registry and platform lookup logic. |
| `src/dynamic-adapter.ts` | Dynamic adapter support for new scraper flows. |
| `src/public-job-board.ts` | Shared public job board scraper behavior. |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `src/lib/` | Shared scraper helpers. |

## For AI Agents

### Working In This Directory
- Prefer shared adapter logic here over duplicating scraper behavior in the app.
- Scraper changes often affect tests broadly; check registry, adapter, and platform-specific suites.

### Testing Requirements
- Run relevant scraper tests in `tests/` and `pnpm lint` from the repo root.

### Common Patterns
- One file per platform plus shared registry and adapter helpers.
- Platform definitions exported for both runtime logic and onboarding analysis.

## Dependencies

### Internal
- Consumed by scraping and platform analysis flows in the main app.

### External
- `playwright`, `modal`, and `zod`.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
