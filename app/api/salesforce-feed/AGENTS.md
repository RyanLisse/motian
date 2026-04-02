<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# salesforce-feed

## Purpose
Read-only XML feed route for Salesforce pull integrations.

## Key Files
| File | Description |
|------|-------------|
| `route.ts` | Salesforce feed route. |

## For AI Agents

### Working In This Directory
- Preserve XML shape and auth behavior; external integrations may parse it rigidly.

### Testing Requirements
- Run Salesforce feed tests and `pnpm lint`.

## Dependencies

### Internal
- `src/services/salesforce-feed.ts`

### External
- Next.js route handlers and XML serialization behavior.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
