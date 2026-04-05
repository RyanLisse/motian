<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# chat

## Purpose
Chat feature components for the recruiter-facing AI experience. This includes page composition, message rendering, tool-call rendering, session persistence helpers, voice-session support, and widget/full-page chat surfaces.

## Key Files
| File | Description |
|------|-------------|
| `chat-page-content.tsx` | Main full-page chat composition. |
| `chat-messages.tsx` | Message list rendering. |
| `chat-tool-call.tsx` | Tool call visualization in chat. |
| `chat-history-sidebar.tsx` | Session history sidebar UI. |
| `chat-widget.tsx` | Embedded/widget chat surface. |
| `chat-session-storage.ts` | Session persistence helpers. |
| `voice-session.tsx` | Voice session UI integration. |
| `use-chat-thread.ts` | Chat-thread state hook. |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `genui/` | Rich tool/UI rendering helpers for chat output. |

## For AI Agents

### Working In This Directory
- Keep session/context behavior aligned with `/api/chat` and chat-session APIs.
- Preserve Dutch UI copy and stable tool-name/rendering coupling for GenUI surfaces.
- Be careful with persistence keys and voice/chat interaction overlap.

### Testing Requirements
- Run chat UI, history, session, and widget-related tests plus `pnpm lint`.

### Common Patterns
- Feature-specific components around shared AI elements and app primitives.
- Mixture of UI components and small local state helpers/hooks.

## Dependencies

### Internal
- `app/chat/`
- `src/components/ai-elements/`
- `/api/chat` and chat-session APIs

### External
- React and Vercel AI SDK-facing UI patterns.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
