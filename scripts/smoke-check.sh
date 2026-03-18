#!/usr/bin/env bash
# Deployment smoke checks for Přístav Radosti
# Usage:
#   BASE_URL=https://staging.example.com ./scripts/smoke-check.sh
# Optional env:
#   CURL_TIMEOUT=10
#   RETRIES=3
#   RETRY_DELAY=2
#   ALLOW_DEGRADED=0   # set to 1 to allow /health/detailed status=degraded

set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1}"
BASE_URL="${BASE_URL%/}"
CURL_TIMEOUT="${CURL_TIMEOUT:-10}"
RETRIES="${RETRIES:-3}"
RETRY_DELAY="${RETRY_DELAY:-2}"
ALLOW_DEGRADED="${ALLOW_DEGRADED:-0}"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

pass_count=0

log() {
  printf '[smoke] %s\n' "$*"
}

fail() {
  printf '[smoke] ERROR: %s\n' "$*" >&2
  exit 1
}

fetch() {
  local path="$1"
  local body_file="$2"
  local headers_file="$3"
  local status=""

  for attempt in $(seq 1 "$RETRIES"); do
    status=$(curl -sS -L \
      --connect-timeout "$CURL_TIMEOUT" \
      --max-time "$CURL_TIMEOUT" \
      -D "$headers_file" \
      -o "$body_file" \
      -w '%{http_code}' \
      "$BASE_URL$path" || true)

    if [[ "$status" =~ ^[0-9]{3}$ ]]; then
      echo "$status"
      return 0
    fi

    if [[ "$attempt" -lt "$RETRIES" ]]; then
      sleep "$RETRY_DELAY"
    fi
  done

  echo "000"
}

assert_status() {
  local path="$1"
  local expected="$2"
  local description="$3"
  local body_file="$TMP_DIR/body$(echo "$path" | tr '/?.=&' '_')"
  local headers_file="$TMP_DIR/headers$(echo "$path" | tr '/?.=&' '_')"
  local status

  status="$(fetch "$path" "$body_file" "$headers_file")"
  if [[ "$status" != "$expected" ]]; then
    log "$description -> expected HTTP $expected, got $status"
    sed -n '1,20p' "$body_file" >&2 || true
    fail "$path failed"
  fi

  pass_count=$((pass_count + 1))
  log "OK $description ($path -> $status)"
}

assert_contains() {
  local path="$1"
  local needle="$2"
  local description="$3"
  local body_file="$TMP_DIR/body$(echo "$path" | tr '/?.=&' '_')"
  local headers_file="$TMP_DIR/headers$(echo "$path" | tr '/?.=&' '_')"
  local status

  status="$(fetch "$path" "$body_file" "$headers_file")"
  if [[ ! "$status" =~ ^2 ]]; then
    log "$description -> expected 2xx, got $status"
    sed -n '1,20p' "$body_file" >&2 || true
    fail "$path failed"
  fi

  if ! grep -Fq "$needle" "$body_file"; then
    log "$description -> missing expected text: $needle"
    sed -n '1,20p' "$body_file" >&2 || true
    fail "$path content check failed"
  fi

  pass_count=$((pass_count + 1))
  log "OK $description ($path contains $needle)"
}

assert_health_detailed() {
  local body_file="$TMP_DIR/body_health_detailed"
  local headers_file="$TMP_DIR/headers_health_detailed"
  local status
  local parsed
  local health_status
  local version
  local db_ok

  status="$(fetch "/health/detailed" "$body_file" "$headers_file")"
  if [[ "$status" != "200" ]]; then
    sed -n '1,20p' "$body_file" >&2 || true
    fail "/health/detailed returned HTTP $status"
  fi

  parsed="$(node -e '
const fs = require("fs");
const input = fs.readFileSync(process.argv[1], "utf8");
const data = JSON.parse(input);
const out = {
  status: data.status,
  version: data.version,
  dbOk: Boolean(data.db && data.db.ok),
  dbLatencyMs: data.db && typeof data.db.latencyMs === "number" ? data.db.latencyMs : null,
  pendingReminders: typeof data.pendingReminders === "number" ? data.pendingReminders : null
};
process.stdout.write(JSON.stringify(out));
' "$body_file")"

  health_status="$(echo "$parsed" | node -e 'const data = JSON.parse(require("fs").readFileSync(0, "utf8")); process.stdout.write(String(data.status ?? "unknown"));')"
  version="$(echo "$parsed" | node -e 'const data = JSON.parse(require("fs").readFileSync(0, "utf8")); process.stdout.write(String(data.version ?? "unknown"));')"
  db_ok="$(echo "$parsed" | node -e 'const data = JSON.parse(require("fs").readFileSync(0, "utf8")); process.stdout.write(String(data.dbOk));')"

  if [[ "$ALLOW_DEGRADED" == "1" ]]; then
    [[ "$health_status" == "ok" || "$health_status" == "degraded" ]] || fail "/health/detailed status is $health_status"
  else
    [[ "$health_status" == "ok" ]] || fail "/health/detailed status is $health_status (set ALLOW_DEGRADED=1 to permit degraded during maintenance)"
  fi

  [[ "$db_ok" == "true" ]] || fail "/health/detailed reports db.ok=false"

  pass_count=$((pass_count + 1))
  log "OK detailed health (status=$health_status version=$version db.ok=$db_ok)"
}

log "Base URL: $BASE_URL"
assert_status "/health" "200" "basic health endpoint"
assert_contains "/health/ping" 'pong' "ping endpoint"
assert_health_detailed
assert_status "/docs" "200" "Swagger UI"
assert_status "/manifest.json" "200" "PWA manifest"
assert_status "/offline" "200" "offline fallback page"
assert_status "/login" "200" "login page"

log "Smoke checks passed: $pass_count"
