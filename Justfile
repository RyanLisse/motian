set shell := ["zsh", "-cu"]

# List available commands
default:
	@just --list

# ── Development ──────────────────────────────────

# Clean up ports
cleanup-ports:
	-npx -y kill-port ${PORT:-3002}

# Start the Next.js development server
dev: cleanup-ports
	pnpm next dev --hostname ${HOSTNAME:-0.0.0.0} --port ${PORT:-3002}

# ── Testing ──────────────────────────────────────

# Run all tests once
test:
	pnpm test

# Run tests in watch mode
test-watch:
	pnpm run test:watch

# Run TypeScript compilation check
typecheck:
	pnpm exec tsc --noEmit

# Run Biome lint check
lint:
	pnpm lint

# Run Biome lint with auto-fix
lint-fix:
	pnpm lint:fix

# Run high-impact quality checks before PR
pre-pr:
	pnpm run harness:pre-pr

# ── Database ─────────────────────────────────────

# Generate Drizzle database migrations
db-generate:
	pnpm db:generate

# Push database schema changes to the database
db-push:
	pnpm db:push

# ── Beads (Issue Tracking) ──────────────────────

# Find available work (no blockers)
bd-ready:
	bd ready

# List all open issues
bd-list:
	bd list --status=open

# Show full issue details
bd-show id:
	bd show {{id}}

# Claim work on an issue
bd-claim id:
	bd update {{id}} --status in_progress

# Mark issue as complete
bd-close id:
	bd close {{id}}

# Sync with git remote
bd-sync:
	bd sync

# ── BV (Bead Viewer — Prioritization) ──────────

# Full triage with scores
bv-triage:
	bv --robot-triage

# Single top pick for you
bv-next:
	bv --robot-next

# Parallel execution tracks
bv-plan:
	bv --robot-plan

# ── Scraping ─────────────────────────────────────

# Trigger a manual scrape for all platforms
scrape:
	curl -s -X POST http://localhost:3002/api/scrape/starten | jq .

# Trigger a manual scrape for a specific platform
scrape-platform platform:
	curl -s -X POST http://localhost:3002/api/scrape/starten -H "Content-Type: application/json" -d '{"platform":"{{platform}}"}' | jq .

# Check platform health
health:
	curl -s http://localhost:3002/api/gezondheid | jq .

# ── Pages ────────────────────────────────────────

# Open dashboard in browser
dashboard:
	open http://localhost:3002/overzicht

# Open opdrachten in browser
opdrachten:
	open http://localhost:3002/opdrachten

# Open chat in browser
chat:
	open http://localhost:3002/chat

# ── Metrics & benchmarks ──────────────────────────

# Capture baseline metrics (build time, env)
baseline-metrics:
	pnpm baseline:metrics

# Benchmark hybrid search
benchmark-hybrid-search:
	pnpm benchmark:hybrid-search

# ESCO rollout snapshot
metrics-esco:
	pnpm metrics:esco-rollout

# ── CLI & MCP & TUI ───────────────────────────────

# Run a CLI command (e.g. just cli kandidaten:zoek --query "Java")
cli *args:
	pnpm cli {{args}}

# Start the MCP server
mcp:
	pnpm mcp

# Verify MCP server with reloaderoo
mcp-verify:
	npx reloaderoo inspect ping -- npx tsx src/mcp/server.ts
	npx reloaderoo inspect server-info -- npx tsx src/mcp/server.ts
	npx reloaderoo inspect list-tools --quiet -- npx tsx src/mcp/server.ts | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'{len(d[\"tools\"])} MCP tools registered')"

# Start the OpenTUI terminal dashboard
tui:
	cd tui && bun run start

# ── Docs (Fumadocs) ─────────────────────────────

# Start fumadocs dev server (port 4000)
docs:
	cd fumadocs && pnpm dev

# Build fumadocs production bundle
docs-build:
	cd fumadocs && pnpm build

# ── Build & Deploy ───────────────────────────────

# Build Next.js production bundle
build:
	pnpm next build

# Install all dependencies
install:
	pnpm install

# ── Harness Engineering ─────────────────────────

# Classify risk tier of current changes
harness-risk:
	pnpm harness:risk-tier

# Run structural tests
harness-smoke:
	pnpm harness:smoke

# Capture browser evidence
harness-evidence:
	pnpm harness:browser-evidence

# Verify browser evidence
harness-verify:
	pnpm harness:verify-evidence

# Run entropy check
harness-entropy:
	pnpm harness:entropy

# ── Voice Agent (LiveKit) ─────────────────────

# Start the voice agent in development
voice-dev:
	pnpm voice-agent:dev

# Start the voice agent for production
voice-start:
	pnpm voice-agent:start

# ── Planning & Orchestration ────────────────────

# Validate plan.md or task.md
harness-plan path:
	pnpm tsx scripts/harness/validate-plan.ts --file "{{path}}"

# Background Worker hook
harness-bg-worker taskName:
	pnpm tsx scripts/harness/orchestrator.ts --dispatch "{{taskName}}"
