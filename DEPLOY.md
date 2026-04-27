# DEPLOY — Shipping the deep-work-proposals branch

Single checklist for taking the 14 (now 19+) commits on
`claude/deep-work-proposals-74s8X` to production. Each step is independent —
do them in order, verify, then move on.

## Pre-flight

```bash
# Sanity: tests + TS regression gate green on the branch tip
npm run test
npm run ts:check
```

Both must pass. If either fails, do NOT deploy — open the failing run and
fix it first. The tests cover billing-critical paths (metering, plan
enforcement, Opus tier guard, idempotency) and a regression here is a
revenue regression.

## 1. Apply the pending DB migration

The branch ships a single combined SQL file at `drizzle/PENDING_PROD.sql`
that bundles 0002–0004 plus the new `deferred_jobs` table and the
`uq_referrals_affiliate_user` unique index. Every statement uses
`IF NOT EXISTS` so re-running is safe.

**Option A — Programmatic (preferred):**

```bash
DATABASE_URL=postgres://... npx tsx scripts/apply-pending-migrations.ts
```

**Option B — Neon Console:** open Neon → SQL Editor → paste the contents of
`drizzle/PENDING_PROD.sql` → Run. Confirm zero errors.

Without this step the following routes return 503:

- `/api/jobs` (uses `jobs`)
- `/api/playbooks/run` (uses `playbook_runs`, `playbook_run_steps`)
- `/api/referrals` (uses `affiliates`, `referrals`)
- `/api/workflows`, `/api/workflows/[id]/run` (uses `workflows`, `playbook_runs`)
- `/api/_cron/churn-alerts` (writes to `audit_logs`)
- The DLQ retry worker (drains `deferred_jobs`)

## 2. Set required env vars on Vercel

Production environment, then preview if you want feature parity in PRs.

| Key                       | What sets it                                | Why                                   |
| ------------------------- | ------------------------------------------- | ------------------------------------- |
| `DATABASE_URL`            | Neon dashboard                              | Already set; verify it points at prod |
| `ENCRYPTION_KEY`          | `openssl rand -hex 32`                      | BYOK keys + settings encryption (P2)  |
| `CRON_SECRET`             | `openssl rand -base64 32`                   | Gates `/api/_cron/*` routes           |
| `WEBHOOK_API_KEY`         | `openssl rand -base64 32`                   | Gates `/api/_agents/webhook-gateway`  |
| `STRIPE_SECRET_KEY`       | Stripe → Developers → API keys              | Subscription checkout                 |
| `STRIPE_WEBHOOK_SECRET`   | Stripe → Webhooks → endpoint signing secret | Subscription lifecycle                |
| `STRIPE_PRICE_STARTER`    | Stripe → Products → Starter                 | Checkout price ID                     |
| `STRIPE_PRICE_ARRAY`      | Stripe → Products → Growth                  | "                                     |
| `STRIPE_PRICE_NODE`       | Stripe → Products → Node                    | "                                     |
| `STRIPE_PRICE_ENTERPRISE` | Stripe → Products → Enterprise              | "                                     |
| `META_APP_SECRET`         | Meta → App → Settings → Basic               | Closer webhook signature verification |
| `META_ACCESS_TOKEN`       | Meta → Page → Access Token                  | Closer outbound IG DM                 |
| `META_ALLOWED_SENDERS`    | comma-separated IG sender IDs               | Default-deny allowlist for outbound   |

Skip any line whose feature you're not running yet — the new code degrades
gracefully (e.g., the closer route returns "AI Engine Offline" instead of
crashing if Gemini key is missing).

## 3. Cron schedules

`vercel.json` already declares two new entries (added in this branch):

- `/api/cron/churn-alerts` — daily at 09:00 UTC, flags paid users with ≥30%
  run-count drop into `audit_logs` (resource: `churn-risk`)
- `/api/cron/dlq-drain` — every 10 minutes, retries failed
  fire-and-forget operations from `deferred_jobs` with exponential backoff

No further cron config needed — Vercel reads `vercel.json` on next deploy.

## 4. Stripe webhook endpoint

In Stripe Dashboard → Developers → Webhooks → "Add endpoint":

- URL: `https://sovereignmatrix.agency/api/_payments/stripe/webhook`
- Events:
  - `checkout.session.completed` (creates subscription + credits affiliate)
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`

Copy the signing secret to `STRIPE_WEBHOOK_SECRET`.

## 5. Smoke test after deploy

```bash
# Replace <prod> with sovereignmatrix.agency
curl https://<prod>/api/teams        # returns { teams: [3 entries] }
curl https://<prod>/api/health/ping  # returns 200

# As an authenticated user, hit a metered route and confirm usage increments
# (response should include _meta + the X-Free-Remaining header decreases)
```

Spot-check the migrations applied:

```sql
SELECT to_regclass('public.deferred_jobs');     -- expect 'deferred_jobs'
SELECT to_regclass('public.affiliates');        -- expect 'affiliates'
SELECT to_regclass('public.workflows');         -- expect 'workflows'
SELECT to_regclass('public.playbook_runs');     -- expect 'playbook_runs'
\d uq_referrals_affiliate_user                  -- expect index, not error
```

## 6. Post-deploy monitoring

For the first 24 hours, tail logs for these warn/error keys (any spike =
investigate):

- `fire-and-forget failed` — silent loss caught by P8's loggedFireForget
- `usage increment failed` — billing leak (P0 + P8 fix)
- `Affiliate attribution failed` — referral credit not landing (P5 + idempotent insert)
- `dlq enqueue ALSO failed` — both the primary op AND its DLQ insert died (escalate)
- `Opus downgraded` / `Extended thinking disabled` — tier guard firing
  (expected when free users try Opus; NOT expected for founder/enterprise)

## Rollback

The branch is additive — every change either adds a new file or wraps
existing logic in a graceful-degradation envelope. To roll back:

```bash
git revert <bad-commit>     # or revert the merge commit
vercel --prod               # ships the revert
```

The `deferred_jobs` and `uq_referrals_affiliate_user` index can be left
in place after a rollback — they're idempotent and unused by older code.
