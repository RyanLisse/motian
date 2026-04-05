<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# [id]

## Purpose
Interview detail route keyed by interview ID.

## Key Files
| File | Description |
|------|-------------|
| `route.ts` | Interview detail and update endpoint. |

## For AI Agents

### Working In This Directory
- Preserve interview status, scheduling, and feedback semantics across API and UI.

### Testing Requirements
- Run interview detail tests and `pnpm lint`.

### Common Patterns
- ID-scoped CRUD-like route over the interview service layer.

## Dependencies

### Internal
- `src/services/interviews.ts`

### External
- Next.js route handlers.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
