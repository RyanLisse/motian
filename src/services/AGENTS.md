<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# services

## Purpose
Business logic layer for Motian. This is the highest-value domain area, containing scraping, normalization, enrichment, embeddings, matching, applications, interviews, GDPR operations, reporting, and workspace orchestration.

## Key Files
| File | Description |
|------|-------------|
| `jobs.ts` | Vacancy service barrel and search/list entry points. |
| `candidates.ts` | Candidate lookup and management logic. |
| `matches.ts` | Match persistence and retrieval. |
| `applications.ts` | Application workflow orchestration. |
| `interviews.ts` | Interview scheduling and feedback logic. |
| `gdpr.ts` | GDPR export/deletion and audit operations. |
| `scrape-pipeline.ts` | Scraper orchestration across active platforms. |
| `normalize.ts` | Normalization and upsert behavior for scraped jobs. |
| `ai-enrichment.ts` | AI enrichment pipeline for scraped content. |
| `embedding.ts` | Embedding generation logic. |
| `structured-matching.ts` | AI-structured candidate-vacancy match evaluation. |
| `match-judge.ts` | Independent AI verdict layer for matches. |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `jobs/` | Vacancy service modules split by concern. |
| `scrapers/` | Platform-specific scraper implementations. |
| `search-index/` | Search index integration helpers. |

## For AI Agents

### Working In This Directory
- Read the whole execution path before changing core workflows; many APIs and tools share these functions.
- Keep services transport-agnostic so `app/api`, chat tools, MCP tools, and voice surfaces can all reuse them.
- Avoid introducing duplicate service entry points when a targeted extension to an existing module is sufficient.

### Testing Requirements
- Service changes should come with targeted Vitest updates in `tests/`.
- Run `pnpm lint` and the relevant service or integration suites.

### Common Patterns
- Thin route/tool layers calling service functions.
- Domain modules by entity or workflow.
- AI-assisted workflows layered on top of deterministic preprocessing and persistence.

## Dependencies

### Internal
- `src/db/` for persistence.
- `src/schemas/` for validation contracts.
- Consumed by `app/api/`, `src/ai/`, `src/mcp/`, `src/voice-agent/`, and `trigger/`.

### External
- Drizzle ORM, AI providers through the repo’s model wrappers, and platform-specific scraping libraries.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
