#!/usr/bin/env bash
# Lightweight health monitor for cron / external uptime checks.
# Usage:
#   BASE_URL=https://pristav-radosti.cz ./scripts/monitor-health.sh
# Optional env:
#   CURL_TIMEOUT=10
#   MAX_DB_LATENCY_MS=1500
#   FAIL_ON_DEGRADED=1
#   WARN_IF_PENDING_REMINDERS_GT=0

set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1}"
BASE_URL="${BASE_URL%/}"
CURL_TIMEOUT="${CURL_TIMEOUT:-10}"
MAX_DB_LATENCY_MS="${MAX_DB_LATENCY_MS:-1500}"
FAIL_ON_DEGRADED="${FAIL_ON_DEGRADED:-1}"
WARN_IF_PENDING_REMINDERS_GT="${WARN_IF_PENDING_REMINDERS_GT:-0}"

TMP_BODY="$(mktemp)"
trap 'rm -f "$TMP_BODY"' EXIT

ping_code="$(curl -sS -L --connect-timeout "$CURL_TIMEOUT" --max-time "$CURL_TIMEOUT" -o /dev/null -w '%{http_code}' "$BASE_URL/health/ping" || true)"
if [[ "$ping_code" != "200" ]]; then
  echo "CRITICAL ping http=$ping_code base_url=$BASE_URL"
  exit 2
fi

curl -sS -L \
  --connect-timeout "$CURL_TIMEOUT" \
  --max-time "$CURL_TIMEOUT" \
  -o "$TMP_BODY" \
  "$BASE_URL/health/detailed"

summary="$(node -e '
const fs = require("fs");
const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const summary = {
  status: data.status ?? "unknown",
  version: data.version ?? "unknown",
  dbOk: Boolean(data.db && data.db.ok),
  dbLatencyMs: data.db && typeof data.db.latencyMs === "number" ? data.db.latencyMs : -1,
  pendingReminders: typeof data.pendingReminders === "number" ? data.pendingReminders : -1,
  uptime: typeof data.uptime === "number" ? data.uptime : -1,
  features: data.features ?? {}
};
process.stdout.write(JSON.stringify(summary));
' "$TMP_BODY")"

status="$(echo "$summary" | node -e 'const data = JSON.parse(require("fs").readFileSync(0, "utf8")); process.stdout.write(String(data.status));')"
db_ok="$(echo "$summary" | node -e 'const data = JSON.parse(require("fs").readFileSync(0, "utf8")); process.stdout.write(String(data.dbOk));')"
db_latency="$(echo "$summary" | node -e 'const data = JSON.parse(require("fs").readFileSync(0, "utf8")); process.stdout.write(String(data.dbLatencyMs));')"
pending_reminders="$(echo "$summary" | node -e 'const data = JSON.parse(require("fs").readFileSync(0, "utf8")); process.stdout.write(String(data.pendingReminders));')"
version="$(echo "$summary" | node -e 'const data = JSON.parse(require("fs").readFileSync(0, "utf8")); process.stdout.write(String(data.version));')"
uptime="$(echo "$summary" | node -e 'const data = JSON.parse(require("fs").readFileSync(0, "utf8")); process.stdout.write(String(data.uptime));')"
features="$(echo "$summary" | node -e 'const data = JSON.parse(require("fs").readFileSync(0, "utf8")); const enabled = Object.entries(data.features || {}).filter(([, v]) => Boolean(v)).map(([k]) => k).sort(); process.stdout.write(enabled.join(",") || "none");')"

if [[ "$db_ok" != "true" ]]; then
  echo "CRITICAL status=$status version=$version db_ok=$db_ok db_latency_ms=$db_latency pending_reminders=$pending_reminders uptime=$uptime features=$features"
  exit 2
fi

if (( db_latency > MAX_DB_LATENCY_MS )); then
  echo "CRITICAL status=$status version=$version db_ok=$db_ok db_latency_ms=$db_latency threshold_ms=$MAX_DB_LATENCY_MS pending_reminders=$pending_reminders uptime=$uptime features=$features"
  exit 2
fi

if [[ "$status" == "degraded" && "$FAIL_ON_DEGRADED" == "1" ]]; then
  echo "CRITICAL status=$status version=$version db_ok=$db_ok db_latency_ms=$db_latency pending_reminders=$pending_reminders uptime=$uptime features=$features"
  exit 2
fi

if (( pending_reminders > WARN_IF_PENDING_REMINDERS_GT )); then
  echo "WARNING status=$status version=$version db_ok=$db_ok db_latency_ms=$db_latency pending_reminders=$pending_reminders threshold=$WARN_IF_PENDING_REMINDERS_GT uptime=$uptime features=$features"
  exit 1
fi

echo "OK status=$status version=$version db_ok=$db_ok db_latency_ms=$db_latency pending_reminders=$pending_reminders uptime=$uptime features=$features"
