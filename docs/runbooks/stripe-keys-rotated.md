# Runbook: Stripe is broken

## Symptoms

- Pricing page checkout button shows "Something went wrong"
- `/api/payments/stripe/checkout` 503 with `"error": "Stripe not configured"`
  (`STRIPE_SECRET_KEY` missing) or 500 (key invalid)
- Stripe webhook deliveries fail with HTTP 400 `"Invalid signature"`
- `/api/credits` POST returns 503 on a `purchase` request
- Sentry: `StripeAuthenticationError`, `Invalid API key provided`,
  or `No such payment_intent`

## Diagnose

1. Confirm key presence and validity:

   ```bash
   # Anywhere with prod env vars set:
   curl -s -u "$STRIPE_SECRET_KEY:" https://api.stripe.com/v1/balance | jq
   ```

   - 200 with a balance object → key is good
   - 401 `Invalid API key` → key was rotated; update Vercel
   - 200 in test mode but live charges fail → you're on a `sk_test_…`
     key in a live deployment (or vice versa)

2. Check the webhook signing secret:

   ```bash
   curl -i https://sovereignmatrix.agency/api/payments/stripe/webhook \
     -X POST \
     -H "stripe-signature: bad_sig_test" \
     -d '{}'
   ```

   Expect 400 `"Invalid signature"`. If 503, `STRIPE_WEBHOOK_SECRET` is
   missing.

3. Check Stripe Dashboard → Developers → Webhooks → Endpoints
   for failed deliveries. Each failure shows the exact signature error
   and the response body.

## Fix

**Key rotated**:

1. Stripe Dashboard → Developers → API keys → Reveal current secret key
2. Vercel → Settings → Environment Variables → update `STRIPE_SECRET_KEY`
   for the right environments (Production / Preview / Development)
3. Redeploy

**Webhook secret rotated** (Stripe rotates these when you regenerate):

1. Stripe Dashboard → Developers → Webhooks → click your endpoint →
   "Reveal" the signing secret
2. Update `STRIPE_WEBHOOK_SECRET` in Vercel
3. Redeploy

**Price IDs missing** (checkout route returns 503):

1. Stripe Dashboard → Products → confirm prices exist for each plan
2. Copy each `price_…` ID
3. Set in Vercel env: `STRIPE_PRICE_STARTER`, `_ARRAY`, `_NODE`,
   `_ENTERPRISE`
4. Redeploy

**Charged customers but credits weren't granted**:

1. Each `payment_intent.succeeded` event should idempotently grant credits
   via `/api/credits` POST + the user's payment intent
2. Check `audit_logs` for the `credits.purchase` action with that
   `paymentIntentId`
3. If missing, the customer paid but the credit grant didn't fire — grant
   manually with `isAdmin` POST to `/api/credits` with `type: "bonus"`,
   note the `paymentIntentId` in `description` for traceability

## Verify

```bash
curl -s https://sovereignmatrix.agency/api/health/ready | jq '.optional.stripe.status'
# expect: "ok" (presence-only check; verifies env var, not full API call)
```

Then run a Stripe test-mode checkout end-to-end:

1. `/pricing` → click Starter
2. Use test card `4242 4242 4242 4242`
3. Confirm redirect to dashboard
4. Confirm credits balance updates in `/dashboard`
5. Confirm `audit_logs` row with `action = "credits.purchase"`

## Postmortem

- Set up a Stripe webhook **failure** alert (Stripe Dashboard → Webhooks
  → endpoint → "Send notifications when failures hit X"). Don't wait for
  customers to report charge-but-no-credits.
- The `idempotency` store on `credits:payment_intent` prevents
  double-grant. Confirm the test in `src/__tests__/api/credits.test.ts`
  ("blocks replay when intent has already been redeemed") still passes.
- If keys rotated due to a leak, audit `audit_logs` for any successful
  `credits.purchase` between the rotation and the discovery — those may
  need refunding.
