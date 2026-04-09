<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# [id]

## Purpose
Single-match detail route keyed by match ID.

## Key Files
| File | Description |
|------|-------------|
| `route.ts` | Match detail endpoint. |

## For AI Agents

### Working In This Directory
- Preserve match response shape and recommendation semantics because UI and review flows depend on them.

### Testing Requirements
- Run match detail tests and `pnpm lint`.

### Common Patterns
- Thin ID-scoped route over `src/services/matches.ts`.

## Dependencies

### Internal
- `src/services/matches.ts`

### External
- Next.js route handlers.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
