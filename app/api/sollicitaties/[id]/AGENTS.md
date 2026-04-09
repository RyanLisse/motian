<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# [id]

## Purpose
Application detail route keyed by application ID.

## Key Files
| File | Description |
|------|-------------|
| `route.ts` | Application detail and mutation endpoint. |

## For AI Agents

### Working In This Directory
- Keep stage transitions and detail payloads aligned with the application workflow service.

### Testing Requirements
- Run application detail tests and `pnpm lint`.

### Common Patterns
- ID-scoped route delegating to application workflow services.

## Dependencies

### Internal
- `src/services/applications.ts`

### External
- Next.js route handlers.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
