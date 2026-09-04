#!/usr/bin/env bash
# Read-only check: is this verification instance worth driving?
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

fail() {
  echo "doctor: FAIL — $1" >&2
  exit 1
}

if [[ ! -f "$INSTANCE_FILE" ]]; then
  fail "no $INSTANCE_FILE. Do not drive a shared/user pnpm dev. Run bin/launch.sh first."
fi

HOST="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["host"])' "$INSTANCE_FILE")"
PORT="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["port"])' "$INSTANCE_FILE")"
PID="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["pid"])' "$INSTANCE_FILE")"
LISTEN_PID="$(python3 -c 'import json,sys; v=json.load(open(sys.argv[1])).get("listenPid"); print(v if v not in (None, "null") else "")' "$INSTANCE_FILE")"
URL="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["baseUrl"])' "$INSTANCE_FILE")"
RUN_ID="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["runId"])' "$INSTANCE_FILE")"

if [[ "$PORT" == "$USER_DEV_PORT" ]]; then
  fail "instance file points at port $USER_DEV_PORT (user default). Refuse to drive."
fi

WRAPPER_ALIVE=0
LISTEN_ALIVE=0
kill -0 "$PID" 2>/dev/null && WRAPPER_ALIVE=1
if [[ -n "$LISTEN_PID" ]] && kill -0 "$LISTEN_PID" 2>/dev/null; then
  LISTEN_ALIVE=1
fi
if [[ "$WRAPPER_ALIVE" != "1" && "$LISTEN_ALIVE" != "1" ]]; then
  fail "pid $PID (and listenPid ${LISTEN_PID:-none}) are not running. Run bin/cleanup.sh then bin/launch.sh."
fi

LISTEN_PIDS="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null || true)"
if [[ -z "$LISTEN_PIDS" ]]; then
  fail "nothing is listening on $HOST:$PORT."
fi

belongs_to_wrapper() {
  local current="$1"
  local depth=0
  while [[ -n "$current" && "$current" != "0" && "$depth" -lt 8 ]]; do
    if [[ "$current" == "$PID" || ( -n "$LISTEN_PID" && "$current" == "$LISTEN_PID" ) ]]; then
      return 0
    fi
    current="$(ps -o ppid= -p "$current" 2>/dev/null | tr -d ' ')"
    depth=$((depth + 1))
  done
  return 1
}

OWNED=0
for listen_pid in $LISTEN_PIDS; do
  if belongs_to_wrapper "$listen_pid"; then
    OWNED=1
  fi
done
if [[ "$OWNED" != "1" ]]; then
  fail "port $PORT is listening, but not in the process tree of pid $PID / listenPid ${LISTEN_PID:-none}. Do not drive it."
fi

HEALTH_FILE="$(mktemp)"
if ! curl -fsS "$URL/api/gezondheid" -o "$HEALTH_FILE"; then
  rm -f "$HEALTH_FILE"
  fail "$URL/api/gezondheid did not return 2xx. Server is up but not healthy enough to drive."
fi

if ! python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); assert "overall" in d; assert d["overall"] in ("gezond","waarschuwing","kritiek")' "$HEALTH_FILE"; then
  echo "doctor: gezondheid body:" >&2
  cat "$HEALTH_FILE" >&2
  rm -f "$HEALTH_FILE"
  fail "gezondheid JSON missing overall in {gezond,waarschuwing,kritiek}."
fi
OVERALL="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["overall"])' "$HEALTH_FILE")"
rm -f "$HEALTH_FILE"

OVERZICHT="$(mktemp)"
if ! curl -fsS "$URL/overzicht" -o "$OVERZICHT"; then
  rm -f "$OVERZICHT"
  fail "$URL/overzicht did not return 2xx."
fi
if ! grep -q "Overzicht" "$OVERZICHT"; then
  rm -f "$OVERZICHT"
  fail "/overzicht HTML does not contain Overzicht. Wrong app or error page."
fi
if ! grep -q "Motian" "$OVERZICHT"; then
  rm -f "$OVERZICHT"
  fail "/overzicht HTML does not contain Motian."
fi
rm -f "$OVERZICHT"

echo "doctor: OK"
echo "  runId=$RUN_ID"
echo "  pid=$PID"
echo "  url=$URL"
echo "  gezondheid.overall=$OVERALL"
echo "  page=/overzicht contains Motian + Overzicht"
echo "  isolation=port $PORT (not $USER_DEV_PORT); Neon data is still the shared DATABASE_URL"
echo "  drive only read-only recipes unless the user authorizes writes"
