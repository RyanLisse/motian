<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# [id]

## Purpose
Message detail route keyed by message ID.

## Key Files
| File | Description |
|------|-------------|
| `route.ts` | Message detail endpoint. |

## For AI Agents

### Working In This Directory
- Keep message direction/channel/body semantics stable for recruiter workflow and reporting views.

### Testing Requirements
- Run message detail tests and `pnpm lint`.

### Common Patterns
- Thin ID-scoped route over message services.

## Dependencies

### Internal
- `src/services/messages.ts`

### External
- Next.js route handlers.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
