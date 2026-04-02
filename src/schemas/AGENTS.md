<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# schemas

## Purpose
Typed validation contracts for APIs, matching flows, settings, scraper analysis, and related AI/domain features.

## Key Files
| File | Description |
|------|-------------|
| `job.ts` | Vacancy-focused schema definitions. |
| `matching.ts` | Matching request/response validation. |
| `koppeling.ts` | Linkage-related schema definitions. |
| `settings.ts` | Settings validation contracts. |
| `platform-catalog.ts` | Platform onboarding and catalog schemas. |
| `whatsapp.ts` | WhatsApp workflow validation. |

## For AI Agents

### Working In This Directory
- Keep schemas source-of-truth; update downstream callers and tests together.
- Prefer extending existing schemas over creating subtly overlapping alternatives.
- Be mindful of Dutch API surfaces even when schema field names are English.

### Testing Requirements
- Update corresponding schema and route tests in `tests/`.
- Run `pnpm lint` and targeted Vitest coverage.

### Common Patterns
- Zod schemas exported for reuse by routes, services, and tools.
- Domain-focused files rather than one giant schema index.

## Dependencies

### Internal
- Used heavily by `app/api/`, `src/services/`, `src/ai/`, and `src/mcp/`.

### External
- `zod`.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
