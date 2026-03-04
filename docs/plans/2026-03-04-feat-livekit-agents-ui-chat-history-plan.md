---
title: "feat: LiveKit Agents UI + Chat History"
type: feat
date: 2026-03-04
---

# feat: LiveKit Agents UI + Chat History

## Overview

Upgrade the Motian AI chat experience with two complementary features:
1. **Chat History** — Enable persistent conversations with session management, history sidebar, and session resumption
2. **LiveKit Agents UI** — Add LiveKit's open-source shadcn component library for polished agent interfaces with optional voice mode

## Problem Statement

**Chat History**: The `chatSessions` table and persistence logic already exist in the API route (`app/api/chat/route.ts:49-68`) but are **dead code** — neither `ChatPanel` nor `ChatPageContent` sends a `sessionId`. Users lose all conversations on page refresh. There is no way to browse, resume, or delete past conversations.

**Agent UI**: The current chat UI is functional but basic. LiveKit's Agents UI provides production-quality components (audio visualizers, session views, transcript rendering, control bars) built on the same shadcn/ui stack we already use. Voice mode would let recruiters talk to the AI hands-free while reviewing candidates.

## Research Summary

**LiveKit Tweet** (2026-03-03): "Introducing Agents UI, an open-source @shadcn component library for building polished React frontends for your voice agents. Audio visualizers. Media controls. Session management tools. Chat transcripts. All wired to LiveKit Agents. Install via the shadcn CLI and own the code."

**Compatibility**: React 19 ✓, Tailwind CSS 4 ✓, shadcn/ui (new-york) ✓, Next.js 16 ✓

**LiveKit Cloud Free Tier**: 10,000 participant minutes/month, 1 voice AI agent, 1,000 free agent minutes — sufficient for development and early usage.

**Institutional Learnings Applied**:
- 3-layer parity pattern (API schema ↔ AI tool schema ↔ service types) from `docs/solutions/api-schema-gaps/`
- AI SDK 6 `generateText` + `Output.object()` pattern (not deprecated `generateObject`)
- DB-level analytics with PostgreSQL FILTER clauses from scraper analytics solution

---

## Part 1: Chat History (Priority: High)

### What exists today

| Component | Status |
|-----------|--------|
| `chatSessions` table in schema.ts | ✅ Exists with sessionId, messages (jsonb), context, messageCount |
| Unique index on sessionId | ✅ Exists |
| Upsert logic in API route | ✅ Exists but **never triggered** (dead code) |
| Client sends sessionId | ❌ Missing — no sessionId in transport body |
| API to list sessions | ❌ Missing |
| API to retrieve session | ❌ Missing |
| API to delete session | ❌ Missing |
| UI for history sidebar | ❌ Missing |
| Session resumption | ❌ Missing |

### Files to modify

| File | Action | Purpose |
|------|--------|---------|
| `components/chat/chat-panel.tsx` | MODIFY | Add sessionId to transport body, add "nieuw gesprek" button |
| `components/chat/chat-page-content.tsx` | MODIFY | Add sessionId, add history sidebar, session switching |
| `components/chat/chat-history-sidebar.tsx` | **NEW** | Session list component with search, delete, resume |
| `app/api/chat-sessies/route.ts` | **NEW** | GET: list sessions (paginated, recent first) |
| `app/api/chat-sessies/[id]/route.ts` | **NEW** | GET: retrieve session, DELETE: remove session |
| `src/services/chat-sessions.ts` | **NEW** | Service layer: list, get, delete, with typed returns |
| `hooks/use-chat-session.ts` | **NEW** | Client hook: sessionId generation, persistence, switching |

### Session ID Strategy

Generate a `nanoid()` on first message, persist in `sessionStorage` (survives refresh within tab), send with every API call:

```typescript
// hooks/use-chat-session.ts
const SESSION_KEY = "motian-chat-session";

export function useChatSession() {
  const [sessionId, setSessionId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return sessionStorage.getItem(SESSION_KEY) || "";
  });

  const startNewSession = useCallback(() => {
    const id = nanoid();
    sessionStorage.setItem(SESSION_KEY, id);
    setSessionId(id);
    return id;
  }, []);

  const resumeSession = useCallback((id: string) => {
    sessionStorage.setItem(SESSION_KEY, id);
    setSessionId(id);
  }, []);

  return { sessionId, startNewSession, resumeSession };
}
```

### API Endpoints

**GET /api/chat-sessies**
```typescript
// Query params: ?limit=20&offset=0
// Response: { sessions: ChatSessionSummary[], total: number }
type ChatSessionSummary = {
  id: string;
  sessionId: string;
  messageCount: number;
  lastMessage: string; // First 100 chars of last user message
  context: { route?: string; entityType?: string } | null;
  updatedAt: Date;
  createdAt: Date;
};
```

**GET /api/chat-sessies/[id]**
```typescript
// Response: full ChatSession with messages array
```

**DELETE /api/chat-sessies/[id]**
```typescript
// Hard delete — no soft delete needed for chat sessions
```

### History Sidebar UI

In the full-page `/chat` route, add a collapsible left sidebar (280px):

- Header: "Gesprekken" + "Nieuw" button
- Search input (client-side filter by lastMessage)
- Scrollable list of session cards:
  - First line: truncated last user message (bold)
  - Second line: relative time + message count badge
  - Context badge (if entityType present)
  - Hover: delete button (with confirmation)
- Click → resume session (load messages into useChat)
- Active session highlighted

For the FAB panel: simpler approach — just a "Nieuw gesprek" button in the header. No sidebar (too narrow at 400px).

### Session Resumption Flow

1. User clicks a past session in sidebar
2. `useChatSession.resumeSession(id)` updates sessionStorage
3. Fetch full session via `GET /api/chat-sessies/[id]`
4. Pass `initialMessages` to `useChat` hook (AI SDK supports this)
5. New messages append to existing conversation
6. API route upserts with updated messages array

---

## Part 2: LiveKit Agents UI (Priority: Medium)

### Architecture Decision

LiveKit Agents UI components require the LiveKit room context (`@livekit/components-react`). Two integration approaches:

**Option A: Full LiveKit Integration (Recommended)**
- Install LiveKit SDK + Agents UI components
- Create token endpoint for room access
- Build a Node.js LiveKit Agent that wraps existing recruitment tools
- Voice mode toggle in chat UI
- Text + voice in the same LiveKit room

**Option B: UI-Inspired Only**
- Don't install LiveKit at all
- Build similar visual components inspired by Agents UI design
- No voice capabilities

**Decision: Option A** — LiveKit Cloud free tier is generous, and voice mode adds genuine value for recruiters. The shadcn-based components land in our codebase as source files, fully customizable.

### Dependencies to Install

```bash
pnpm add @livekit/components-react livekit-client livekit-server-sdk
```

### LiveKit Components to Install (via shadcn CLI)

```bash
npx shadcn@latest registry add @agents-ui
npx shadcn@latest add @agents-ui/agent-control-bar
npx shadcn@latest add @agents-ui/agent-chat-transcript
npx shadcn@latest add @agents-ui/agent-audio-visualizer-aura
npx shadcn@latest add @agents-ui/agent-session-view
```

### Files to create/modify

| File | Action | Purpose |
|------|--------|---------|
| `app/api/livekit/token/route.ts` | **NEW** | Generate LiveKit room access tokens |
| `components/chat/livekit-session.tsx` | **NEW** | LiveKit room wrapper with connection management |
| `components/chat/voice-toggle.tsx` | **NEW** | Text ↔ Voice mode switch |
| `components/chat/chat-panel.tsx` | MODIFY | Add voice mode toggle, conditionally render LiveKit session |
| `components/chat/chat-page-content.tsx` | MODIFY | Full-page LiveKit session view with agent visualizer |
| `src/lib/livekit.ts` | **NEW** | Server-side LiveKit config + token generation utility |
| `.env.local` | MODIFY | Add LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL |

### Token Endpoint

```typescript
// app/api/livekit/token/route.ts
import { AccessToken } from "livekit-server-sdk";

export async function POST(req: Request) {
  const { roomName } = await req.json();
  const token = new AccessToken(
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
    { identity: `user-${nanoid(8)}` }
  );
  token.addGrant({ room: roomName, roomJoin: true, canPublish: true });
  return Response.json({ token: await token.toJwt() });
}
```

### Voice Mode UX

The chat panel gets a microphone toggle button in the header:

- **Text mode (default)**: Current useChat + DefaultChatTransport, no LiveKit connection
- **Voice mode**: Connect to LiveKit room, show audio visualizer (Aura), agent speaks responses via TTS
- **Hybrid**: Voice input transcribed to text, responses shown as text AND spoken
- Toggle is a simple `<VoiceToggle>` component with Mic/MicOff icon

### LiveKit Agent Backend (Trigger.dev Task)

The LiveKit Agent runs as a Trigger.dev scheduled/dispatched task to keep infrastructure simple:

```typescript
// trigger/livekit-agent.ts
import { task } from "@trigger.dev/sdk";

export const livekitAgentTask = task({
  id: "livekit-recruitment-agent",
  machine: { preset: "small-2x" },
  run: async (payload: { roomName: string }) => {
    // Connect to LiveKit room as agent participant
    // Use existing recruitment tools for responses
    // STT → LLM (gpt-5-nano + tools) → TTS pipeline
  },
});
```

**Note**: The full LiveKit Agent implementation is a larger effort. For MVP, we focus on the UI components in text mode and add voice capabilities as a fast-follow.

---

## Implementation Phases

### Phase 1: Chat History (Core)
1. Create `hooks/use-chat-session.ts` — sessionId management
2. Create `src/services/chat-sessions.ts` — CRUD service
3. Create `app/api/chat-sessies/route.ts` + `[id]/route.ts` — API endpoints
4. Modify `chat-panel.tsx` — add sessionId to transport, "Nieuw" button
5. Create `chat-history-sidebar.tsx` — session list component
6. Modify `chat-page-content.tsx` — add sidebar, session switching
7. Test: create session → refresh → resume → delete

### Phase 2: LiveKit UI Components
1. Install LiveKit dependencies (`@livekit/components-react`, `livekit-client`, `livekit-server-sdk`)
2. Run shadcn CLI to install Agents UI components
3. Create `app/api/livekit/token/route.ts` — token endpoint
4. Create `src/lib/livekit.ts` — server config
5. Create `components/chat/livekit-session.tsx` — room wrapper
6. Create `components/chat/voice-toggle.tsx` — mode switch
7. Modify `chat-page-content.tsx` — integrate LiveKit session view with audio visualizer
8. Add `.env.local` variables for LiveKit Cloud

### Phase 3: Voice Agent (Fast-Follow)
1. Create LiveKit Agent backend (Trigger.dev or standalone Node.js process)
2. Wire existing recruitment tools into the agent
3. STT → LLM → TTS pipeline
4. Test end-to-end voice conversation

---

## Acceptance Criteria

### Chat History
- [ ] Chat messages persist across page refreshes
- [ ] `/chat` page has a sidebar listing past conversations
- [ ] Clicking a past session loads its messages and resumes the conversation
- [ ] "Nieuw gesprek" starts a fresh session
- [ ] Sessions can be deleted with confirmation
- [ ] FAB panel preserves session within the same browser tab
- [ ] API endpoints return proper pagination and error responses

### LiveKit UI
- [ ] Agents UI components installed and rendering
- [ ] Audio visualizer (Aura) shows agent state (connecting, speaking, thinking)
- [ ] Voice toggle in chat header switches between text and voice mode
- [ ] Token endpoint generates valid LiveKit access tokens
- [ ] LiveKit connection handles reconnection gracefully
- [ ] Works in both FAB panel and full-page /chat views

---

## Environment Variables

```env
# LiveKit Cloud (free tier)
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
LIVEKIT_URL=wss://your-project.livekit.cloud
```

---

## References

- [LiveKit Agents UI](https://livekit.io/ui) — Component library
- [Agents UI Docs](https://docs.livekit.io/frontends/agents-ui/) — Installation & API reference
- [Agent Starter React](https://github.com/livekit-examples/agent-starter-react) — Reference implementation
- [LiveKit Agents UI Blog](https://blog.livekit.io/design-voice-ai-interfaces-with-agents-ui/) — Design philosophy
- Internal: `docs/brainstorms/archive/2026-02-22-ai-sidepanel-brainstorm.md` — Original chat design
- Internal: `docs/solutions/api-schema-gaps/agent-ui-parity-kandidaten-20260223.md` — 3-layer parity pattern
