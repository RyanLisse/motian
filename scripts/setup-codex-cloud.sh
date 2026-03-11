#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
cd "$repo_root"

echo "==> Motian setup bootstrap"

require_command() {
  local command_name="$1"
  local help_text="$2"

  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "$help_text"
    exit 1
  fi
}

maybe_add_qlty_to_path() {
  local candidate

  for candidate in "$HOME/.qlty/bin" "$HOME/.local/bin" "$HOME/bin"; do
    if [[ -x "$candidate/qlty" ]]; then
      export PATH="$candidate:$PATH"
      return 0
    fi
  done

  return 1
}

require_command node "Node.js is required but not available on PATH. Install Node 22+ and rerun this script."
require_command corepack "corepack is required but not available on PATH. Install a Node.js distribution that includes corepack and rerun this script."

node_version="$(node --version)"
node_major="$(node -p "process.versions.node.split('.')[0]")"

if [[ "$node_major" -lt 22 ]]; then
  echo "Warning: Motian is validated on Node 22.x in CI. Current version: $node_version"
fi

pnpm_package_manager="$(node -e "const { readFileSync } = require('node:fs'); const pkg = JSON.parse(readFileSync('package.json', 'utf8')); process.stdout.write(pkg.packageManager || '');")"

if [[ "$pnpm_package_manager" != pnpm@* ]]; then
  echo "package.json must declare a pinned pnpm version in packageManager."
  exit 1
fi

pnpm_version="${pnpm_package_manager#pnpm@}"
pnpm_cmd=(corepack pnpm)

echo "Using package manager: $pnpm_package_manager"

# Use the repository's pinned package manager version.
corepack prepare "pnpm@$pnpm_version"

echo "Node: $node_version"
echo "pnpm: $("${pnpm_cmd[@]}" --version)"

if [[ "${SKIP_PNPM_INSTALL:-0}" == "1" ]]; then
  echo "Skipping pnpm install because SKIP_PNPM_INSTALL=1."
elif [[ -f pnpm-lock.yaml ]]; then
  "${pnpm_cmd[@]}" install --frozen-lockfile
else
  "${pnpm_cmd[@]}" install
fi

if [[ -f .env.local ]]; then
  echo ".env.local already exists."
elif [[ -f .env.example ]]; then
  cp .env.example .env.local
  echo "Created .env.local from .env.example."
else
  echo "Warning: .env.example not found, so .env.local was not created."
fi

if command -v qlty >/dev/null 2>&1; then
  echo "Qlty: $(qlty --version)"
elif [[ "${INSTALL_QLTY:-0}" == "1" ]]; then
  require_command curl "curl is required to install Qlty automatically. Install curl or install Qlty manually from https://qlty.sh/."
  echo "Qlty CLI not found. Installing because INSTALL_QLTY=1..."
  curl -fsSL https://qlty.sh | sh
  maybe_add_qlty_to_path || true

  if command -v qlty >/dev/null 2>&1; then
    echo "Qlty: $(qlty --version)"
  else
    echo "Qlty installation finished, but the qlty binary is not on PATH yet. Start a new shell or add the install directory to PATH."
  fi
else
  echo "Qlty CLI not found. Install it with: curl -fsSL https://qlty.sh | sh"
fi

if [[ -f .qlty/qlty.toml ]]; then
  echo "Qlty config: .qlty/qlty.toml"
else
  echo "Qlty config: no .qlty/qlty.toml found in this workspace; skipping repo-specific Qlty setup."
fi

if [[ "${INSTALL_PLAYWRIGHT:-0}" == "1" ]]; then
  "${pnpm_cmd[@]}" exec playwright install chromium
fi

echo "==> Motian setup bootstrap complete"
