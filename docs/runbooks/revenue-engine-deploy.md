# Revenue Engine — Deployment Runbook

Plan 1 is fully shipped in code. This runbook covers the manual steps
required to turn it on in production. Budget: 30 minutes.

## Prerequisites

- Neon Postgres access (Console URL + SQL Editor)
- Stripe Dashboard access (owner role)
- Vercel Dashboard access (project deployments + env vars)

---

## Step 1 — Apply migration 0018 (2 min)

Open Neon Console → your production database → SQL Editor.
Copy-paste the contents of `drizzle/0018_credit_system.sql` and run.

**Verify:**

```sql
SELECT count(*) FROM user_credits;           -- returns 0
SELECT count(*) FROM credit_transactions;    -- returns 0
SELECT count(*) FROM credit_holds;           -- returns 0
```

All three queries should succeed (table exists) and return 0 (empty).

If any query throws "relation does not exist" — migration didn't apply.
Re-run the SQL and check for error messages.

---

## Step 2 — Set environment variables in Vercel (5 min)

Dashboard → Project → Settings → Environment Variables.

**Required (platform won't enforce credits without these):**

```
CRON_SECRET=                 # random 32+ char string for cron auth
STRIPE_SECRET_KEY=           # existing, verify present
STRIPE_WEBHOOK_SECRET=       # existing, verify present
```

**Plan-specific Stripe price IDs (required to sell the tiers):**

```
STRIPE_PRICE_ARRAY=          # Growth $49/mo recurring
STRIPE_PRICE_NODE=           # Sovereign Node $199/mo recurring
STRIPE_PRICE_ENTERPRISE=     # Enterprise $499/mo recurring
```

If these are not set yet, create them in Stripe:
1. Stripe Dashboard → Products → New product
2. Name: "Sovereign Matrix — Growth" / "Node" / "Enterprise"
3. Pricing: Recurring, monthly, amount = plan's `priceUsdCents`
4. Copy the price ID (starts with `price_`) into the env var above

**Pay-per-run top-up (optional; only needed to sell pay_per_run):**

Create a Payment Link in Stripe with the amount you want as the default
(e.g., $20). No price ID required — `pay_per_run` uses one-time charges.
Link it from the Billing page's top-up button.

---

## Step 3 — Deploy (3 min)

Push the branch to `main`. Vercel auto-deploys.

In Vercel Deployments, watch for:
- Build succeeds
- Cron config picked up: `/api/cron/sweep-expired-holds` should appear
  in Settings → Crons, running every minute
- First /api/health/deep call after deploy shows `status: "healthy"`

---

## Step 4 — Smoke test in prod (10 min)

### 4a. Verify balance endpoint

```bash
curl -H "Cookie: __session=<your-clerk-session>" \
     https://sovereignmatrix.agency/api/credits/balance
```

Expected:
```json
{
  "balanceCents": 0,
  "plan": "free",
  "monthlyAllocationCents": 50,
  "lowBalance": true
}
```

### 4b. Verify the cron runs

Wait 2 minutes after deploy, then:

```
Vercel Dashboard → Crons → sweep-expired-holds → last run
```

Should show "success" with a `200` response.

### 4c. Verify the widget renders

Sign in at `https://sovereignmatrix.agency/login`, navigate to
`/dashboard`. The sidebar should now show:

- **Runs** (existing usage widget)
- **Credits** (new — shows "$0.00" + "Top up credits" nudge since low-balance)

### 4d. Test a Stripe checkout → credits flow

1. Go to `/pricing` → click "Start with Growth"
2. Complete Stripe checkout with test card 4242 4242 4242 4242
3. After redirect back, sidebar credit balance should show $15.00
   (the Growth monthly allocation)
4. Billing page (`/dashboard/billing`) should show the top-up in the
   recent activity list

If balance doesn't update, check:
- Vercel logs for `Credits topped up on checkout` — if missing, the
  webhook wasn't received or the plan lookup failed
- `stripe_events` table: row should exist with `status=completed`
- `credit_transactions` table: row with `reason=topup`

### 4e. Test an agent run deducts credits

1. With a non-zero balance (ran 4d), go to `/dashboard/playbooks`
2. Run any playbook
3. Watch balance in the sidebar — should tick down by a few cents
   as the playbook's agents run
4. If the playbook finishes, the credits are captured (permanent debit)
5. If it fails, the hold is released (balance restored)

---

## Step 5 — Rollback plan

If anything goes wrong mid-rollout:

**Revert code only:**
```bash
git revert 5aafc561 a89fbadc 765abc19 95b36a49 9a518514 95b12996 27b24981 230a5b9c ce795ffc f6cd8a16
git push origin main
```
This reverts Plan 1 in order (newest first). Safe at any point — the
migration 0018 tables are left in place (harmless if code doesn't use them).

**Revert DB (only if tables cause issues):**
```sql
DROP TABLE IF EXISTS credit_holds CASCADE;
DROP TABLE IF EXISTS credit_transactions CASCADE;
DROP TABLE IF EXISTS user_credits CASCADE;
```
WARNING: this destroys user balances. Only do this if the migration
itself is proven faulty.

---

## Open items after deploy

These aren't blockers — they can be done any time after Plan 1 ships:

- **Customize top-up UX** — the billing page Low-Balance CTA currently
  links to `/dashboard/billing?topup=true`. Wire that query param to
  auto-open the A2E purchase section OR a new Stripe Payment Link.
- **Per-run cost display** — agent result responses don't yet show
  "This run cost: $0.04". Add to the `_meta` envelope in agent-factory
  for transparency.
- **Email notification on low balance** — cron job that sends a one-time
  email when a user's balance drops below $1.
- **Refund policy page** — /legal/refund-policy — document under what
  conditions we refund captured credits (handler crash with no output,
  etc).

Plan 1 ships as-is without these; they're polish.
