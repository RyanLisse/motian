#!/usr/bin/env bash
# Shared paths and defaults for verify-motian helpers.
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$SKILL_DIR/../../.." && pwd)"
STATE_DIR="$SKILL_DIR/state"
EVIDENCE_ROOT="$SKILL_DIR/evidence"
INSTANCE_FILE="$STATE_DIR/instance.json"
LOG_FILE="$STATE_DIR/next-dev.log"

MOTIAN_VERIFY_HOST="${MOTIAN_VERIFY_HOST:-127.0.0.1}"
MOTIAN_VERIFY_PORT="${MOTIAN_VERIFY_PORT:-3012}"
BASE_URL="http://${MOTIAN_VERIFY_HOST}:${MOTIAN_VERIFY_PORT}"

USER_DEV_PORT=3002

mkdir -p "$STATE_DIR" "$EVIDENCE_ROOT"
