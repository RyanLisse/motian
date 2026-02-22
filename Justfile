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

# ── Build & Deploy ───────────────────────────────

# Build Next.js production bundle
build:
	pnpm next build

# Install all dependencies
install:
	pnpm install
