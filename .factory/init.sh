#!/bin/bash
set -euo pipefail

pnpm install --frozen-lockfile

if [ ! -f ".env.local" ]; then
  echo "Missing .env.local. Run: vercel env pull .env.local --yes" >&2
  exit 1
fi

if ! grep -q "^DATABASE_URL=" .env.local && ! grep -q "^DATABASE_URL_UNPOOLED=" .env.local; then
  echo "Missing Neon database connection env var in .env.local" >&2
  exit 1
fi

echo "Mission environment ready"
