<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# events

## Purpose
Server-sent event stream endpoint for live updates to the product surfaces.

## Key Files
| File | Description |
|------|-------------|
| `route.ts` | SSE stream route. |

## For AI Agents

### Working In This Directory
- Be careful with stream shape, retry behavior, and connection lifecycle assumptions.

### Testing Requirements
- Run event-stream or realtime-related tests and `pnpm lint`.

## Dependencies

### Internal
- Event/realtime service support in the app.

### External
- Next.js route handlers and SSE semantics.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
