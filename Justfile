set shell := ["zsh", "-cu"]

# List available commands
default:
	@just --list

# ── Development ──────────────────────────────────

# Clean up ports
cleanup-ports:
	-npx -y kill-port 3001

# Start the Next.js development server
dev: cleanup-ports
	pnpm next dev --port 3001

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

# ── Database ─────────────────────────────────────

# Generate Drizzle database migrations
db-generate:
	pnpm drizzle-kit generate

# Push database schema changes to the database
db-push:
	pnpm drizzle-kit push

# ── Scraping ─────────────────────────────────────

# Trigger a manual scrape for all platforms
scrape:
	curl -s -X POST http://localhost:3001/api/scrape/starten | jq .

# Trigger a manual scrape for a specific platform
scrape-platform platform:
	curl -s -X POST http://localhost:3001/api/scrape/starten -H "Content-Type: application/json" -d '{"platform":"{{platform}}"}' | jq .

# Check platform health
health:
	curl -s http://localhost:3001/api/gezondheid | jq .

# ── Pages ────────────────────────────────────────

# Open dashboard in browser
dashboard:
	open http://localhost:3001/overzicht

# Open opdrachten in browser
opdrachten:
	open http://localhost:3001/opdrachten

# ── CLI & MCP & TUI ───────────────────────────────

# Run a CLI command (e.g. just cli kandidaten:zoek --query "Java")
cli *args:
	pnpm cli {{args}}

# Start the MCP server (for Claude Desktop, Cursor, etc.)
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
	pnpm tsx scripts/harness/risk-policy-gate.ts

# Run all pre-PR checks
harness-pre-pr:
	pnpm run harness:pre-pr

# Run structural tests
harness-smoke:
	pnpm vitest run tests/harness/

# Capture browser evidence
harness-evidence:
	pnpm tsx scripts/harness/capture-browser-evidence.ts

# Verify browser evidence
harness-verify:
	pnpm tsx scripts/harness/verify-browser-evidence.ts

# Run entropy check
harness-entropy:
	pnpm tsx scripts/harness/entropy-check.ts

# Create a harness gap issue from a production regression
harness-gap title:
	pnpm tsx scripts/harness/create-gap-issue.ts --title "{{title}}"

# ── Planning & Orchestration ────────────────────

# Harness Plan Validator ("Planning is the New Coding")
# Run this to validate if a provided plan.md or task.md meets project standards
harness-plan path:
	pnpm tsx scripts/harness/validate-plan.ts --file "{{path}}"

# Background Worker hook for concurrent multi-agent executions
harness-bg-worker taskName:
	pnpm tsx scripts/harness/orchestrator.ts --dispatch "{{taskName}}"
