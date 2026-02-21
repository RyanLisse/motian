set shell := ["zsh", "-cu"]

# List available commands
default:
	@just --list

# ── Development ──────────────────────────────────

# Start the Next.js development server
dev:
	pnpm next dev --port 3001

# Start the Motia workflow engine
motia:
	pnpm motia dev

# Start both Next.js and Motia in parallel
dev-all:
	just dev & just motia & wait

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
	pnpm run db:generate

# Push database schema changes to the database
db-push:
	pnpm run db:push

# Import Striive jobs from API export
db-import-striive:
	npx tsx scripts/import-striive-api.ts

# Seed Indeed + LinkedIn scraper configs
db-seed-configs:
	npx tsx scripts/seed-indeed-linkedin-configs.ts

# ── CLI ──────────────────────────────────────────

# List all jobs via CLI
jobs:
	npx tsx cli/index.ts jobs list

# Show job statistics via CLI
jobs-stats:
	npx tsx cli/index.ts jobs stats

# List scraper configs via CLI
scrapers:
	npx tsx cli/index.ts scraper list

# Show scraper status via CLI
scraper-status:
	npx tsx cli/index.ts scraper status

# ── Pages ────────────────────────────────────────

# Open dashboard in browser
dashboard:
	open http://localhost:3001/overzicht

# Open opdrachten in browser
opdrachten:
	open http://localhost:3001/opdrachten

# Open scraper dashboard in browser
scraper:
	open http://localhost:3001/scraper

# ── Build & Deploy ───────────────────────────────

# Build Next.js production bundle
build:
	pnpm next build

# Install dependencies
install:
	pnpm install
