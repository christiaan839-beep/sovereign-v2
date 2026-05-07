# Deployment Runbook

The single document for taking Sovereign Matrix from a green CI build
to live on `sovereignmatrix.agency`. Operator-facing — written so the
founder (or a future on-call engineer) can ship without re-deriving
context from the codebase.

This file is paired with `scripts/go-live.sh`, which runs an
interactive walkthrough of the same steps.

---

## Prerequisites

Before opening this file, you should have:

- A green CI on the PR you intend to merge (`Lint & Type Check`,
  `Build`, `Test`, `Security Regression`, `Security Audit` all ✓)
- Vercel CLI authenticated (`vercel login`)
- Neon Console access for the production database
- Clerk Dashboard access for the production environment
- Admin access to whichever payment provider(s) you intend to use
  (PayPal, Yoco, PayFast, Paystack)
- Resend Dashboard access (sovereignmatrix.agency domain)

---

## Step 1 — Merge the PR

The Vercel project is wired to `main` (GitHub-native deploys).
Merging the PR triggers an automatic production deploy. Vercel
typically completes the build in ~3 minutes.

```bash
# Verify branch is clean and CI is green
git fetch origin
git status
gh pr checks <PR_NUMBER>

# If everything is green, merge through GitHub:
gh pr merge <PR_NUMBER> --squash
```

Watch the Vercel deploy: <https://vercel.com/sovereign-matrix/sovereign-v2>

**Failure mode**: if the build fails, check the deploy logs. Most
common: a missing required env var (see Step 3 below). Vercel will
not roll back automatically; you must manually click "Promote to
Production" on the previous successful deploy.

---

## Step 2 — Apply database migrations

The codebase introduces new schema that must land before the new
features can read/write correctly. Migration application is **idempotent**
— re-running `MIGRATIONS-RUNME.sql` is safe.

```bash
# 1. Open Neon Console → SQL Editor
#    https://console.neon.tech/app/projects

# 2. Paste the entire contents of MIGRATIONS-RUNME.sql
#    The file is at the repository root.

# 3. Click "Run". Verification SELECTs at the bottom should return:
#    - 16 rows from the table existence check
#    - 6 rows from the welcome_* column check
#    - 1 row each from deployment_profile + usage.tenant_id checks
#    - 3 rows from the kill-switch column check
```

**Failure mode**: if a `42P01` (relation does not exist) error appears,
re-paste the file from the top — `IF NOT EXISTS` makes every statement
safe to re-run. If you see a constraint violation, your existing data
already has values outside the enum (`deployment_profile` only allows
cloud / byo-gpu / air-gapped) — you'll need to manually update those
rows first.

---

## Step 3 — Set environment variables in Vercel

The new code requires several env vars that may not exist yet. Use
`/admin/preflight` after the deploy to confirm all are set.

### Required (production must not deploy without these)

```
DATABASE_URL                     # already set
CLERK_SECRET_KEY                 # already set
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY # already set
NEXT_PUBLIC_APP_URL=https://sovereignmatrix.agency
ADMIN_USER_IDS=user_xxx,user_yyy # comma-separated Clerk user IDs
CRON_SECRET=$(openssl rand -hex 32)
```

### New in this release

```
MCP_API_KEY=$(openssl rand -hex 32)        # gates /api/mcp
RESEND_FROM_DOMAIN=sovereignmatrix.agency  # health endpoint verifies SPF/DKIM
```

### Webhook secrets (configure providers next, then come back)

```
CLERK_WEBHOOK_SECRET             # from Clerk → Webhooks
PAYPAL_CLIENT_ID                 # PayPal Developer Dashboard
PAYPAL_CLIENT_SECRET
PAYPAL_WEBHOOK_ID
YOCO_SECRET_KEY                  # Yoco Developer Portal (optional)
YOCO_WEBHOOK_SECRET
```

To set via CLI:

```bash
vercel env add MCP_API_KEY production
# Paste the generated key when prompted
vercel env add RESEND_FROM_DOMAIN production
# Type: sovereignmatrix.agency
```

After setting env vars, re-deploy: Vercel does this automatically when
you change env vars on a production branch. If it doesn't, force it:

```bash
vercel --prod
```

---

## Step 4 — Configure provider webhooks

Each provider needs a webhook endpoint pointed at our domain, with
the events we care about subscribed.

### Clerk

```
Endpoint: https://sovereignmatrix.agency/api/webhooks/clerk
Events:   user.created
Signing secret → CLERK_WEBHOOK_SECRET in Vercel
```

### PayPal (live mode)

```
Endpoint: https://sovereignmatrix.agency/api/_payments/paypal/webhook
Events:
  - BILLING.SUBSCRIPTION.ACTIVATED
  - BILLING.SUBSCRIPTION.UPDATED
  - BILLING.SUBSCRIPTION.CANCELLED
  - BILLING.SUBSCRIPTION.EXPIRED
  - PAYMENT.SALE.COMPLETED
Webhook ID → PAYPAL_WEBHOOK_ID in Vercel
```

### Yoco

```
Endpoint: https://sovereignmatrix.agency/api/_payments/yoco/webhook
Events:   payment.succeeded, payment.created
Signing secret → YOCO_WEBHOOK_SECRET in Vercel
```

### Resend (email deliverability)

The `/api/health` endpoint will report `email: "warn"` until the
sender domain is fully verified.

1. Resend Dashboard → Domains → Add Domain → `sovereignmatrix.agency`
2. Copy the SPF, DKIM, and DMARC records into your DNS provider
3. Wait for `Status: verified` (typically <1 hour after DNS propagation)
4. Hit `/api/health` — `email` should now be `"ok"`

---

## Step 5 — Run preflight check

The single dashboard for "are we ready?". Sign in as an admin (your
Clerk user ID must be in `ADMIN_USER_IDS`):

```
https://sovereignmatrix.agency/admin/preflight
```

Read the verdict at the top:

| Verdict            | Meaning                                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------- |
| `go`               | Every check green. Ship without hesitation.                                                              |
| `go-with-warnings` | All blockers cleared; some optional items are amber. Acceptable to ship if you've reviewed each warning. |
| `block`            | At least one blocker is red. **Do not** flip customer-facing payment to live until cleared.              |

Click into each red row and follow the `reason` field — it tells you
exactly which env var, migration, or service to fix.

---

## Step 6 — Smoke test the new public surfaces

Run these checks from outside any auth session (incognito window OR `curl`):

```bash
DOMAIN=https://sovereignmatrix.agency

# Public pages — all should return 200
curl -s -o /dev/null -w "%{http_code}\n" $DOMAIN/
curl -s -o /dev/null -w "%{http_code}\n" $DOMAIN/standards
curl -s -o /dev/null -w "%{http_code}\n" $DOMAIN/proof
curl -s -o /dev/null -w "%{http_code}\n" $DOMAIN/letters
curl -s -o /dev/null -w "%{http_code}\n" $DOMAIN/status
curl -s -o /dev/null -w "%{http_code}\n" $DOMAIN/.well-known/security.txt
curl -s -o /dev/null -w "%{http_code}\n" $DOMAIN/sitemap.xml

# Health endpoint — should be 200 with status:"ok"
curl -s $DOMAIN/api/health | jq '.status, .services'

# MCP endpoint — should be 401 if MCP_API_KEY is set, otherwise the
# rate-limit gate keeps it safe in dev:
curl -s -X POST $DOMAIN/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}' | jq '.error // .result | keys'
```

If any return 404 or 5xx, the deploy hasn't fully propagated or the
build silently failed. Check Vercel deploy logs.

---

## Step 7 — Land your first customer

The platform is now ready. The next gain in readiness comes from a
real customer, not a code commit. The wedge to lead with:

> "50 hand-reviewed B2B leads in 30 days into your Slack — or your
> $4,999 setup fee back, no support ticket. Flat $999/mo after."

When the first paid pilot signs:

1. Run `POST /api/_admin/onboard-customer` (or `/admin/onboard`) with
   their Clerk user ID, first name, and intended first delivery date.
2. Record the welcome video, paste the Loom URL into Neon
   (`tenants.welcome_loom_url` for that tenant id).
3. Send them the link: `https://sovereignmatrix.agency/welcome/{tenantId}`.
4. Ship the first delivery on the next Monday by 9am their timezone.
5. Record the delivery via `POST /api/_admin/record-delivery` with
   `tenantId`, `deliveryDate` (a Monday), `leadCount`, and
   `handReviewedBy` (operator name).

The homepage delivery-receipt strip will switch from "Standing up the
proof feed" to live numbers within seconds (the record-delivery
endpoint calls `revalidatePath` on `/`, `/proof`, and
`/api/proof/stats`).

---

## Rollback

If a deploy breaks something irreparable, the fastest recovery:

```bash
# 1. Identify the last-known-good deploy
vercel deployments list --prod --limit 5

# 2. Promote it back to production
vercel promote <deploy-url> --prod

# 3. Revert the merge commit on main
git revert -m 1 <merge-commit-sha>
git push origin main
```

The schema-level changes (migrations 0023, 0024) are additive — leaving
them in place after a rollback is safe; the old code simply doesn't
read the new columns.

If the migration itself caused the failure (e.g. constraint violation
on existing data), you can drop the new constraint:

```sql
ALTER TABLE tenants DROP CONSTRAINT tenants_deployment_profile_check;
```

The application code falls back to `cloud` profile for any tenant
without an explicit value, so nothing breaks.

---

## Monitoring after go-live

Set these dashboards as bookmarks, in this order of importance:

1. **`/admin/preflight`** — go/no-go verdict. Should always be `go`
   in production.
2. **`/admin/health`** — per-service traffic light. Auto-refreshes
   every 30s.
3. **`/admin/customers`** — Monday delivery dashboard.
4. **`/admin/tenants`** — deployment profile + kill-switch console.
5. **Sentry** — set up alerts for any new error pattern at >5/hr.
6. **Vercel deploy logs** — watch for the build duration creeping past
   2 minutes (signals bundle bloat).

The `error-watcher` cron pages `SLACK_OPS_WEBHOOK_URL` if any
high-severity errors land in a 10-minute window. Set `SLACK_OPS_WEBHOOK_URL`
to a private operator channel before relying on it.

---

## When something breaks

`docs/RUNBOOK.md` is the canonical incident-response document. SEV-1
through SEV-3 procedures with 5-step playbooks for each known failure
mode. The kill-switch + deployment-profile procedures (added in this
release) are specifically called out under SEV-2.

If the situation isn't in the runbook: **escalate to the founder**.
Inbox apologies are recoverable; silent SEV-1s aren't.
