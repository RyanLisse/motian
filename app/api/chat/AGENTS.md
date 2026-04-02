<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# chat

## Purpose
Chat API surface for streaming recruiter conversations, helper logic, and feedback capture.

## Key Files
| File | Description |
|------|-------------|
| `route.ts` | Main chat streaming endpoint. |
| `_helpers.ts` | Shared chat-route helpers. |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `feedback/` | Chat feedback-related route handling. |

## For AI Agents

### Working In This Directory
- Keep chat route logic thin and rely on `src/ai/` plus services for behavior.
- Streaming behavior is sensitive; avoid unnecessary response-shape changes.

### Testing Requirements
- Run targeted chat API and UI tests plus `pnpm lint`.

## Dependencies

### Internal
- `src/ai/`
- `src/services/chat-sessions.ts`

### External
- Next.js route handlers and AI SDK streaming.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
