---
module: Voice Agent
date: 2026-03-05
problem_type: integration_issue
component: assistant
symptoms:
  - "Voice agent had only 3 broken tools vs chat (40) and MCP (42)"
  - "Voice agent called HTTP API routes instead of direct service imports"
  - "Documentation described chat as sidepanel with 45 tools — all outdated"
root_cause: wrong_api
resolution_type: code_fix
severity: high
tags: [voice-agent, tool-parity, livekit, agent-native, migration, documentation]
---

# Troubleshooting: Voice Agent Tool Parity — Migration to Direct Service Imports

## Problem

The LiveKit voice agent had only 3 broken tools while the chat agent had 40 and MCP server had 42. The voice agent lived in a separate `agent/` directory and called HTTP API routes instead of importing services directly, making it fragile and out of sync with the rest of the platform.

## Environment

- Module: Voice Agent (`src/voice-agent/`)
- Framework: Next.js 16 + LiveKit Agents SDK
- Affected Component: Voice AI agent, all platform documentation
- Date: 2026-03-05

## Symptoms

- Voice agent had only 3 tools (job search, candidate search, match) — all broken due to stale API contracts
- Voice agent called `fetch("http://localhost:3002/api/...")` — required the Next.js dev server to be running
- When new tools were added to the service layer, voice agent was never updated
- Documentation was severely outdated:
  - Chat described as "Zijpaneel" (sidepanel with Cmd+J) when it was already a full-screen `/chat` page
  - Tool count listed as "45" when actual count was 40 (chat), 42 (MCP), 35 (voice)
  - No mention of MCP server, voice agent, or AI SDK Elements anywhere in READMEs

## What Didn't Work

**Direct solution:** The problem was identified during a tool parity audit. The voice agent's fundamental architecture (HTTP calls to API routes) was the wrong approach — it needed a full rewrite with direct service imports.

## Solution

### 1. Migrate voice agent into monorepo

Moved from separate `agent/` directory to `src/voice-agent/` with two files:

**`src/voice-agent/main.ts`** — LiveKit entry point:
```typescript
import { cli, defineAgent, type JobContext, type JobProcess, ServerOptions, voice } from "@livekit/agents";
import * as google from "@livekit/agents-plugin-google";
import * as silero from "@livekit/agents-plugin-silero";
import { MotianAgent } from "./agent.js";

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    proc.userData.vad = await silero.VAD.load();
  },
  entry: async (ctx: JobContext) => {
    const session = new voice.AgentSession({
      llm: new google.beta.realtime.RealtimeModel({
        model: "gemini-2.5-flash-native-audio-preview-12-2025",
        voice: "Puck",
        temperature: 0.7,
      }),
      vad: ctx.proc.userData.vad as silero.VAD,
    });
    // ... start session with MotianAgent
  },
});
```

**`src/voice-agent/agent.ts`** — 35 tools with direct service imports:
```typescript
// Before (broken — called HTTP endpoints):
const response = await fetch("http://localhost:3002/api/opdrachten");
const data = await response.json();

// After (fixed — direct service imports):
import { getAllJobs } from "../services/jobs.js";
import { getCandidateById } from "../services/candidates.js";
import { runStructuredMatch } from "../services/structured-matching.js";
// ... 35 tools importing directly from src/services/
```

### 2. Fix TypeScript errors post-migration

**AutoMatchResult property mismatch** (`agent.ts:332-336`):
```typescript
// Before (broken — properties don't exist on AutoMatchResult):
matches: matches.map((m) => ({
  id: m.id, matchScore: m.matchScore, reasoning: m.reasoning,
})),

// After (fixed — correct AutoMatchResult properties):
matches: matches.map((m) => ({
  jobId: m.jobId, jobTitle: m.jobTitle, company: m.company,
  location: m.location, candidateId: m.candidateId,
})),
```

**groupBy type mismatch** (`agent.ts:730`):
```typescript
// Before (broken — "month" not accepted by service):
groupBy: z.enum(["day", "week", "month"]).optional(),

// After (fixed — matches getTimeSeriesAnalytics signature):
groupBy: z.enum(["day", "week"]).optional(),
```

### 3. Update all documentation (5 files)

| File | Key Changes |
|------|-------------|
| `README.md` | New multi-surface diagram, MCP+Voice boxes in system overview, 45→40 tools, chat sidepanel→full page, added `/chat`+`/settings` routes, tech stack (AI Elements, LiveKit, MCP), project structure |
| `README.en.md` | Mirror of Dutch changes |
| `AGENTS.md` | Architecture layers (3 new dirs), tech stack additions, voice-agent/MCP/CLI commands |
| `CLAUDE.md` | Added `voice-agent:dev`, `voice-agent:start`, `mcp`, `cli` commands |
| `docs/architecture.md` | New "AI Agent Surfaces" table, chat details with AI Elements, voice agent section, MCP 37→42 tools, `/chat`+`/settings` routes |

## Why This Works

1. **Root cause**: The voice agent was architecturally isolated — it lived in a separate directory and communicated via HTTP, creating a brittle coupling that broke silently when the service layer evolved.

2. **Direct service imports eliminate HTTP overhead**: Instead of `fetch()` → API route → Zod validation → service call, the voice agent now does `import { service } from "../services/"` → direct call. This is faster and type-safe at compile time.

3. **Monorepo colocation ensures tool parity**: When a new service function is added, all agent surfaces (`src/ai/tools/`, `src/mcp/tools/`, `src/voice-agent/agent.ts`) are in the same codebase. TypeScript compilation catches missing properties immediately.

4. **Documentation was a silent regression**: Nobody noticed the README described a "sidepanel" that had been a full page for weeks. Periodic doc audits (or treating docs as code) prevent this drift.

## Prevention

- **Agent-native principle**: Every action available on one agent surface must be available on all surfaces. When adding a new tool, add it to chat, MCP, and voice simultaneously.
- **TypeScript compilation as gate**: Running `pnpm exec tsc --noEmit` catches type mismatches between agent tools and the service layer. Add to CI.
- **Avoid HTTP-based agent architecture**: Agents in the same monorepo should import services directly. HTTP is for external clients only.
- **Documentation as code**: When adding new features (new routes, new tools, new agent surfaces), update READMEs in the same PR. Don't let docs drift.
- **Periodic doc audit**: Compare README tool counts, route tables, and diagrams against actual codebase. The `45 tools` → `40 tools` discrepancy was invisible for weeks.

## Related Issues

- See also: [agent-ui-parity-kandidaten-20260223.md](../api-schema-gaps/agent-ui-parity-kandidaten-20260223.md) — Similar tool parity issue between UI and API
