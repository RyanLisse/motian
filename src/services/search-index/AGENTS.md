<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# search-index

## Purpose
Optional external search-index integration layer, currently centered on Typesense clients, schemas, document shaping, sync, and query execution.

## Key Files
| File | Description |
|------|-------------|
| `typesense-client.ts` | Typesense client setup. |
| `typesense-schema.ts` | Index schema definitions. |
| `typesense-documents.ts` | Document mapping logic for search sync. |
| `typesense-search.ts` | Search query execution against Typesense. |
| `typesense-sync.ts` | Sync/update orchestration. |

## For AI Agents

### Working In This Directory
- Preserve PostgreSQL-first fallback assumptions from the main app.
- Keep index schema and document mapping in sync when fields change.

### Testing Requirements
- Run Typesense-related tests in `tests/` and `pnpm lint`.

### Common Patterns
- Separate client, schema, document, search, and sync modules.

## Dependencies

### Internal
- Consumed by search and indexing flows in `src/services/`.

### External
- Typesense integration libraries and external search infrastructure.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
