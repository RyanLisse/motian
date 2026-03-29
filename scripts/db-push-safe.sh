#!/usr/bin/env bash
# Safe wrapper for drizzle-kit push that warns before running against production.
# Use: pnpm db:push:safe (instead of pnpm db:push)

set -euo pipefail

DB_URL="${DATABASE_URL:-}"

if [ -z "$DB_URL" ]; then
  echo "❌ DATABASE_URL is not set. Load .env.local first."
  exit 1
fi

# Detect production databases (pooler endpoints, main branches)
if echo "$DB_URL" | grep -qE "pooler|\.neon\.tech/neondb\b" && ! echo "$DB_URL" | grep -q "branch="; then
  echo ""
  echo "⚠️  WAARSCHUWING: Je staat op het punt drizzle-kit push uit te voeren"
  echo "   tegen wat lijkt op een PRODUCTIE database:"
  echo ""
  echo "   ${DB_URL%%@*}@***"
  echo ""
  echo "   db:push kan tabellen DROPPEN en opnieuw aanmaken als het"
  echo "   schema-verschillen detecteert. Dit VERWIJDERT ALLE DATA."
  echo ""
  read -p "   Weet je zeker dat je wilt doorgaan? (typ 'ja' om te bevestigen): " confirm
  if [ "$confirm" != "ja" ]; then
    echo "❌ Afgebroken."
    exit 1
  fi
fi

exec npx drizzle-kit push "$@"
