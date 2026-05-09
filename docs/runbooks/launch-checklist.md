# Runbook — Soft launch checklist (Bar A)

Everything between "engineering complete" and "real customer can pay
you" is operator action. None of it is code. All of it is necessary.

**Goal of this runbook:** in ~90 minutes of clicking, take this branch
from "demo grade" to "a paying customer can sign up at
sovereignmatrix.agency, pay R349 / mo via Yoco or Stripe, and run their
first packet."

Print this. Tick each box. The order matters — earlier steps gate
later ones.

---

## Phase 0 — Prerequisites (5 min)

- [ ] You have admin access to: **Vercel project** (sovereign-matrix),
      **Neon project** (sovereign-v2), **Clerk dashboard** (production
      app), **Stripe dashboard** (live mode), **GitHub repo**
      (christiaan839-beep/sovereign-v2).
- [ ] Your local machine has `git` and a browser.
- [ ] You're on the right branch:
  ```
  git checkout claude/complete-project-74XPN
  git pull origin claude/complete-project-74XPN
  ```

---

## Phase 1 — Database migrations (10 min · Neon Console)

The branch has migrations 0002–0020 on disk; only 0001 was applied at
the start of the project. Until these run, every authenticated route
that touches `jobs`, `playbook_runs`, `audit_logs`, `packets`, etc.
silently returns empty arrays — graceful, but feature-broken.

- [ ] Open Neon Console → your project → **SQL Editor**.
- [ ] Open the `drizzle/` folder in your local repo. Apply each
      migration file in order:
  - `0002_async_jobs.sql`
  - `0003_playbook_runs.sql`
  - `0004_remaining_tables.sql`
  - `0005_…` through `0019_rls_defense_in_depth.sql`
  - `0020_packets.sql` ← **gates the saved-packet dashboard you
    just shipped — without this, /dashboard/packets is empty**
- [ ] For each: paste the SQL into Neon's editor → **Run**. Should
      see `CREATE TABLE` / `CREATE INDEX` confirmations. If a table
      already exists, the `IF NOT EXISTS` guard skips silently — fine.
- [ ] Verify with one query:
  ```sql
  SELECT table_name
    FROM information_schema.tables
   WHERE table_schema = 'public'
   ORDER BY table_name;
  ```
  Expect ~38 tables including `packets`, `playbook_runs`, `audit_logs`.

**If a migration errors out:** screenshot it, paste into the
db-down.md runbook flow, and don't proceed.

---

## Phase 2 — Vercel env vars (15 min · Vercel Dashboard)

- [ ] Vercel → sovereign-matrix project → **Settings → Environment
      Variables**.
- [ ] Verify each of these exist in **Production** scope (compare to
      `.env.example`). If any are missing, paste the value from your
      provider:

  **Required (gates traffic):**
  - `DATABASE_URL` — Neon production connection string
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — Clerk Production app
  - `CLERK_SECRET_KEY` — same Clerk Production app
  - `GOOGLE_GENERATIVE_AI_API_KEY` **OR** `NVIDIA_NIM_API_KEY` — at
    least one AI provider must be set or `/api/health/ready` returns
    503

  **Required for billing:**
  - `STRIPE_SECRET_KEY` — Stripe Live mode
  - `STRIPE_WEBHOOK_SECRET` — set in Phase 3 below
  - `STRIPE_PRICE_STARTER` — Price ID from Stripe (Phase 3)
  - `STRIPE_PRICE_ARRAY` — Price ID
  - `STRIPE_PRICE_NODE` — Price ID
  - `STRIPE_PRICE_ENTERPRISE` — Price ID

  **Required for tenant flows:**
  - `CLERK_WEBHOOK_SECRET` — set in Phase 4 below
  - `ENCRYPTION_KEY` — random 32+ char string
  - `CRON_SECRET` — random string

  **Strongly recommended:**
  - `UPSTASH_REDIS_REST_URL` + `_TOKEN` — distributed rate limiting
  - `RESEND_API_KEY` — transactional emails
  - `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` — error tracking
  - `TAVILY_API_KEY` — live web research for blog-gen + competitor
  - `NEXT_PUBLIC_APP_URL=https://sovereignmatrix.agency`

- [ ] Click **Save** for each. Vercel will rebuild automatically on
      the next push, but you don't need to push yet.

---

## Phase 3 — Stripe webhook + price IDs (15 min · Stripe Dashboard)

Without this, checkouts complete but plans never sync — users pay and
stay on the free tier. Worst-case customer experience.

- [ ] Stripe Dashboard → **Developers → Webhooks → Add endpoint**.
- [ ] Endpoint URL: `https://sovereignmatrix.agency/api/_payments/stripe/webhook`
- [ ] Events to send (select these specifically — avoid "All events"
      to limit blast radius):
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
  - `invoice.payment_succeeded`
- [ ] Click **Add endpoint** → copy the **Signing secret** (starts
      `whsec_…`).
- [ ] Paste it into Vercel as `STRIPE_WEBHOOK_SECRET` (Production
      scope). Save.

- [ ] Stripe Dashboard → **Products → Add product**. Repeat for each
      tier (Starter $19, Array $49, Node $149, Enterprise $499 — or
      use ZAR if Yoco rails are primary):
  - Recurring monthly price → save → **copy the `price_…` ID**.
- [ ] Paste each into Vercel:
  - `STRIPE_PRICE_STARTER=price_…`
  - `STRIPE_PRICE_ARRAY=price_…`
  - `STRIPE_PRICE_NODE=price_…`
  - `STRIPE_PRICE_ENTERPRISE=price_…`

- [ ] Trigger a manual webhook delivery from the Stripe webhook
      endpoint UI ("Send test webhook" → `checkout.session.completed`)
      to confirm the endpoint returns 200. If it returns 401, the
      signing secret is wrong.

---

## Phase 4 — Clerk webhook (5 min · Clerk Dashboard)

Without this, signup creates a Clerk user but no `users` row in your
DB → the user can sign in but every authenticated route fails to
resolve their tenant.

- [ ] Clerk Dashboard → your Production app → **Webhooks → Add
      Endpoint**.
- [ ] Endpoint URL:
      `https://sovereignmatrix.agency/api/webhooks/clerk`
- [ ] Subscribe to events:
  - `user.created`
  - `user.updated`
  - `user.deleted`
- [ ] Copy the **Signing Secret** → paste into Vercel as
      `CLERK_WEBHOOK_SECRET` (Production scope).

---

## Phase 5 — Promote the deploy (3 min · Vercel)

- [ ] Vercel project → **Deployments**.
- [ ] Find the latest deployment from `claude/complete-project-74XPN`
      (should be the most recent commit on that branch).
- [ ] If it built green: **⋯ → Promote to Production**.
- [ ] If it failed: read the build log, fix locally, push, repeat.

The `sovereignmatrix.agency` domain should now serve the latest code
within ~30 seconds. Hard-refresh the homepage to verify.

---

## Phase 6 — Smoke test (15 min · Your browser)

- [ ] **Homepage:** https://sovereignmatrix.agency loads, hero copy
      reads "One client → a full week of deliverables", competitor
      scan demo input is visible.
- [ ] **Try-it demo:** type `hubspot.com` → click "Scan in 30s" →
      progress steps cycle → result shows weakness + market gap. If
      it errors, check Vercel logs for the `/api/free/run` route.
- [ ] **Sign up:** open an incognito window → click Sign Up → use a
      real email (you can delete the user in Clerk after) → land in
      `/dashboard`. If onboarding hangs, the Clerk webhook isn't
      firing (check Phase 4).
- [ ] **First packet:** go to
      `/playbooks/agency-content-packet` → fill in: Acme Corp,
      acmecorp.com, "Acme builds applicant-tracking software for
      mid-market SaaS HR teams. Differentiator: 1-day setup.", "HR
      leaders at SaaS companies", professional, no competitor →
      Generate. Should return a packet in ~60–90s with all 4 assets.
- [ ] **Saved packet:** check `/dashboard/packets` — your fresh
      run should be at the top of the list. Click it. The detail page
      should render the structured assets.
- [ ] **Print:** click "Print / Save as PDF" on the detail page →
      browser print preview should show a clean white-paper layout.
- [ ] **Health probe:** `GET https://sovereignmatrix.agency/api/health/ready`
      should return `200` with `ready: true`. If 503, check the
      `failures` array in the JSON.

---

## Phase 7 — First paid charge (10 min · Stripe + you)

- [ ] In your incognito session, navigate to `/pricing`.
- [ ] Pick the **Array** tier → click Subscribe → enter a real card
      (use your own; test cards won't trigger production webhooks).
- [ ] Complete checkout → Stripe should redirect to
      `/dashboard?checkout=success&plan=array`.
- [ ] Within ~2 seconds, the dashboard should reflect the upgraded
      plan (array = 500 runs/mo). If it doesn't, the webhook isn't
      firing — verify Phase 3 settings.
- [ ] Confirm in Stripe Dashboard → **Customers** → your record →
      one `subscription.active` row.
- [ ] Confirm in Neon Console → `SELECT * FROM subscriptions ORDER
    BY created_at DESC LIMIT 1;` → matching row.
- [ ] **Refund yourself** in Stripe to validate the dunning flow
      (also gives you a clean state to restart from).

---

## Phase 8 — Make the repo public (1 min · GitHub)

`/now` references the GitHub source as public. Until the repo is
public, that link is a dead end for recruiters who click it.

- [ ] github.com/christiaan839-beep/sovereign-v2 → **Settings →
      Danger Zone → Change visibility → Make public**.
- [ ] Verify the repo loads while logged out.

---

## Phase 9 — Sentry verification (10 min)

- [ ] Hit `/api/sentry-test` (if it exists) or trigger a deliberate
      500 by calling a non-existent agent route. Sentry Issues page
      should show a fresh issue within ~2 minutes.
- [ ] Verify source maps uploaded — open the Sentry issue → the
      stack trace should show real file paths (`src/app/...`) not
      minified `chunks/_app.js:1:12345`. If minified, the
      `SENTRY_AUTH_TOKEN` env var is missing or the build's source-map
      upload step failed.

---

## Phase 10 — Outreach (your call · 30 min)

The platform is now technically able to accept paying customers. The
only missing piece is people knowing it exists.

- [ ] Open `docs/outreach/cold-emails.md`. Add your real
      `cal.com` link wherever the placeholder `{{cal_link}}` appears.
- [ ] Identify 5 names to email this week using
      `docs/outreach/target-research.md`.
- [ ] Send the emails. The platform you just stood up will do nothing
      for you if nobody knows it exists.

---

## Done. You are at Bar A.

The platform is now live, paid, and reachable. From here:

- **Add a customer to `/case-studies`** within the first 30 days of
  paid usage to close the social-proof gap.
- **Watch `/api/health/ready`** weekly. Anything other than `ready:
true` for >5 min should page you.
- **Don't ship Bar B work** (PDF library, advanced renderers, RLS
  Phase 2) until you have at least 10 paying customers telling you
  what to build next. The roadmap comes from real users, not from
  imagination.

If something breaks in the first week, the `docs/runbooks/` directory
has the matching scripts:

| Symptom                                            | Runbook                  |
| -------------------------------------------------- | ------------------------ |
| `/api/health/ready` 503, customers can't sign in   | `db-down.md`             |
| Webhook deliveries failing, agent runs error 42P01 | `migration-drift.md`     |
| Sign-in stuck on "Loading…"                        | `clerk-jwks-failing.md`  |
| Checkout button errors                             | `stripe-keys-rotated.md` |
| CI smoke red, preview shows wrong content          | `smoke-failing.md`       |
| Time to enforce per-tenant DB isolation            | `rls-enforcement.md`     |

You did the engineering. Now do the operator work and ship.
