#!/usr/bin/env bash
# Runs every browser check against a running app (default http://localhost:3100) and fails on any FAIL line or error.
set -u
cd "$(dirname "$0")/.."
fail=0
# qa.cjs also runs an axe-core accessibility audit when AXE_PATH points to axe.min.js (axe-core is not a project dependency).
for f in e2e/classification.cjs e2e/guidance.cjs e2e/analysis.cjs e2e/reporting.cjs e2e/qa.cjs; do
  echo "== $f"
  out=$(node "$f" 2>&1)
  echo "$out" | grep -E "^(FAIL|ERRORS)" 
  if echo "$out" | grep -qE "^FAIL|Error:|TimeoutError" || ! echo "$out" | grep -q "^ERRORS: none"; then fail=1; echo "$out" | tail -15; fi
done
exit $fail
