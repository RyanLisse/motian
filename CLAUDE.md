# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> For the long-form agent playbook (beads workflow, key-files table, risk tiers, Symphony
> integration, learned preferences), read `AGENTS.md` at the repo root. This file is the
> short, high-signal orientation.

## Project

Motian is a Dutch-language recruitment operations platform. AI-assisted sourcing, candidate
matching, scraping, interviews, and a LiveKit voice agent — all wired to a single Neon
PostgreSQL database.

- **Next.js 16** (App Router, Turbopack, Server Components) — **no** Motia framework
- **Drizzle ORM** on **Neon Postgres** with **pgvector** for embeddings
- **Vercel AI SDK** (`ai`) — `tool()`, `streamText`, `generateObject`
- **LiveKit Agents** + Gemini 2.5 Flash Native Audio — realtime voice
- **MCP server** (stdio) exposing ~42 recruitment tools
- **Biome** for lint + format (never eslint/prettier)
- **pnpm 9.15**, Node 22.x, Vercel deployment

## Commands

```bash
pnpm dev                  # Next.js dev server, port 3002 (override with PORT)
pnpm build                # Production build
pnpm test                 # Vitest, one shot
pnpm test:watch           # Vitest watch mode
pnpm test:coverage        # Coverage report
pnpm test:app             # Curated smoke tests (chat, shell, navigation)
vitest run tests/foo.test.ts   # Run a single test file
vitest run -t "name"      # Run tests matching a name
pnpm lint                 # Biome check (MUST pass before commit)
pnpm lint:fix             # Biome auto-fix
pnpm exec tsc --noEmit    # Type check without emitting
pnpm db:generate          # Generate Drizzle migration from schema.ts
pnpm db:push              # Safe push to Neon (wraps drizzle-kit)
pnpm db:push:force        # Raw drizzle-kit push — use with care
pnpm mcp                  # Start MCP server (stdio)
pnpm cli                  # CLI agent
pnpm voice-agent:dev      # LiveKit voice agent (dev)
pnpm harness:pre-pr       # lint + tsc + test + risk policy gate
```

`pnpm lint` and `pnpm test` should both pass cleanly. If you see failures, reproduce
them on a clean checkout before assuming your changes caused them, and do not "fix"
them by reverting unrelated abstractions.

## Architecture (big picture)

```
app/                          Next.js 16 App Router pages + API routes (Dutch URLs)
  api/**/route.ts             Zod-validated REST endpoints
components/                   React UI (shadcn/ui, radix primitives)
  chat/genui/registry.ts      16 lazy-loaded GenUI tool components
src/ai/                       Vercel AI SDK agent: ~40 tools, prompts, model config
  agent.ts                    System prompt builder + tool registry
  tools/*.ts                  Individual AI tools (query, create, trigger, …)
src/components/ai-elements/   AI SDK Elements (PromptInput, Conversation, Message)
src/mcp/server.ts             MCP server (stdio) — 42 tools
src/voice-agent/main.ts       LiveKit voice agent — 35 tools, Gemini native audio
src/services/                 Business logic (scraping, scoring, GDPR, embeddings, …)
src/db/schema.ts              Drizzle schema — 8 tables, pgvector, dual unique on jobs
src/db/index.ts               Neon serverless driver (single source of truth)
src/schemas/                  Zod validation schemas
src/lib/ai-models.ts          `tracedGenerateText`, model aliases — use these, never raw SDK
src/lib/rate-limit.ts         In-memory sliding window
packages/                     pnpm workspaces: @motian/db, @motian/esco, @motian/scrapers
trigger/                      Trigger.dev v4 background tasks
tests/                        Vitest tests (.test.ts only)
docs/solutions/               Documented solutions (bugs, best practices), YAML frontmatter for search
drizzle/                      Generated migrations (HIGH risk — review before edit)
proxy.ts                      Next.js 16 proxy layer (replaces legacy middleware.ts)
```

The three agent surfaces (Next.js chat via `src/ai/agent.ts`, the MCP server at
`src/mcp/server.ts`, and the LiveKit voice agent at `src/voice-agent/main.ts`) share the
same service layer in `src/services/` and the same DB connection in `src/db/index.ts`.
Add new capabilities as services first, then expose them through the relevant agent
surfaces — avoid duplicating business logic inside tool handlers.

The chat UI's GenUI is driven by `components/chat/genui/registry.ts`: each AI tool name
maps to a lazy-loaded React component that renders its output. To add a new rich tool
result, register it there and reuse `components/chat/genui/genui-utils.ts`.

## Conventions that bite if you miss them

- **Dutch UI strings, English code variables.** Error messages and copy in Dutch; identifiers
  and comments in English.
- **Dutch API paths.** `/api/scraper-configuraties`, `/api/gezondheid` — never `/api/health`
  or other English segments. Structural tests enforce this.
- **Canonical routes.** Jobs live at `/vacatures` (implemented in `app/opdrachten`,
  re-exported by `app/vacatures`). Candidates live at `/kandidaten`
  (`app/professionals` has been removed). User-facing labels: **Vacatures**, **Kandidaten**.
- **`revalidateTag(tag, "default")`** — Next.js 16 requires the second argument. Easy miss.
- **Soft delete everywhere.** Filter with `isNull(table.deletedAt)`; never hard-delete.
- **All AI calls go through `src/lib/ai-models.ts`** (`tracedGenerateText`, `geminiFlash`,
  etc.). Direct `@ai-sdk/*` calls bypass tracing and model aliasing.
- **Zod validation at every API boundary.** Schemas live in `src/schemas/`.
- **`bv` without flags launches a blocking TUI** — always use `bv --robot-*` flags if you
  invoke the Bead Viewer.

## Risk tiers (from `harness.config.json`)

| Tier    | Files                                                              | Policy                             |
|---------|--------------------------------------------------------------------|------------------------------------|
| High    | `src/db/schema.ts`, `src/services/gdpr.ts`, `crypto.ts`, `cron/**`, `drizzle/**` | Human code review required |
| Medium  | `src/services/**`, `src/ai/**`, `src/schemas/**`, `app/api/**`     | Lint + typecheck + tests           |
| Low     | Everything else                                                    | Risk gate + lint only              |

Do not modify `src/db/schema.ts` or anything under `drizzle/` without explicit confirmation.

## Test conventions

Vitest, `.test.ts` files under `tests/` only. Mock hoisting pattern:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFn } = vi.hoisted(() => ({ mockFn: vi.fn() }));
vi.mock("../src/path/to/module", () => ({ exportedFn: mockFn }));

import { functionUnderTest } from "../src/path/to/target";

describe("functionUnderTest", () => {
  beforeEach(() => vi.clearAllMocks());
  // …
});
```

## Background tasks (Trigger.dev)

Tasks live under `trigger/` and use `@trigger.dev/sdk` v4 exclusively — **never**
`client.defineJob` (v2, breaks the app). Full v4 reference is in the user-global
`~/.claude/CLAUDE.md`; this repo follows those patterns as-is.

## File organization

- Source in `app/`, `components/`, `src/`, `packages/`, `trigger/`, `tests/`
- Scripts in `scripts/` (invoked via `tsx`)
- **Never** drop working files, ad-hoc markdown, screenshots, or test scratch into the
  repo root — the root already has too much noise; keep new work in the right subdir.
- Do not create new top-level documentation files unless explicitly asked.

## What to read next

- `AGENTS.md` — beads/bv workflow, full key-files table, Symphony integration, open beads
- `README.md` / `README.en.md` — end-user feature overview
- `src/db/schema.ts` — ground truth for data model
- `src/ai/agent.ts` and `src/ai/tools/` — how the chat agent is wired
