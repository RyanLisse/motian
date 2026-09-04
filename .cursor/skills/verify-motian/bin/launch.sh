#!/usr/bin/env bash
# Start a dedicated Motian Next.js instance for verification.
# Never binds the user's default port 3002.
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

cd "$REPO_ROOT"

if [[ ! -f "$REPO_ROOT/.env.local" ]]; then
  echo "launch: missing $REPO_ROOT/.env.local" >&2
  echo "launch: copy from .env.example or run: vercel env pull .env.local" >&2
  echo "launch: DATABASE_URL is required; pages that hit Neon will fail without it." >&2
  exit 1
fi

if [[ ! -d "$REPO_ROOT/node_modules" ]]; then
  echo "launch: node_modules missing; run pnpm install --frozen-lockfile" >&2
  exit 1
fi

if [[ "$MOTIAN_VERIFY_PORT" == "$USER_DEV_PORT" ]]; then
  echo "launch: refusing to bind port $USER_DEV_PORT (user's default pnpm dev)." >&2
  echo "launch: set MOTIAN_VERIFY_PORT to something else (default 3012)." >&2
  exit 1
fi

if [[ -f "$INSTANCE_FILE" ]]; then
  echo "launch: instance already recorded at $INSTANCE_FILE" >&2
  echo "launch: run bin/doctor.sh, or bin/cleanup.sh if this run is stale." >&2
  exit 1
fi

if lsof -nP -iTCP:"$MOTIAN_VERIFY_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "launch: port $MOTIAN_VERIFY_PORT is already in use by another process." >&2
  echo "launch: pick another MOTIAN_VERIFY_PORT or stop that listener." >&2
  exit 1
fi

RUN_ID="run-$(date -u +%Y%m%dT%H%M%SZ)-$$"
EVIDENCE_DIR="$EVIDENCE_ROOT/$RUN_ID"
mkdir -p "$EVIDENCE_DIR"

: >"$LOG_FILE"

# Agent sandboxes often reap the process group when a helper exits.
# MOTIAN_VERIFY_FOREGROUND=1 execs Next in this process — start that
# invocation in the runner's background and wait from another shell.
if [[ "${MOTIAN_VERIFY_FOREGROUND:-}" == "1" ]]; then
  write_instance() {
    cat >"$INSTANCE_FILE" <<EOF
{
  "runId": "$RUN_ID",
  "pid": $$,
  "listenPid": null,
  "host": "$MOTIAN_VERIFY_HOST",
  "port": $MOTIAN_VERIFY_PORT,
  "baseUrl": "$BASE_URL",
  "evidenceDir": "$EVIDENCE_DIR",
  "logFile": "$LOG_FILE",
  "repoRoot": "$REPO_ROOT",
  "startedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
  }
  write_instance
  echo "launch: foreground pid=$$ url=$BASE_URL runId=$RUN_ID"
  exec env HOSTNAME="$MOTIAN_VERIFY_HOST" PORT="$MOTIAN_VERIFY_PORT" pnpm dev
fi

# Detach from this helper so exiting launch.sh does not SIGHUP Next.
nohup env HOSTNAME="$MOTIAN_VERIFY_HOST" PORT="$MOTIAN_VERIFY_PORT" \
  pnpm dev >>"$LOG_FILE" 2>&1 &
PID=$!
disown "$PID" 2>/dev/null || true

write_instance() {
  local listen_pid="${1:-null}"
  cat >"$INSTANCE_FILE" <<EOF
{
  "runId": "$RUN_ID",
  "pid": $PID,
  "listenPid": $listen_pid,
  "host": "$MOTIAN_VERIFY_HOST",
  "port": $MOTIAN_VERIFY_PORT,
  "baseUrl": "$BASE_URL",
  "evidenceDir": "$EVIDENCE_DIR",
  "logFile": "$LOG_FILE",
  "repoRoot": "$REPO_ROOT",
  "startedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
}

write_instance null

echo "launch: started pid=$PID url=$BASE_URL runId=$RUN_ID"

READY=0
for _ in $(seq 1 90); do
  if ! kill -0 "$PID" 2>/dev/null; then
    echo "launch: process $PID exited before ready. last log lines:" >&2
    tail -n 40 "$LOG_FILE" >&2
    rm -f "$INSTANCE_FILE"
    exit 1
  fi
  if curl -fsS "$BASE_URL/api/gezondheid" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done

if [[ "$READY" != "1" ]]; then
  echo "launch: timed out waiting for $BASE_URL/api/gezondheid" >&2
  tail -n 40 "$LOG_FILE" >&2
  kill "$PID" 2>/dev/null || true
  wait "$PID" 2>/dev/null || true
  rm -f "$INSTANCE_FILE"
  exit 1
fi

LISTEN_PID="$(lsof -nP -iTCP:"$MOTIAN_VERIFY_PORT" -sTCP:LISTEN -t 2>/dev/null | head -n 1 || true)"
if [[ -z "$LISTEN_PID" ]]; then
  LISTEN_PID="null"
fi
write_instance "$LISTEN_PID"

echo "launch: ready at $BASE_URL (evidence → $EVIDENCE_DIR)"
cat "$INSTANCE_FILE"
