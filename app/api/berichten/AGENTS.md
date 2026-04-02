<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# berichten

## Purpose
Communication/message API routes linked to application workflows.

## Key Files
| File | Description |
|------|-------------|
| `route.ts` | Main message collection route. |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `[id]/` | Message detail routes. |

## For AI Agents

### Working In This Directory
- Preserve direction/channel semantics because reporting and recruiter workflows depend on them.

### Testing Requirements
- Run message route tests and `pnpm lint`.

## Dependencies

### Internal
- `src/services/messages.ts`

### External
- Next.js route handlers.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
