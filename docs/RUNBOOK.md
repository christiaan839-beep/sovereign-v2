# RUNBOOK

When something breaks, this is the document the on-call operator
opens before they open a Slack DM to the founder. Each scenario
has a 5-step procedure that takes <15 minutes to walk through.

The goal is **boring incident response**. When this file is boring,
the platform is healthy.

---

## Severity tiers

| Tier      | Meaning                                 | Response time     | Examples                                                                               |
| --------- | --------------------------------------- | ----------------- | -------------------------------------------------------------------------------------- |
| **SEV-1** | Customer-facing money loss or data leak | < 15 min          | Charges processed but no DB row; PII exposed publicly; auth bypass                     |
| **SEV-2** | Customer-facing degraded experience     | < 1 hour          | A delivery missed Monday 9am; welcome email failing; AI provider down with no failover |
| **SEV-3** | Internal / cosmetic                     | next business day | Sentry pile-up; standards-check warning; lint regression                               |

---

## SEV-1 procedures

### "Charges processed in PayPal but no row in `subscriptions` table"

1. **Stop the bleed.** In Vercel → Env, flip `PAYPAL_MODE` from
   `live` → `sandbox`. Redeploy. New customers can't pay until
   you fix this.
2. **Audit the gap.** PayPal Business → Activity → filter to
   today's transactions. Cross-reference against
   `SELECT * FROM subscriptions WHERE created_at > now() - interval '24 hours';`.
   Anyone who paid but isn't in the DB is the priority list.
3. **Manually create their subscription rows.**
   ```sql
   INSERT INTO subscriptions (user_id, plan, status, stripe_subscription_id)
   VALUES ('<clerk_id>', '<plan>', 'active', '<paypal_sub_id>');
   ```
   Then run `/admin/onboard` to provision their welcome page.
4. **Personal Slack apology to each affected customer** within
   the hour. Include their welcome URL. Comp them the first
   month if they were charged but had no service.
5. **Diagnose.** Check Sentry → `module=paypal-webhook` for the
   24h window. Most likely cause: webhook URL changed, signature
   verification failing, or a deploy mid-event. Fix root cause
   before re-flipping `PAYPAL_MODE=live`.

### "PII appeared in a public response or email"

1. **Quarantine.** Identify the route + the customer + the time
   window. Take the route offline if you can — `vercel rollback`
   to the previous deploy is the fastest.
2. **Notify the affected customer(s)** within 1 hour. Email
   from the founder personally. Apology, scope of the leak,
   what they can do.
3. **Rotate any exposed credentials.** API keys, webhook
   secrets, BYOK customer keys — anything that may have been in
   logs.
4. **File a written incident report.** Date, time, scope, root
   cause, fix, prevention. Append to `docs/INCIDENTS.md` (create
   it if first one).
5. **Hard re-deploy** with the fix. Verify with the
   `output-verifier` 5-layer pipeline that PII detection is
   active for the affected route.

### "Auth bypass — non-admin loaded `/admin/*`"

1. **Take admin offline.** Set `ADMIN_USER_IDS=` (empty) in
   Vercel env, redeploy. Even you can't log in. Stops the bleed
   in 60 seconds.
2. **Audit `audit_logs`** for admin actions taken by the
   non-admin id since the bypass started.
3. **Reverse anything they did.** Customer welcome data,
   delivery records, plan changes — undo from `audit_logs`.
4. **Diagnose `requireAdmin()`.** The fix is almost always a
   missing `await` on `auth()` or a stale Clerk SDK version.
5. **Re-add admin allowlist + redeploy.** Verify by signing in
   as a non-allowlisted Clerk user and confirming `/admin/*`
   returns 404.

---

## SEV-2 procedures

### "Customer says 'no delivery this Monday'"

1. **Verify in `/admin/customers`.** Their row should be amber
   or red. Confirm the delivery genuinely didn't ship — sometimes
   the operator forgot to record it but it did go out.
2. **Ship the batch immediately.** Even if it's Tuesday — better
   late than empty. Use the standard `lead-blitz` playbook with
   their ICP brief.
3. **Trigger the §03 remedy.** Refund the month via PayPal
   Business → Subscriptions → their sub → Issue Refund. Set
   `subscriptions.status = 'comp_refund'` so accounting is
   honest.
4. **Personal Slack apology in their channel** within the hour:
   "Missed your Monday delivery — that's on us, the month is
   refunded, the batch is in your inbox now, here's what
   happened …"
5. **Update STANDARDS.md** if there's a recurring pattern. If
   the same tenant misses two months in three, they get a
   personal call from the founder.

### "PayPal webhook returning 500"

1. **Check Sentry** filtered to `module=paypal-webhook` for the
   last 24h. The error message tells you which event type is
   failing.
2. **Don't disable the webhook** — that creates a payment-without-
   subscription gap (SEV-1). Instead, leave it returning 500;
   PayPal retries for 24h and the `webhook_events` idempotency
   table prevents double-processing.
3. **Reproduce locally.** Pull the failing event from the
   `webhook_events` table:
   ```sql
   SELECT * FROM webhook_events WHERE provider='paypal' AND status='failed' ORDER BY received_at DESC LIMIT 5;
   ```
4. **Fix the handler.** Most causes: PayPal payload schema
   drifted, plan ID mapping in `plans.ts` is stale, or a
   subscription field is null in production but not sandbox.
5. **Deploy + verify.** PayPal Developer → Webhooks → "Send
   test webhook" + watch the route process the retry within
   60 seconds.

### "AI provider X is down with no failover"

1. **Confirm via `/status`.** The tile should be red. If it's
   green but customers are complaining, the live `/api/health/deep`
   ping is wrong — investigate that endpoint first.
2. **Manually fail over** in `src/lib/ai.ts`. The cascade order
   is documented at the top of the file; temporarily reorder
   so the down provider is at the end (or remove it entirely).
   Deploy.
3. **Record the failover** in `failover_events` (or a Slack
   message if the table doesn't exist yet). PROPOSALS.md #9
   automates this; until then, manual record.
4. **Notify customers proactively** in their Slack channels:
   "Quick note: NIM is currently degraded; we've routed your
   batches to Anthropic for the day. Output quality is unchanged."
5. **Restore when the provider recovers.** Verify with a real
   production call (not just a status ping) before reordering
   the cascade back.

### "Welcome email failing for customer #N"

1. **Check the Sentry event** under `module=welcome-email`. The
   `extra.to` field tells you the recipient; the `extra.status`
   field tells you whether it was a Resend HTTP error or a
   network timeout.
2. **Resend it manually.** Go to `/admin/onboard`, paste the
   tenant id + customer email + form fields, hit Submit. The
   endpoint is idempotent on the welcome-page provisioning;
   re-firing the email is the same UX as the first time.
3. **If Resend domain is unverified** (the most common cause):
   resend.com → Domains → verify `sovereignmatrix.agency` DNS
   records. Until verified, every welcome email lands in spam.
4. **Apologise for the lag** in the customer's Slack channel.
   "Email took an extra hour to land — here's the link directly:
   `<welcomeUrl>`."
5. **No code change usually needed.** This is a config
   issue 95% of the time.

---

## SEV-3 procedures

### "Sentry pile-up (>50 events in 10 min from one source)"

1. Check `module` tag. If it's a single agent route flooding,
   suspend that agent's traffic via the `agent-circuit-breaker`
   for 30 min.
2. Look at the error pattern. Most floods are upstream API
   rate-limit or a single user hammering an endpoint.
3. If it's user-driven, add tighter rate limiting to the route
   in question via `src/lib/rate-limit.ts`.
4. If it's upstream, post in `#sov-ops` Slack so the team knows
   why error volume is spiking before customers notice.
5. Resolve the Sentry issue once the rate is back to baseline.

### "Standards-check cron flags a competitor name in copy"

1. Open the cron's Slack message — it includes `file:line`
   citations.
2. Edit the file to remove the competitor name. Use a generic
   category instead.
3. Push. The cron re-runs Sundays noon UTC; verify the next
   run is clean.
4. Add the competitor name to the cron's known-good
   exceptions list if it was a false positive (e.g., the name
   appears legitimately in a comment about migration history).
5. Update STANDARDS.md §07 if the rule needs refinement.

### "Friday Letter overdue"

1. Open `/admin/letters/new` and write the next letter.
   Even a short one. The cadence matters more than the length.
2. The next standards-check cron will detect the new letter
   and stop pinging.
3. The next Friday Letter (the one you just wrote OR the next)
   should mention the miss honestly: "Skipped last week
   because X. Back this week."
4. If two Fridays slip in a row, `STANDARDS.md` §06 says the
   founder owes themselves an honest write-up of why. Do it.
5. Don't backdate letters. Each letter is its own week.

---

## Operator-on-call rotation

For now: the founder is on-call 24/7.

When the team grows past 1 person, the rotation is:

- One operator per week, rotating Mondays
- Hand-off includes: "what's open in Sentry, what shipped
  this week, what's the next Friday Letter going to cover"
- The off-call operator is genuinely off-call — no Slack pings
  unless SEV-1

Until then: when the founder takes a week off, post a "platform
paused" notice in customer Slack channels and pause new sign-ups
via Vercel env (`SIGNUP_DISABLED=true` — implement when needed).
Honest is better than dropped.

---

## When to escalate

This runbook covers ~95% of incidents. The remaining 5% — novel
failure modes, regulatory inquiries, security disclosures from
external researchers — escalate immediately to:

- The founder (always)
- Our legal counsel (TBD — add when retained)
- Our incident response email: `incidents@sovereignmatrix.agency`
  (TBD — add when set up)

The escalation rule is: **if you're unsure whether to escalate,
escalate.** Inbox apologies are recoverable; silent SEV-1s are
not.

---

## How this runbook stays current

Every incident — even SEV-3 — gets a 3-line entry in
`docs/INCIDENTS.md` (date, what happened, what changed). When the
same procedure runs three times in a quarter, it earns a
permanent slot in this file. When a procedure goes a quarter
without firing, it stays — incident response value isn't
proportional to frequency.

The runbook is allowed to grow. It's not allowed to shrink unless
a documented procedure is genuinely obsolete (e.g., the affected
component was deleted).
