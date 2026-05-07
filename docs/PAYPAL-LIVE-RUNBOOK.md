# PAYPAL LIVE — operator runbook

The 12-step procedure to flip `PAYPAL_MODE=live` without losing
money on the first real customer's payment. Block 90 minutes; do
this on a quiet weekday morning, not the day before a launch.

> **Why a runbook.** Every step below has been a real-world incident
> at some other company. The order matters. Skipping #6 (pre-flight
> webhook ping) puts a 5-day lag between "customer paid" and "we
> noticed."

---

## Pre-flight (5 minutes before you start)

- [ ] You have admin access to the live PayPal Business account
      (not the sandbox account)
- [ ] You have a personal credit card you're willing to charge
      $19.00 to, then refund
- [ ] `sovereignmatrix.agency` is attached to the `sovereign-v2`
      Vercel project and serving HTTPS
- [ ] Migrations 0002-0022 are applied in Neon
      (paste `MIGRATIONS-RUNME.sql` if uncertain — it's idempotent)
- [ ] You have the operator Slack workspace open with
      `SLACK_OPS_WEBHOOK_URL` configured

---

## Step 1 — Create the four live Billing Plans

In PayPal Developer Dashboard → My Apps & Credentials → Live → your
production app → **Subscriptions** → Create Plan.

| Plan                              | Price   | Frequency | Plan ID env var                                                  |
| --------------------------------- | ------- | --------- | ---------------------------------------------------------------- |
| Sovereign Matrix — Starter        | $19/mo  | Monthly   | `STRIPE_PRICE_STARTER` (renamed historically; key is `_STARTER`) |
| Sovereign Matrix — Growth         | $49/mo  | Monthly   | `STRIPE_PRICE_ARRAY`                                             |
| Sovereign Matrix — Sovereign Node | $199/mo | Monthly   | `STRIPE_PRICE_NODE`                                              |
| Sovereign Matrix — Enterprise     | $499/mo | Monthly   | `STRIPE_PRICE_ENTERPRISE`                                        |

> Naming legacy: the env vars are prefixed `STRIPE_PRICE_*` because
> the codebase started on Stripe before pivoting to PayPal. The
> values are PayPal Plan IDs (start with `P-...`). One day we
> rename; not today.

Copy each Plan ID (starts with `P-`) into Vercel → Settings → Env.

- [ ] All 4 plan IDs added to Vercel **Production** scope
- [ ] Redeployed (env changes don't pick up until next deploy)

---

## Step 2 — Create the live webhook endpoint

PayPal Developer → Webhooks → Add Webhook.

| Field               | Value                                                         |
| ------------------- | ------------------------------------------------------------- |
| Endpoint URL        | `https://sovereignmatrix.agency/api/_payments/paypal/webhook` |
| Events to subscribe | All four `BILLING.SUBSCRIPTION.*` + `PAYMENT.SALE.COMPLETED`  |
| Description         | `Sovereign Lead Engine subscription lifecycle`                |

After save, PayPal shows the **Webhook ID** (starts with `WH-...`).

- [ ] Webhook ID copied into `PAYPAL_WEBHOOK_ID` env var
- [ ] Vercel redeployed

---

## Step 3 — Set live API credentials in Vercel

PayPal Developer → My Apps → Live → your app shows:

- Client ID (long string)
- Secret (clickable to reveal)

Copy into Vercel **Production** scope:

- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_MODE` — keep on `sandbox` for now. We flip in Step 9.

- [ ] All three env vars set in Production scope only
      (not Preview, not Development)
- [ ] Vercel redeployed

---

## Step 4 — Verify the webhook reachability (from outside Vercel)

PayPal won't successfully send a real event to a URL it can't
reach. Test reachability before any real money moves.

```bash
curl -I https://sovereignmatrix.agency/api/_payments/paypal/webhook
# Expected: HTTP/2 405 (POST-only endpoint correctly rejecting GET)
# NOT expected: 404, 503, or DNS errors
```

- [ ] Returns 405 (route exists, method-restricted)
- [ ] HTTPS handshake completes (no SSL errors)

---

## Step 5 — Verify Slack ops channel

Trigger a test alert through the alert helper to confirm
`SLACK_OPS_WEBHOOK_URL` is reachable.

```bash
curl -X POST $SLACK_OPS_WEBHOOK_URL \
  -H 'Content-Type: application/json' \
  -d '{"text":"📡 PayPal live runbook test ping — ignore"}'
```

- [ ] Test message landed in the ops channel within 5 seconds

---

## Step 6 — PayPal Developer "Send Test Webhook" while still in sandbox mode

PayPal Developer → Webhooks → your webhook → "Send test webhook".
Pick `BILLING.SUBSCRIPTION.ACTIVATED`. Click Send.

What should happen in `< 30 seconds`:

- The route at `/api/_payments/paypal/webhook` returns **400** with
  `{ "error": "Invalid signature" }`. This is **correct** — PayPal's
  test webhooks are signed against your live webhook ID; with
  `PAYPAL_MODE=sandbox` we may verify against the sandbox key
  instead. This is the smoke test that signature verification is
  active.
- A line lands in Vercel runtime logs:
  `level=error module=paypal-webhook "PayPal signature verification
failed"`. **This is also correct** — it's the desired failure
  mode.

If instead you see **200** with `{"received": true}`:
**STOP.** Signature verification is bypassed. Do NOT proceed.
Inspect `src/lib/paypal.ts` `verifyWebhook()` and
`PAYPAL_WEBHOOK_ID` env var.

- [ ] Test webhook returned 400 with signature-failed log
- [ ] Did NOT silently 200

---

## Step 7 — Run migration verification

```sql
SELECT tablename FROM pg_tables WHERE schemaname='public'
  AND tablename IN ('webhook_events', 'subscriptions',
                    'audit_logs', 'tenants');
-- Expected: 4 rows
```

If `webhook_events` is missing, idempotency falls back to
in-memory which evaporates on Lambda cold-starts — a real risk for
double-processing.

- [ ] All 4 tables present

---

## Step 8 — Self-test in sandbox mode (last sandbox check)

While `PAYPAL_MODE=sandbox`:

1. Go to `https://sovereignmatrix.agency/pricing`.
2. Click "Start for $19".
3. Use a sandbox buyer account (PayPal Developer → Accounts).
4. Complete the checkout.

Within 60 seconds:

- [ ] `BILLING.SUBSCRIPTION.ACTIVATED` event arrives at the webhook
- [ ] Row appears in Neon `subscriptions` table for your test user
- [ ] Slack ops channel gets a `🎉 New customer onboarded` ping
- [ ] `webhook_events` table has a row with `status='ok'`

If ANY of these fail, fix it BEFORE proceeding to live.

---

## Step 9 — Flip the switch

Vercel → sovereign-v2 → Settings → Environment Variables → Production.

Change `PAYPAL_MODE` from `sandbox` → `live`. Save. Redeploy.

- [ ] Vercel redeployed with `PAYPAL_MODE=live`
- [ ] Health check `/api/health/deep` shows `payments_paypal: ok`

---

## Step 10 — Live self-test ($19 of your own money)

The single most important step. Do NOT skip.

1. Sign up at `https://sovereignmatrix.agency` with a brand-new
   email (not the operator account — Clerk treats it as a fresh
   customer).
2. Go to `/pricing`. Click "Start for $19".
3. Pay with your real credit card.

Within 60 seconds:

- [ ] PayPal email confirms the charge
- [ ] `subscriptions` table has a row for the new userId with
      `plan='starter'` and `status='active'`
- [ ] Slack ops channel posts the new-customer ping
- [ ] `webhook_events` has `status='ok'` for this event id
- [ ] Welcome email arrives in your inbox (if you set
      `customerEmail` on the test signup)

If ANY of these fail:
**Immediately set `PAYPAL_MODE=sandbox` and redeploy. Refund the
test charge from PayPal Business.** Diagnose before retrying.

---

## Step 11 — Cancel the test sub + verify cancellation flow

In PayPal Business → Activity → find your test sub → Cancel.
Within 60 seconds:

- [ ] `BILLING.SUBSCRIPTION.CANCELLED` arrives at the webhook
- [ ] `subscriptions` row updates to `status='cancelled'`
- [ ] No double-processing (check `webhook_events.status`)
- [ ] No spurious `BILLING.SUBSCRIPTION.UPDATED` follow-ups

Then refund the original $19 charge from PayPal Business → the
transaction.

- [ ] Refund issued
- [ ] Refund email arrived

---

## Step 12 — Document and close

Update `docs/SHIPPED.md` (or this runbook's bottom):

```
PayPal Live activated: YYYY-MM-DD HH:MM
Operator: <name>
First test transaction: <PayPal txn id>
Notes: <anything notable, e.g. "Sentry didn't fire on the
       intentional Step 6 signature failure — investigate">
```

Open `/admin/customers` — should show your test tenant in `red`
status (no delivery yet) and the Monday watchdog will try to alert
you on the next Monday 8:30am UTC. Either delete the test tenant
from Neon or pop a delivery row to make the dashboard clean.

- [ ] Documentation updated
- [ ] Test tenant cleaned up

---

## Rollback procedure

If anything in Steps 9–11 fails AFTER `PAYPAL_MODE=live` is set:

1. Vercel → revert `PAYPAL_MODE` to `sandbox`. Redeploy.
2. PayPal Business → Activity → refund any real charges.
3. Customers who hit the failure window: personal Slack apology
   - manual sub creation OR refund + apology.
4. Open a Sentry incident. The `module=paypal-webhook` filter
   surfaces every webhook failure in the last 30 days.

The reason this runbook exists is so the rollback procedure
above never has to run. It almost always does — at least once.
That's fine. The mistake to avoid is finding out from a customer.

---

## Recurring sanity (monthly)

- [ ] Run a sandbox self-test once a month to confirm signatures
      still verify. PayPal occasionally updates their cert URLs
      and silent breakage is the most common failure.
- [ ] Audit `webhook_events` for `status='processing'` rows older
      than an hour — those are events that started but never
      finished; they signal a real bug.
- [ ] Check Sentry for `module=paypal-webhook` events;
      investigate any new patterns.

The goal is boring. When this runbook is boring, the platform is
healthy.
