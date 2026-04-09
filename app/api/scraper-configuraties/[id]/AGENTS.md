<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# [id]

## Purpose
Scraper configuration detail route keyed by configuration ID.

## Key Files
| File | Description |
|------|-------------|
| `route.ts` | Scraper configuration detail/update endpoint. |

## For AI Agents

### Working In This Directory
- Treat config shape, activation state, and cron behavior as operationally sensitive.
- Keep route behavior aligned with platform onboarding and scrape scheduling services.

### Testing Requirements
- Run scraper-config detail tests and `pnpm lint`.

### Common Patterns
- ID-scoped config mutation route with minimal transport logic.

## Dependencies

### Internal
- platform config and onboarding services in `src/services/`.

### External
- Next.js route handlers.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
