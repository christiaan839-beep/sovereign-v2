#!/usr/bin/env bash
# scripts/go-live.sh — Sovereign Matrix go-live walkthrough.
#
# Interactive checklist that prints + verifies every step in
# docs/DEPLOYMENT.md. Read-only by default — every external action
# (merging the PR, applying migrations, setting env vars) is gated
# behind an explicit "y" prompt and the script never executes
# destructive operations on the operator's behalf.
#
# Designed to be runnable from a Mac terminal during the actual
# go-live with the founder reading along. ~5 minutes.
#
# Usage:
#   bash scripts/go-live.sh              # walk every step
#   bash scripts/go-live.sh smoke        # only run the smoke tests
#   bash scripts/go-live.sh preflight    # only check the preflight endpoint
#
set -euo pipefail

DOMAIN="${DOMAIN:-https://sovereignmatrix.agency}"
PR_BRANCH="${PR_BRANCH:-claude/complete-project-release-7juox}"

# ─── Colors ─────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  RED=$(printf '\033[31m')
  GREEN=$(printf '\033[32m')
  AMBER=$(printf '\033[33m')
  CYAN=$(printf '\033[36m')
  DIM=$(printf '\033[2m')
  BOLD=$(printf '\033[1m')
  RESET=$(printf '\033[0m')
else
  RED= GREEN= AMBER= CYAN= DIM= BOLD= RESET=
fi

step() { printf "\n${CYAN}${BOLD}▶ %s${RESET}\n" "$1"; }
ok()   { printf "  ${GREEN}✓${RESET} %s\n" "$1"; }
warn() { printf "  ${AMBER}!${RESET} %s\n" "$1"; }
fail() { printf "  ${RED}✗${RESET} %s\n" "$1"; }
hint() { printf "    ${DIM}%s${RESET}\n" "$1"; }

confirm() {
  local prompt="${1:-Continue?}"
  read -r -p "  ${BOLD}${prompt}${RESET} (y/n) " ans
  [[ "$ans" =~ ^[Yy]$ ]]
}

# ─── Subcommand: smoke ──────────────────────────────────────────────
run_smoke() {
  step "Smoke testing $DOMAIN"

  local paths=(/ /standards /proof /letters /status /.well-known/security.txt /sitemap.xml /api/health)
  local failed=0
  for p in "${paths[@]}"; do
    local code
    code=$(curl -sS -o /dev/null -w "%{http_code}" -L "$DOMAIN$p" --max-time 15 || echo "000")
    if [[ "$code" == "200" ]]; then
      ok "$p → 200"
    else
      fail "$p → $code"
      failed=$((failed + 1))
    fi
  done

  step "Health endpoint payload"
  local health
  health=$(curl -sS "$DOMAIN/api/health" --max-time 10 || echo '{"status":"unreachable"}')
  if command -v jq >/dev/null 2>&1; then
    echo "$health" | jq '{status, version, database, services}'
  else
    echo "$health"
    warn "Install jq for prettier output: brew install jq"
  fi

  if [[ $failed -gt 0 ]]; then
    fail "$failed smoke tests failed."
    return 1
  fi
  ok "All smoke tests passed."
}

# ─── Subcommand: preflight ──────────────────────────────────────────
run_preflight() {
  step "Hitting /admin/preflight (requires admin auth in browser)"
  printf "  ${BOLD}Open this URL in a browser tab where you are signed in as an admin:${RESET}\n"
  printf "    ${CYAN}%s/admin/preflight${RESET}\n\n" "$DOMAIN"
  hint "The verdict at the top of the page is the canonical 'are we ready?' answer."
  hint "  go              → ship without hesitation"
  hint "  go-with-warnings → blockers cleared, optional warnings present"
  hint "  block            → at least one red row must be fixed first"
}

# ─── Full walkthrough ───────────────────────────────────────────────
run_full() {
  printf "\n${BOLD}Sovereign Matrix go-live walkthrough${RESET}\n"
  printf "${DIM}Target: %s${RESET}\n" "$DOMAIN"
  printf "${DIM}Branch: %s${RESET}\n" "$PR_BRANCH"

  # Step 1 — local branch state
  step "Step 1 — Verify local branch is clean"
  if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
    warn "Working tree is dirty. Commit or stash before continuing."
    git status --short
  else
    ok "Working tree clean."
  fi

  if git rev-parse --abbrev-ref HEAD 2>/dev/null | grep -q "$PR_BRANCH"; then
    ok "On expected branch ($PR_BRANCH)"
  else
    warn "Not on $PR_BRANCH. Currently on: $(git rev-parse --abbrev-ref HEAD)"
  fi

  # Step 2 — CI status (best-effort via gh)
  step "Step 2 — CI status (last 3 runs)"
  if command -v gh >/dev/null 2>&1; then
    gh run list --branch "$PR_BRANCH" --limit 3 || warn "gh run list failed"
  else
    warn "gh CLI not installed. Check CI manually:"
    hint "https://github.com/christiaan839-beep/sovereign-v2/actions"
  fi

  # Step 3 — merge prompt (operator-driven; we do NOT auto-merge)
  step "Step 3 — Merge the PR"
  hint "After CI is green, merge through GitHub or with:"
  hint "  gh pr merge <PR_NUMBER> --squash"
  hint "Vercel auto-deploys from main within ~3 minutes."

  # Step 4 — migrations
  step "Step 4 — Apply migrations in Neon"
  hint "Open Neon Console → SQL Editor → paste MIGRATIONS-RUNME.sql → Run"
  hint "Verification SELECTs at the bottom should return 16 + 6 + 1 + 1 + 3 rows"

  # Step 5 — env vars
  step "Step 5 — Required new env vars in Vercel"
  cat <<'EOF'
    Set these in Vercel → Project → Settings → Environment Variables (Production):

      MCP_API_KEY=$(openssl rand -hex 32)
      RESEND_FROM_DOMAIN=sovereignmatrix.agency
      ADMIN_USER_IDS=<your Clerk user id>
      CRON_SECRET=$(openssl rand -hex 32)

    If you're using PayPal/Yoco/Clerk webhooks, also set:

      CLERK_WEBHOOK_SECRET
      PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_WEBHOOK_ID
      YOCO_SECRET_KEY, YOCO_WEBHOOK_SECRET
EOF

  # Step 6 — webhook endpoints
  step "Step 6 — Configure provider webhooks"
  cat <<EOF
    Clerk:   $DOMAIN/api/webhooks/clerk
             Events: user.created
    PayPal:  $DOMAIN/api/_payments/paypal/webhook
             Events: BILLING.SUBSCRIPTION.{ACTIVATED,UPDATED,CANCELLED,EXPIRED}
                     PAYMENT.SALE.COMPLETED
    Yoco:    $DOMAIN/api/_payments/yoco/webhook
             Events: payment.succeeded, payment.created
EOF

  # Step 7 — preflight
  run_preflight

  # Step 8 — smoke
  if confirm "Run smoke test now? (verifies the new public surfaces are live)"; then
    run_smoke
  fi

  printf "\n${BOLD}${GREEN}Go-live walkthrough complete.${RESET}\n"
  hint "If anything failed, see docs/RUNBOOK.md for the SEV-tier playbooks."
}

# ─── Main ───────────────────────────────────────────────────────────
case "${1:-full}" in
  smoke)     run_smoke ;;
  preflight) run_preflight ;;
  full|"")   run_full ;;
  *)
    echo "Usage: $0 [full|smoke|preflight]"
    exit 1
    ;;
esac
