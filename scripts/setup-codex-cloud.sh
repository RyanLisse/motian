#!/usr/bin/env bash

set -euo pipefail

echo "==> Codex Cloud setup for Motian"

if ! command -v corepack >/dev/null 2>&1; then
  echo "corepack is required but not available on PATH."
  exit 1
fi

# Use the repository's pinned package manager version.
corepack enable
corepack prepare pnpm@9.15.0 --activate

echo "Node: $(node --version)"
echo "pnpm: $(pnpm --version)"

if [[ -f pnpm-lock.yaml ]]; then
  pnpm install --frozen-lockfile
else
  pnpm install
fi

if [[ ! -f .env.local && -f .env.example ]]; then
  cp .env.example .env.local
  echo "Created .env.local from .env.example."
fi

if [[ "${INSTALL_PLAYWRIGHT:-0}" == "1" ]]; then
  pnpm exec playwright install chromium
fi

echo "==> Codex Cloud setup complete"
