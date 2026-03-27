#!/usr/bin/env bash
# OWASP ZAP Baseline scan against a deployed URL (staging / pre-prod).
# Prerekvizita: Docker.
#
# Usage:
#   ./scripts/security/zap-baseline.sh https://staging.example.com
#
# Výstup (HTML + JSON) do adresáře ZAP_REPORT_DIR (default ./zap-reports).
# Před go-live: projít high findings nebo je formálně akceptovat (viz PRE_LIVE_TEST_BUNDLE.md).

set -euo pipefail

TARGET="${1:-}"
if [[ -z "$TARGET" ]]; then
  echo "Usage: $0 <target-base-url>" >&2
  echo "Example: $0 https://staging.example.com" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ZAP_REPORT_DIR="${ZAP_REPORT_DIR:-$ROOT/zap-reports}"
mkdir -p "$ZAP_REPORT_DIR"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
JSON_NAME="zap-baseline-${TS}.json"
HTML_NAME="zap-baseline-${TS}.html"

echo "[zap-baseline] Target: $TARGET"
echo "[zap-baseline] Reports: $ZAP_REPORT_DIR/$JSON_NAME , $HTML_NAME"

docker run --rm \
  -v "$ZAP_REPORT_DIR:/zap/wrk:rw" \
  ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py \
  -t "$TARGET" \
  -J "/zap/wrk/$JSON_NAME" \
  -r "/zap/wrk/$HTML_NAME" \
  || {
    ec=$?
    echo "[zap-baseline] ZAP exit $ec — baseline často vrací nenulový kód při nálezech; zkontrolujte HTML/JSON." >&2
    exit "$ec"
  }
