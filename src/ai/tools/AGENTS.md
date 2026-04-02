<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# tools

## Purpose
Tool definitions exposed to the web chat agent. These files map recruiter intents to service-layer operations across jobs, candidates, matches, interviews, GDPR, scraping, and structured matching.

## Key Files
| File | Description |
|------|-------------|
| `index.ts` | Central export surface for AI tools. |
| `query-opdrachten.ts` | Vacancy search/query tool. |
| `kandidaten.ts` | Candidate-facing tool definitions. |
| `matches.ts` | Match-related tools. |
| `sollicitaties.ts` | Application workflow tools. |
| `structured-match.ts` | Structured matching tool entry. |
| `trigger-scraper.ts` | Scrape trigger tool. |
| `semantic-search.ts` | Semantic retrieval/search tool. |

## For AI Agents

### Working In This Directory
- Keep tool descriptions and schemas aligned with actual service behavior.
- Prefer one clear tool per user intent instead of overlapping variants.
- Preserve Dutch user-facing semantics even if file names mix Dutch and English.

### Testing Requirements
- Update AI tool or chat regression tests in `tests/` when changing tool signatures or outputs.
- Run `pnpm lint` and targeted chat/agent tests.

### Common Patterns
- One tool file per domain capability.
- Thin wrappers over `src/services/` and shared schemas.

## Dependencies

### Internal
- `src/services/`
- `src/schemas/`
- `src/ai/agent.ts`

### External
- Vercel AI SDK tool definitions.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
