<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# scraper-configuraties

## Purpose
Scraper runtime configuration API routes for platform-level scraping setup and updates.

## Key Files
| File | Description |
|------|-------------|
| `route.ts` | Main scraper configuration collection route. |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `[id]/` | Config detail/update routes. |
| `platform/` | Platform-specific config routes. |

## For AI Agents

### Working In This Directory
- Preserve platform slug and cron-expression semantics; they affect background jobs directly.

### Testing Requirements
- Run scraper configuration tests and `pnpm lint`.

## Dependencies

### Internal
- `src/services/platform-onboarding.ts`
- scraper and platform configuration services.

### External
- Next.js route handlers.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
