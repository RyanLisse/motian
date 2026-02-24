# Agent Instructions — Motian Recruitment Platform

> **Every agent is fungible.** You're a generalist. Use `bv` to find work, `bd` to track it, and Agent Mail to coordinate.

## Project Overview

Motian is a **Dutch recruitment platform** built with:
- **Next.js 16** (App Router, Turbopack, Server Components)
- **Drizzle ORM** on **Neon PostgreSQL** (with pgvector for embeddings)
- **Vercel AI SDK** (`ai` package — `tool()`, `streamText`, `generateObject`)
- **Biome** for linting/formatting (NOT eslint/prettier)
- **pnpm** as package manager
- **Vercel** deployment target

### Architecture Layers

```
app/                    → Next.js pages + API routes (Dutch URL paths)
components/             → React components (shadcn/ui)
src/ai/                 → AI agent system (tools, prompts, model config)
src/services/           → Business logic (scraping, scoring, GDPR, etc.)
src/db/                 → Drizzle schema + connection (Neon)
src/lib/                → Shared utilities (rate-limit, etc.)
src/schemas/            → Zod validation schemas
tests/                  → Test files (.test.ts)
```

### Key Conventions

- **Dutch UI strings, English code variables** — Error messages in Dutch, var names in English
- **Dutch API paths** — `/api/scraper-configuraties`, `/api/gezondheid`
- Schema in `src/db/schema.ts`, connection in `src/db/index.ts`
- `revalidateTag(tag, "default")` — Next.js 16 REQUIRES 2 arguments
- Soft-delete via `deletedAt` column, filter with `isNull(jobs.deletedAt)`
- All commits must pass `pnpm lint` (Biome)

---

## Tools

### Beads (Issue Tracking)

```bash
bd ready                          # Find available work (no blockers)
bd list --status=open             # All open issues
bd show <id>                      # Full issue details
bd update <id> --status in_progress  # Claim work
bd close <id>                     # Mark complete
bd close <id1> <id2> ...          # Close multiple at once
bd sync                           # Sync with git remote
```

### BV (Bead Viewer — Task Prioritization)

**CRITICAL: Never run bare `bv` — it launches interactive TUI that blocks your session.**

```bash
bv --robot-triage                 # Full triage with scores
bv --robot-next                   # Single top pick for you
bv --robot-plan                   # Parallel execution tracks
bv --robot-insights | jq '.Cycles'  # Check for dependency cycles
```

### Build & Quality

```bash
pnpm lint                         # Biome lint check (MUST PASS before commit)
pnpm lint:fix                     # Auto-fix lint issues
pnpm build                        # Next.js production build
pnpm test                         # Run vitest tests
pnpm dev                          # Start dev server (port 3000)
pnpm db:generate                  # Generate Drizzle migration
pnpm db:push                      # Push schema to Neon
```

---

## Workflow

### Starting Work

1. Run `bv --robot-next` to find highest-impact ready bead
2. `bd show <id>` to read full details
3. `bd update <id> --status in_progress` to claim it
4. **Do the work** — read existing code first, make minimal changes
5. Run `pnpm lint` to verify
6. `bd close <id>` when done
7. Commit with detailed message, push

### Quality Rules

- **NEVER change code you haven't read first**
- **Prefer editing existing files** over creating new ones
- **Run `pnpm lint`** before every commit
- **Keep changes minimal** — solve what the bead asks, nothing more
- **Files go in correct directories** — NEVER save to project root
- **Test your changes** — if you add a function, verify it works

### Committing

```bash
git add <specific-files>          # Stage only relevant files
git commit -m "$(cat <<'EOF'
feat: <description>

<details of what changed and why>

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
git push
```

---

## Landing the Plane (Session Completion)

**Work is NOT complete until `git push` succeeds.**

```bash
# 1. Quality check
pnpm lint

# 2. Sync beads
bd sync

# 3. Commit and push
git add <files>
git commit -m "..."
git push

# 4. Verify
git status  # MUST show "up to date with origin"
```

---

## Current Open Beads (20)

### P0 — Blockers
- `motian-n38` — Modal scraping stub (Striive unusable on Vercel). User has Modal credentials.

### P1 — High Priority
- `motian-scy` — Scoring is rule-based only (needs semantic/vector matching)
- `motian-o5g` — No pagination anywhere (full table scans)
- `motian-uml` — Cron ignores per-platform cronExpression in DB

### P2 — Medium Priority
- `motian-m4a` — No real-time updates (implement SSE)
- `motian-572` — Dual unique constraint risk in normalize.ts upsert
- `motian-6ad` — AI enrichment has no retry logic
- `motian-bxq` — GDPR gaps (contacts not covered, no audit trail)
- `motian-cyf` — No candidate embeddings (vector matching impossible)
- `motian-d5v` — LIKE wildcards not escaped in search inputs
- `motian-u4c` — Extract shared UI components (KPI card, pagination, empty state, filter tabs)
- `motian-k2q` — Visual consistency across pages (BLOCKED BY motian-u4c)

### P3 — Lower Priority
- `motian-ocy` — Migrate middleware.ts to proxy.ts (Next.js 16)
- `motian-u3r` — Hardcoded platform list in 3+ files
- `motian-clg` — No monitoring/alerting (circuit breaker is silent)
- `motian-392` — Search is basic (no full-text tsvector/GIN)
- `motian-nbh` — Test coverage is structural only
- `motian-55q` — Sidebar nav missing Interviews and Messages
- `motian-z9l` — Opdracht detail page sequential DB query waterfall

### P4 — Backlog
- `motian-1ng` — Missing features (AI Grading, CV Beheer, Settings pages)

---

## Key Files Reference

| Area | File | Notes |
|------|------|-------|
| DB Schema | `src/db/schema.ts` | 8 tables, pgvector, dual unique indexes on jobs |
| DB Connection | `src/db/index.ts` | Neon serverless driver |
| Normalize | `src/services/normalize.ts` | Upsert on (platform, externalId), 2nd unique on (platform, externalUrl) |
| AI Enrichment | `src/services/ai-enrichment.ts` | Gemini 2.5 flash-lite, no retry, 100ms delay |
| Embeddings | `src/services/embedding.ts` | text-embedding-3-small, 512 dims, jobs only |
| Scoring | `src/services/scoring.ts` | Keyword matching, extracted weight constants |
| GDPR | `src/services/gdpr.ts` | Art 15/17 for candidates only |
| Jobs Service | `src/services/jobs.ts` | ILIKE unescaped, hybridSearch with RRF |
| Candidates | `src/services/candidates.ts` | ILIKE unescaped |
| Scrape Pipeline | `src/services/scrape-pipeline.ts` | Hardcoded switch on platform names |
| Striive Scraper | `src/services/scrapers/striive.ts` | scrapeViaModal is a stub |
| AI Agent | `src/ai/agent.ts` | System prompt builder, tool registry |
| AI Tools | `src/ai/tools/*.ts` | 7 tools (query, create, trigger, etc.) |
| Rate Limit | `src/lib/rate-limit.ts` | In-memory sliding window |
| Middleware | `middleware.ts` | Bearer token auth (deprecated in Next.js 16) |
| Sidebar | `components/app-sidebar.tsx` | Missing Interviews/Messages nav items |
| Vercel Config | `vercel.json` | Cron: scrape 6AM, vacancy-expiry 3AM |

---

## Cursor Cloud specific instructions

### Services

| Service | Command | Notes |
|---------|---------|-------|
| Next.js dev server | `pnpm dev` (port 3001) | Requires `.env.local`. Turbopack hot-reload. |
| Lint | `pnpm lint` | Biome — see `biome.json`. Pre-existing errors exist in the codebase (formatting). |
| Tests | `pnpm test` | Vitest — `tests/**/*.test.ts`. A few structural/string-match tests may fail due to model abstraction indirection. |

### Environment setup

- Node 22.x and pnpm 9.15.0 are managed via corepack. The update script handles `pnpm install --frozen-lockfile`.
- `.env.local` must exist (copied from `.env.example`). The app connects to a live Neon PostgreSQL database via `DATABASE_URL`. Without valid credentials, pages will load but some server-side data fetching will fail.
- `drizzle.config.ts` reads from `.env.local` (not `.env`).

### Gotchas

- `pnpm lint` reports pre-existing formatting and lint errors (23 errors as of initial setup). These are not blocking — they are in the existing codebase.
- 4 test failures are pre-existing: 3 tests check for literal `"gemini-"` string in source but the code uses a `geminiFlash` alias from `src/lib/ai-models.ts`; 1 structural test flags an English `candidates` API route segment.
- The Justfile uses `zsh` as its shell — use `pnpm` commands directly instead if `zsh` is not installed.
- `bv` (Bead Viewer) without flags launches an interactive TUI that will block the session. Always use `bv --robot-*` flags.
- The sidebar nav calls `/kandidaten` but the actual route is `/professionals` (Talent Pool submenu).
