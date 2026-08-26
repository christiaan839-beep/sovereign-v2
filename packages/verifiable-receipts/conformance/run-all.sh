#!/usr/bin/env bash
#
# Run every conformance harness against the one fixture corpus.
#
# Why this file exists: the README used to say "CI runs all three harnesses
# on every push". No workflow ran Go or Python, so the sentence was false —
# and on a store that prints the command next to the number, an unrunnable
# claim is worse than no claim. This script is the claim, made executable.
# CI calls it; so can you. There is one definition of "all three agree".
#
#   ./packages/verifiable-receipts/conformance/run-all.sh
#
# A missing toolchain prints SKIP and is counted, never silently ignored:
# a corpus that reports success while testing one language out of three is
# the exact failure mode the corpus exists to prevent.
#
# Exit 0 only when every available harness passed AND none was skipped.

set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKGS="$(cd "$HERE/../.." && pwd)"
ROOT="$(cd "$PKGS/.." && pwd)"

GREEN=$'\033[32m'; RED=$'\033[31m'; YEL=$'\033[33m'; DIM=$'\033[2m'; OFF=$'\033[0m'
pass=0; fail=0; skip=0

FIXTURES=$(find "$HERE/fixtures" -name '*.json' | wc -l | tr -d ' ')
echo
echo "  conformance — ${FIXTURES} fixtures, three verifiers"
echo

run() {                       # run <name> <toolcheck-cmd> <dir> <cmd...>
  local name=$1 probe=$2 dir=$3; shift 3
  if ! eval "$probe" >/dev/null 2>&1; then
    printf '  %s- %-12s%s %sskipped — %s not installed%s\n' "$YEL" "$name" "$OFF" "$DIM" "${probe%% *}" "$OFF"
    skip=$((skip + 1)); return
  fi
  local out started elapsed
  started=$(date +%s%N)
  out=$(cd "$dir" && "$@" 2>&1)
  local status=$?
  elapsed=$(( ($(date +%s%N) - started) / 1000000 ))
  if [ $status -eq 0 ]; then
    printf '  %s✓ %-12s%s %s%sms%s\n' "$GREEN" "$name" "$OFF" "$DIM" "$elapsed" "$OFF"
    pass=$((pass + 1))
  else
    printf '  %s✗ %-12s%s\n' "$RED" "$name" "$OFF"
    echo "$out" | tail -25 | sed 's/^/      /'
    fail=$((fail + 1))
  fi
}

run "TypeScript" "test -x $ROOT/node_modules/.bin/vitest" "$ROOT" \
    "$ROOT/node_modules/.bin/vitest" run "packages/verifiable-receipts/conformance/conformance.test.ts"

run "Python" "python3 -m pytest --version" "$PKGS/verifiable-receipts-py" \
    env PYTHONPATH=. python3 -m pytest -q "$HERE/conformance.py"

# -count=1 disables Go's test cache. Without it, `go test` replayed a
# previous PASS after the fixture corpus had changed underneath it: a
# deliberately-broken 12-fixture corpus made TypeScript and Python fail
# while Go reported green in half the usual time. A conformance runner
# that can serve a stale pass is worse than no runner.
run "Go" "go version" "$PKGS/verifiable-receipts-go" \
    go test ./... -run Conformance -count=1

echo
if [ $fail -gt 0 ]; then
  echo "  ${RED}${fail} harness(es) failed${OFF} — the corpus is the contract; a disagreement is a spec violation"
  echo
  exit 1
fi
if [ $skip -gt 0 ]; then
  echo "  ${YEL}${pass}/3 harnesses ran, ${skip} skipped${OFF} — cross-language agreement is NOT established"
  echo
  exit 1
fi
echo "  ${GREEN}all 3 harnesses agree on all ${FIXTURES} fixtures${OFF}"
echo
