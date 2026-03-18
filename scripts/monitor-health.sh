#!/usr/bin/env bash
# Lightweight health monitor for cron / external uptime checks.
# Usage:
#   BASE_URL=https://pristav-radosti.cz ./scripts/monitor-health.sh
# Optional env:
#   CURL_TIMEOUT=10
#   MAX_DB_LATENCY_MS=1500
#   FAIL_ON_DEGRADED=1
#   WARN_IF_PENDING_REMINDERS_GT=0
#   MONITOR_JSON=0              # set to 1 for machine-readable JSON output

set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1}"
BASE_URL="${BASE_URL%/}"
CURL_TIMEOUT="${CURL_TIMEOUT:-10}"
MAX_DB_LATENCY_MS="${MAX_DB_LATENCY_MS:-1500}"
FAIL_ON_DEGRADED="${FAIL_ON_DEGRADED:-1}"
WARN_IF_PENDING_REMINDERS_GT="${WARN_IF_PENDING_REMINDERS_GT:-0}"
MONITOR_JSON="${MONITOR_JSON:-0}"

TMP_BODY="$(mktemp)"
trap 'rm -f "$TMP_BODY"' EXIT

emit_shell_result() {
  local severity="$1"
  local exit_code="$2"
  local details="$3"

  if [[ "$MONITOR_JSON" == "1" ]]; then
    node -e '
const [severity, exitCode, details, baseUrl] = process.argv.slice(1);
const payload = {
  ok: severity === "ok",
  severity,
  exitCode: Number(exitCode),
  baseUrl,
  executedAt: new Date().toISOString(),
  message: details,
};
console.log(JSON.stringify(payload, null, 2));
' "$severity" "$exit_code" "$details" "$BASE_URL"
  else
    echo "$details"
  fi

  exit "$exit_code"
}

ping_code="$(curl -sS -L --connect-timeout "$CURL_TIMEOUT" --max-time "$CURL_TIMEOUT" -o /dev/null -w '%{http_code}' "$BASE_URL/health/ping" || true)"
if [[ "$ping_code" != "200" ]]; then
  emit_shell_result "critical" 2 "CRITICAL ping http=$ping_code base_url=$BASE_URL"
fi

if ! curl -sS -L \
  --connect-timeout "$CURL_TIMEOUT" \
  --max-time "$CURL_TIMEOUT" \
  -o "$TMP_BODY" \
  "$BASE_URL/health/detailed"; then
  emit_shell_result "critical" 2 "CRITICAL failed_to_fetch_detailed_health base_url=$BASE_URL"
fi

node -e '
const fs = require("fs");

const filePath = process.argv[1];
const baseUrl = process.env.BASE_URL;
const maxDbLatencyMs = Number.parseInt(process.env.MAX_DB_LATENCY_MS || "1500", 10);
const failOnDegraded = process.env.FAIL_ON_DEGRADED === "1";
const warnIfPendingRemindersGt = Number.parseInt(process.env.WARN_IF_PENDING_REMINDERS_GT || "0", 10);
const jsonMode = process.env.MONITOR_JSON === "1";

function emit(payload, exitCode) {
  if (jsonMode) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(payload.message);
  }
  process.exit(exitCode);
}

let raw;
try {
  raw = fs.readFileSync(filePath, "utf8");
} catch (error) {
  emit({
    ok: false,
    severity: "critical",
    exitCode: 2,
    baseUrl,
    executedAt: new Date().toISOString(),
    error: `Failed to read health response: ${error instanceof Error ? error.message : String(error)}`,
    message: `CRITICAL failed_to_read_detailed_health base_url=${baseUrl}`,
  }, 2);
}

let data;
try {
  data = JSON.parse(raw);
} catch (error) {
  emit({
    ok: false,
    severity: "critical",
    exitCode: 2,
    baseUrl,
    executedAt: new Date().toISOString(),
    error: `Invalid JSON from /health/detailed: ${error instanceof Error ? error.message : String(error)}`,
    responseSnippet: raw.slice(0, 500),
    message: `CRITICAL invalid_json health_detailed base_url=${baseUrl}`,
  }, 2);
}

const summary = {
  status: data.status ?? "unknown",
  version: data.version ?? "unknown",
  dbOk: Boolean(data.db && data.db.ok),
  dbLatencyMs: data.db && typeof data.db.latencyMs === "number" ? data.db.latencyMs : -1,
  pendingReminders: typeof data.pendingReminders === "number" ? data.pendingReminders : -1,
  uptime: typeof data.uptime === "number" ? data.uptime : -1,
  features: data.features ?? {},
};

const enabledFeatures = Object.entries(summary.features)
  .filter(([, value]) => Boolean(value))
  .map(([key]) => key)
  .sort();

const basePayload = {
  ok: true,
  severity: "ok",
  exitCode: 0,
  baseUrl,
  executedAt: new Date().toISOString(),
  summary: {
    status: summary.status,
    version: summary.version,
    dbOk: summary.dbOk,
    dbLatencyMs: summary.dbLatencyMs,
    pendingReminders: summary.pendingReminders,
    uptime: summary.uptime,
    enabledFeatures,
  },
};

function formatMessage(prefix, extras = []) {
  const fields = [
    `status=${summary.status}`,
    `version=${summary.version}`,
    `db_ok=${summary.dbOk}`,
    `db_latency_ms=${summary.dbLatencyMs}`,
    `pending_reminders=${summary.pendingReminders}`,
    `uptime=${summary.uptime}`,
    `features=${enabledFeatures.join(",") || "none"}`,
    ...extras,
  ];
  return `${prefix} ${fields.join(" ")}`;
}

if (!summary.dbOk) {
  emit({
    ...basePayload,
    ok: false,
    severity: "critical",
    exitCode: 2,
    message: formatMessage("CRITICAL"),
  }, 2);
}

if (summary.dbLatencyMs > maxDbLatencyMs) {
  emit({
    ...basePayload,
    ok: false,
    severity: "critical",
    exitCode: 2,
    message: formatMessage("CRITICAL", [`threshold_ms=${maxDbLatencyMs}`]),
  }, 2);
}

if (summary.status === "degraded" && failOnDegraded) {
  emit({
    ...basePayload,
    ok: false,
    severity: "critical",
    exitCode: 2,
    message: formatMessage("CRITICAL"),
  }, 2);
}

if (summary.pendingReminders > warnIfPendingRemindersGt) {
  emit({
    ...basePayload,
    ok: false,
    severity: "warning",
    exitCode: 1,
    message: formatMessage("WARNING", [`threshold=${warnIfPendingRemindersGt}`]),
  }, 1);
}

emit({
  ...basePayload,
  message: formatMessage("OK"),
}, 0);
' "$TMP_BODY"
