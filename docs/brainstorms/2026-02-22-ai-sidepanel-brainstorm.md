# AI Chat Sidepanel — Agent-Native Shell

**Date:** 2026-02-22
**Status:** Brainstorm complete, ready for planning

## What We're Building

A persistent sliding AI chat panel on the right side of the Motian recruitment platform. The panel is **agent-native** — it uses an AI SDK 6 `ToolLoopAgent` with custom recruitment tools, giving it full database access, scraper control, and CRUD capabilities. It's context-aware: it knows which page/entity the user is viewing and offers relevant actions.

### Core Concept

- **UI**: Right-side sliding panel (~400px), persistent across all pages, toggle via button/hotkey
- **Backend**: AI SDK 6 `ToolLoopAgent` in a Next.js API route (`/api/chat/route.ts`)
- **Hosting**: Runs natively on Vercel — same as the rest of the app, no subprocess or sandbox needed
- **Capabilities**: Full CRUD on all entities, scraper triggers, data queries, bulk operations
- **Context**: Injects current page context (active opdracht, kandidaat, etc.) into each prompt

## Why This Approach

**AI SDK 6 ToolLoopAgent** was chosen over Codex MCP Subprocess and Hybrid approaches because:

1. **Already installed** — `ai@6.0.97`, `@ai-sdk/google`, `@ai-sdk/openai` are already in the project. Zero new infrastructure.
2. **Multi-provider** — Same agent can use Claude for reasoning, GPT for actions, Gemini for review. Not locked into one provider.
3. **Native Next.js** — Agent runs as a regular API route, streams via `useChat()` hook. No subprocess management, no MCP bridging, no Modal sandbox.
4. **Type-safe tools** — Each recruitment operation is a Zod-typed TypeScript function with direct Drizzle access. End-to-end type safety from agent → API → UI via `InferAgentUIMessage`.
5. **Simpler prod story** — Deploys to Vercel like the rest of the app. No cold starts, no sandbox management.

### Trade-offs Accepted

- Must define each tool explicitly (vs. Codex's freeform shell access) — acceptable because recruitment operations are well-scoped
- No raw shell access by default — can add a shell tool later if needed
- Agent reasoning bounded by tool definitions — but tools can compose multi-step operations

### Why Not Codex MCP (Original Choice)

Reconsidered after evaluating `ai-sdk-tools.dev/agents`:
- Codex is OpenAI-only, blocking Claude/Gemini reasoning
- Subprocess management adds operational complexity (cold starts, Modal sandboxing)
- MCP bridging layer between Next.js and Codex is unnecessary when AI SDK runs natively
- The "shell-like" experience can be achieved with well-designed tools that stream progress

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| AI Runtime | AI SDK 6 `ToolLoopAgent` | Already installed, multi-provider, native Next.js |
| UI Pattern | Sliding right panel | Persistent, non-blocking, familiar pattern |
| Hosting | Vercel (same as app) | No separate infra, no subprocess management |
| Capabilities | Full CRUD + scrapers | Recruitment domain tools with direct Drizzle access |
| Context injection | Page-aware prompts | Current route/entity injected per message |
| Streaming | `useChat()` + `streamText` | Native AI SDK streaming with tool call visibility |
| Provider | Anthropic Claude (primary) | Best reasoning; swap per-tool if needed |

## Architecture Sketch

```
Browser (React)                    Server (Next.js API Route)
┌─────────────┐                   ┌──────────────────────────┐
│ ChatPanel   │  ── fetch ──>    │ /api/chat/route.ts       │
│ useChat()   │  <── stream ──   │                          │
│             │                   │ ToolLoopAgent {          │
│ Context:    │                   │   model: claude-sonnet   │
│ - route     │                   │   tools: {               │
│ - entity ID │                   │     queryOpdrachten,     │
│ - selection │                   │     queryKandidaten,     │
│             │                   │     updateKandidaat,     │
│ Cmd+J       │                   │     triggerScraper,      │
│ toggle      │                   │     analyseData,         │
└─────────────┘                   │     matchKandidaten      │
                                  │   }                      │
                                  │   db: drizzle(neon)      │
                                  │ }                        │
                                  └──────────────────────────┘
```

## Tools Design

### Recruitment Tools (Phase 1)

| Tool | Description | DB Access |
|------|-------------|-----------|
| `queryOpdrachten` | Search/filter job listings by criteria | SELECT opdrachten |
| `queryKandidaten` | Search/filter candidates | SELECT kandidaten |
| `getOpdrachtDetail` | Full detail for a specific job | SELECT + JOIN |
| `updateKandidaat` | Update candidate status/availability | UPDATE kandidaten |
| `triggerScraper` | Start a scraper run (Flextender, etc.) | Calls scraper service |
| `analyseData` | Run analytics queries (counts, trends) | SELECT aggregate |
| `matchKandidaten` | Find candidates matching a job (pgvector) | Vector similarity search |

### System Tools (Phase 2)

| Tool | Description |
|------|-------------|
| `runSQL` | Execute arbitrary read-only SQL (power users) |
| `exportCSV` | Export query results as CSV download |
| `bulkUpdate` | Batch update operations with confirmation |

## User Flows

### Flow 1: Context-Aware Query
User is on `/opdrachten/42` (job detail page).
Opens sidepanel: "Welke kandidaten matchen met deze opdracht?"
→ Agent sees context (jobId=42), calls `matchKandidaten(jobId=42)`, returns ranked candidates with match scores.

### Flow 2: Bulk Action
User opens sidepanel from anywhere.
Types: "Start de Flextender scraper en verrijk nieuwe opdrachten"
→ Agent calls `triggerScraper(platform="flextender")`, streams progress, shows new listings.

### Flow 3: Data Analysis
"Hoeveel opdrachten zijn er deze week toegevoegd per platform?"
→ Agent calls `analyseData(query="weekly_additions_by_platform")`, returns summary table.

### Flow 4: CRUD Operation
On kandidaat page: "Markeer deze kandidaat als beschikbaar vanaf maart"
→ Agent calls `updateKandidaat(id=ctx.entityId, beschikbaar_vanaf="2026-03-01")`, confirms change.

## Resolved Questions

| Question | Decision | Rationale |
|----------|----------|-----------|
| Session lifecycle | **Persistent until reset** | Conversation history stored server-side (or in-memory with localStorage backup). Manual reset button in panel header. |
| Streaming UX | **Tool-call stream** | Show tool names + intermediate results as they stream. Gives transparency without raw terminal output. |
| DB access | **Direct Drizzle queries in tools** | Each tool function has direct access to the Drizzle ORM and Neon connection. Type-safe, no raw SQL by default. |
| Hotkey | **Cmd+J** | Free, not used by browsers, easy to reach. |
| Tool sandboxing | Tools are TypeScript functions — sandboxed by definition. Read-only by default, write ops require explicit tool calls. |
| Cost control | To be determined during implementation — start with no limits, add if needed |
| Multi-provider | Claude as primary, option to route specific tools to GPT/Gemini via `callOptionsSchema` |

## Output Format

Tool-call stream with progress indicators:

```
> Scrape Flextender

🔧 triggerScraper(platform: "flextender")
  ↳ Fetching widget config...
  ↳ POST admin-ajax.php → 219 vacatures
  ↳ Enriching batch 1/22...
  ↳ Enriching batch 22/22...
✓ 219 opdrachten verrijkt

3 nieuwe opdrachten gevonden:
1. Adviseur Geluid (Groningen)
2. Data Analist (Utrecht)
3. Projectleider ICT (Den Haag)
```

## Tech Stack Integration

- **Frontend**: React `useChat()` hook from `ai/react` (already installed)
- **API Route**: `/src/app/api/chat/route.ts` — `ToolLoopAgent` with recruitment tools
- **AI SDK**: `ai@6.0.97` with `@ai-sdk/openai` and `@ai-sdk/google` (already installed), add `@ai-sdk/anthropic` for Claude
- **Tools**: Zod-typed tool functions in `/src/services/chat-tools/`
- **Context Provider**: React context that tracks current route + entity
- **UI**: Radix Sheet component + custom chat message components, dark theme
- **State**: `useChat()` manages messages, localStorage for panel open/closed state
- **Hotkey**: Cmd+J via `useEffect` keydown listener
- **DB**: Direct Drizzle ORM access in tool functions (same connection as rest of app)
