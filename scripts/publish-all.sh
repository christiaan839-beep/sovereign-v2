#!/usr/bin/env bash
# Publish all @sovereign-matrix/* packages to npm in dependency order.
#
# Usage:
#   scripts/publish-all.sh           # publishes every package
#   scripts/publish-all.sh --dry-run # walks every package without publishing
#   scripts/publish-all.sh --otp 123456  # one-time-password for 2FA accounts
#
# Order is intentional. verifiable-receipts must publish FIRST because every
# other package declares it as a peer dependency at ">=0.3.0" — if it's not
# on the registry yet, the wrappers will fail to publish (npm validates peers
# against the live registry at publish time).
#
# Prerequisites:
#   1. Run `npm login` (with the sovereign-matrix npm org)
#   2. Confirm `npm whoami` shows the right user
#   3. Confirm the npm org "@sovereign-matrix" exists and you're a member
#
# Safety:
#   - Each package's prepublishOnly script (`npm run build`) re-runs tsc to
#     guarantee dist/ matches src/. Don't publish stale binaries.
#   - The script exits on first failure — half-published states are recoverable
#     manually (just re-run; published packages will fail and be skipped).
#   - --dry-run uses `npm publish --dry-run` which shows exactly what would
#     ship without contacting the registry.

set -euo pipefail

DRY_RUN=""
OTP_ARG=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN="--dry-run"; shift ;;
    --otp) OTP_ARG="--otp $2"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

# Dependency-ordered list. verifiable-receipts MUST be first.
PACKAGES=(
  verifiable-receipts
  openai-receipts
  anthropic-receipts
  google-receipts
  ai-sdk-receipts
  annex-iv
  iso-42001
  nist-ai-rmf
  soc2-evidence
  gdpr-dpia
  hipaa-security
  mcp
)

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# Pre-flight checks.
if ! command -v npm >/dev/null 2>&1; then
  echo "ERROR: npm not in PATH" >&2; exit 1
fi
if [[ -z "$DRY_RUN" ]]; then
  if ! npm whoami >/dev/null 2>&1; then
    echo "ERROR: not logged in to npm. Run \`npm login\` first." >&2
    exit 1
  fi
  WHOAMI=$(npm whoami)
  echo "Publishing as: $WHOAMI"
  echo "Target registry: $(npm config get registry)"
  echo ""
  read -rp "Confirm publish of 12 packages to npm? [y/N] " confirm
  [[ "$confirm" == "y" || "$confirm" == "Y" ]] || { echo "Aborted."; exit 0; }
fi

for pkg in "${PACKAGES[@]}"; do
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo "  $pkg"
  echo "═══════════════════════════════════════════════════════════════"

  pkg_dir="packages/$pkg"
  if [[ ! -f "$pkg_dir/package.json" ]]; then
    echo "  ✗ no package.json at $pkg_dir — skipping"
    continue
  fi

  pkg_name=$(node -p "require('./$pkg_dir/package.json').name")
  pkg_version=$(node -p "require('./$pkg_dir/package.json').version")
  echo "  $pkg_name@$pkg_version"

  # Already published at this version? Skip cleanly.
  if [[ -z "$DRY_RUN" ]]; then
    if npm view "$pkg_name@$pkg_version" version >/dev/null 2>&1; then
      echo "  ⏭  Already on registry — skipping"
      continue
    fi
  fi

  (cd "$pkg_dir" && npm publish $DRY_RUN $OTP_ARG)
  echo "  ✓ Published"
done

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Done."
echo "═══════════════════════════════════════════════════════════════"
if [[ -n "$DRY_RUN" ]]; then
  echo "  (dry-run — nothing was published)"
else
  echo "  All packages live at https://www.npmjs.com/org/sovereign-matrix"
fi
