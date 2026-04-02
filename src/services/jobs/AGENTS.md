<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# jobs

## Purpose
Vacancy-domain service modules split by concern. This directory contains the internal implementation for filtering, listing, search, repository access, stats, deduplication, and page-specific vacancy queries.

## Key Files
| File | Description |
|------|-------------|
| `repository.ts` | Core data access for vacancies. |
| `search.ts` | Vacancy search implementation. |
| `filters.ts` | Search/list filter shaping. |
| `list.ts` | Vacancy list retrieval helpers. |
| `stats.ts` | Vacancy statistics aggregation. |
| `detail-page.ts` | Vacancy detail-page assembly logic. |
| `deduplication.ts` | Deduplication behavior for vacancies. |
| `hybrid-search-policy.ts` | Search policy decisions for hybrid retrieval. |

## For AI Agents

### Working In This Directory
- Keep query-building, repository access, and page composition concerns separated.
- Search behavior is regression-sensitive; prefer minimal targeted edits.

### Testing Requirements
- Run vacancy search/list/detail tests in `tests/` and `pnpm lint`.

### Common Patterns
- Small focused modules under a shared vacancy domain.

## Dependencies

### Internal
- `src/db/`
- Parent module `src/services/jobs.ts`

### External
- Drizzle query building and search infrastructure.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
