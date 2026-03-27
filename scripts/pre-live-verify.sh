#!/usr/bin/env bash
# Pre-live verification — automatizovatelná část runbooku.
# Kompletní fáze 0–6: PRE_LIVE_TEST_BUNDLE.md (kořen repa).
#
# Usage (z kořene monorepa):
#   ./scripts/pre-live-verify.sh
#   SKIP_LOCAL=1 ./scripts/pre-live-verify.sh          # jen health + audit + security matrix
#   HEALTH_URL=http://109.123.243.52/api/health ./scripts/pre-live-verify.sh
#
# ZAP po deployi: ./scripts/security/zap-baseline.sh https://VAŠE-STAGING-URL

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

HEALTH_URL="${HEALTH_URL:-http://109.123.243.52/api/health}"
REPORT_DIR="${REPORT_DIR:-$ROOT/.pre-live-reports}"
mkdir -p "$REPORT_DIR"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
REPORT="$REPORT_DIR/pre-live-$TS.log"

log() { printf '[pre-live] %s\n' "$*" | tee -a "$REPORT"; }

fail() { printf '[pre-live] FAIL: %s\n' "$*" | tee -a "$REPORT" >&2; exit 1; }

log "Report: $REPORT"

if [[ "${SKIP_LOCAL:-0}" != "1" ]]; then
  log "== Fáze 1: CI ekvivalent (install, shared, lint, test, build) =="
  pnpm install --frozen-lockfile
  pnpm -C packages/shared build
  pnpm -r lint
  pnpm -r test
  NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://127.0.0.1:3001}" pnpm -r build

  log "== Fáze 2: Vitest pouze API (explicitní výpis) =="
  pnpm -C apps/api test 2>&1 | tee -a "$REPORT"
else
  log "SKIP_LOCAL=1 — přeskakuji lint/test/build"
fi

log "== Bezpečnost: pnpm audit --production (exit kód může být 1 při nálezech) =="
set +e
pnpm audit --production 2>&1 | tee -a "$REPORT"
AUDIT_EC=${PIPESTATUS[0]}
set -e
if [[ "$AUDIT_EC" -ne 0 ]]; then
  log "Audit hlásí zranitelnosti — posuďte high/critical před go-live (viz výše)."
fi

log "== Deploy smoke: $HEALTH_URL =="
code="$(curl -sS -o /tmp/pre-live-health.json -w '%{http_code}' "$HEALTH_URL" || echo 000)"
if [[ "$code" != "200" ]]; then
  fail "Health HTTP $code očekáváno 200"
fi
if ! grep -q '"status":"ok"' /tmp/pre-live-health.json 2>/dev/null; then
  fail "Health body missing status ok: $(cat /tmp/pre-live-health.json)"
fi
log "Health OK: $(tr -d '\n' </tmp/pre-live-health.json)"

log "== Vitest security matrix (SEC-01–04, RBAC-02/03, AUTH-03 dle PWA_TEST_MATRIX) =="
pnpm -C apps/api test:security-matrix 2>&1 | tee -a "$REPORT"

log "== DAST: po deployi ./scripts/security/zap-baseline.sh <URL> — viz PRE_LIVE_TEST_BUNDLE.md fáze 3b. =="

log "Hotovo. Pro Playwright proti VPS viz PWA_TEST_MATRIX.md §8 (BASE_URL + NEXT_PUBLIC_API_URL + E2E_LOGIN_GAP_MS)."
