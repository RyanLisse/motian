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

# ── Expect (browser QA) ─────────────────────────
# https://github.com/millionco/expect — natural-language browser checks via Playwright + an agent.
# Start the app first: `just dev` (other terminal), then e.g. `just expect -m "test the vacatures page" -y`
# Override port: `PORT=3003 just expect -m "smoke homepage" -y`

# Pass any expect-cli flags (e.g. -m "…" -y --ci --no-cookies --headed).
# Bash shebang keeps quoted -m strings intact ({{args}} in zsh recipes does not).
expect *ARGS:
	#!/usr/bin/env bash
	set -euo pipefail
	exec npx expect-cli@latest -u "http://127.0.0.1:${PORT:-3002}" "$@"

# Wait for local dev, then run Expect in CI mode (headless, auto-yes, ~30m cap)
expect-ci:
	npx -y wait-on http://127.0.0.1:${PORT:-3002} --timeout 120000
	npx expect-cli@latest -u http://127.0.0.1:${PORT:-3002} --ci

# Short smoke prompt for /vacatures (no cookie import)
expect-vacatures:
	npx expect-cli@latest -u http://127.0.0.1:${PORT:-3002} \
		-m "Open /vacatures, confirm the page loads and the vacature search sidebar or filters are visible. List any critical console errors." \
		-y --no-cookies

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

# Search path latency baseline (p50/p95/p99)
metrics-search-path-latency:
	pnpm metrics:search-path-latency

# Explain capture for core search paths
metrics-search-explain:
	pnpm metrics:search-explain

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
