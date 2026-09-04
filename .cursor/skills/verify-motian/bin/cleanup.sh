#!/usr/bin/env bash
# Tear down only the instance this skill started. Evidence stays on disk.
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

if [[ ! -f "$INSTANCE_FILE" ]]; then
  echo "cleanup: no instance file; nothing to stop."
  exit 0
fi

PID="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["pid"])' "$INSTANCE_FILE")"
LISTEN_PID="$(python3 -c 'import json,sys; v=json.load(open(sys.argv[1])).get("listenPid"); print(v if v not in (None, "null") else "")' "$INSTANCE_FILE")"
PORT="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["port"])' "$INSTANCE_FILE")"
EVIDENCE_DIR="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("evidenceDir",""))' "$INSTANCE_FILE")"

if [[ "$PORT" == "$USER_DEV_PORT" ]]; then
  echo "cleanup: refusing to kill anything on port $USER_DEV_PORT." >&2
  exit 1
fi

stop_pid() {
  local target="$1"
  [[ -z "$target" ]] && return 0
  if kill -0 "$target" 2>/dev/null; then
    echo "cleanup: sending TERM to pid $target"
    kill "$target" 2>/dev/null || true
    for _ in $(seq 1 20); do
      if ! kill -0 "$target" 2>/dev/null; then
        break
      fi
      sleep 0.25
    done
    if kill -0 "$target" 2>/dev/null; then
      echo "cleanup: sending KILL to pid $target"
      kill -9 "$target" 2>/dev/null || true
    fi
  else
    echo "cleanup: pid $target already gone"
  fi
}

stop_pid "$PID"
stop_pid "$LISTEN_PID"

# Child listeners of recorded pids only — never kill by process name.
if [[ -n "${PORT:-}" ]]; then
  for listen_pid in $(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null || true); do
    ppid="$(ps -o ppid= -p "$listen_pid" 2>/dev/null | tr -d ' ' || true)"
    if [[ "$listen_pid" == "$PID" || "$listen_pid" == "$LISTEN_PID" || "$ppid" == "$PID" || "$ppid" == "$LISTEN_PID" ]]; then
      echo "cleanup: stopping leftover listener pid $listen_pid on port $PORT"
      kill "$listen_pid" 2>/dev/null || true
    fi
  done
fi

rm -f "$INSTANCE_FILE" "$LOG_FILE"
echo "cleanup: instance state removed"
if [[ -n "$EVIDENCE_DIR" ]]; then
  echo "cleanup: evidence retained at $EVIDENCE_DIR"
fi
