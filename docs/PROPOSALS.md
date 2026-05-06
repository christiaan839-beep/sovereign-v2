# PROPOSALS — the prioritized backlog

The next 12 builds, ranked by leverage. Each is sized so it can ship
in a single session without breaking anything live, and every one
unlocks something specific (revenue, trust, reliability, or
operator throughput).

The rule for adding to this list:

> A proposal earns a slot here only if it answers one of:
>
> - "Will this directly produce a paying customer?"
> - "Will this prevent a class of failure that would lose a customer?"
> - "Will this give the founder back a measurable hour per week?"
>
> Anything else goes in `docs/ideas/` and waits a quarter.

The proposals are deliberately ordered. Skip ahead at your peril —
the dependency arrows go top → bottom. Reordering them is its own
opinionated decision.

---

## 1. Public `/status` page &nbsp; — &nbsp; SHIPPING NOW

**Why now.** The `/api/health/deep` endpoint already runs real pings
against NIM/Anthropic/Gemini/Groq/Postgres. Without a public page on
top, that data sits inside a JSON endpoint nobody opens. A `/status`
page turns it into a trust signal a prospect can send to their boss
("see, here's their on-time rate") and a self-service answer for
the customer who's wondering "is this me or is it broken."

**Effort.** ~1 hour. Server component, ISR-cached at 60 s.

**Unlocks.**

- Inbound prospect trust ("the kind of company that publishes status")
- Customer self-service when something looks slow
- A surface for UptimeRobot to ping with synthetic checks

**Done when.**

- `/status` renders six service tiles with status + latency
- Refreshes every 60 s
- Failure indicator is impossible to miss (red, animated)
- Footer links to `/proof` and `STANDARDS.md` so the trust narrative compounds

---

## 2. DB-backed Friday Letters + `/admin/letters/new` writer &nbsp; — &nbsp; SHIPPING NOW

**Why now.** STANDARDS.md §06 mandates a Friday Letter every Friday at
5 pm. Today, adding a letter requires editing `src/lib/letters.ts`

- committing + waiting for a Vercel deploy. By the third Friday
  that friction kills the discipline. Moving letters into the
  database via `/admin/letters/new` removes the deploy round-trip and
  makes the cadence sustainable for a decade.

**Effort.** ~1.5 hours. New table, simple writer form, lib falls
back to DB before file-defined letters.

**Unlocks.**

- A truly sustainable Friday cadence (the founder publishes from a
  phone if they have to)
- A surface for editing past letters when typos slip through
- Future scheduled-publish (queue Letter #N for next Friday at 5 pm)

**Done when.**

- `friday_letters` table exists, migration 0022 applied
- `/admin/letters/new` is operator-only and persists to DB
- `/letters` and `/letters/[slug]` read from DB first, fall back to
  the seeded file-defined list (so the historical archive is
  preserved without a backfill script)
- The standards-check cron's "Friday Letter freshness" check
  reads from the same source

---

## 3. Per-customer 12-week SLO sparkline on `/admin/customers` &nbsp; — &nbsp; SHIPPING NOW

**Why now.** `/admin/customers` shows traffic-light status for the
current week. Helpful, but invisible to drift — a customer who got
batches every week for 8 weeks then started missing Mondays looks
identical to one who's been amber for 8 weeks straight. A 12-week
on-time chart per customer surfaces drift before it becomes churn.

**Effort.** ~1 hour. Inline SVG sparkline (no chart lib), 12 cells
per customer, color-coded by week.

**Unlocks.**

- Pattern recognition (customer A is sliding; customer B is solid)
- Renewal conversation triggers ("you're at 88% on-time; we owe
  you a credit + a hard look at the ICP brief")
- Public proof later — when 50 customers each have 12 green cells,
  that grid becomes the most credible asset on the homepage

**Done when.**

- Each customer row on `/admin/customers` shows a 12-cell sparkline
  (one per recent Monday)
- Each cell is colored by status: green=shipped, red=missed,
  grey=pre-onboarding
- Tooltip on hover gives delivery date + lead count
- Sort option: "drift first" (customers with most-recent reds)

---

## 4. Sentry SDK wired into hot catch blocks

**Why next.** Every catch block in the app currently `log.warn`s and
returns a fallback. Without a paging layer, real user-impacting
failures stay invisible until customers complain. Sentry on
`createAgentRoute`, `requireAdmin`, the PayPal webhook, and
`output-verifier` covers ~95% of the blast radius.

**Effort.** 1 day. Install `@sentry/nextjs`, wire `Sentry.init`,
add `Sentry.captureException` in the four highest-blast paths,
configure release tagging in CI.

**Unlocks.**

- The founder gets paged before customer #5 sends an angry Slack
- Stack traces with full context (user id, agent name, request id)
- Performance traces — slow queries surface automatically

---

## 5. UptimeRobot synthetic monitoring

**Why next.** Internal health pings catch internal failures. They
can't catch "the Vercel edge in us-east-1 is down so visitors can't
reach the platform at all." External synthetic monitoring against
`/lead-engine`, `/proof`, `/api/health/deep` from outside Vercel
catches that class of failure.

**Effort.** 30 minutes of configuration. No code change.

**Unlocks.**

- Outage detection within 60 s, no matter the cause
- A separate channel for paging that survives Vercel-wide incidents

---

## 6. End-to-end PayPal Live smoke test runbook

**Why next.** Sandbox webhook testing is great. Live mode has only
been tested against the operator's own $1 self-test sub. Before
customer #1, a documented runbook + a $19 founder self-test sub
end-to-end (signup → checkout → webhook → DB row → Slack ping →
welcome page → cancel) closes the "lost first payment" risk.

**Effort.** 1 hour to run + document.

**Unlocks.**

- Confidence to flip `PAYPAL_MODE=live` and start sending links
- A reproducible test for every change to the payments stack

---

## 7. Customer-facing onboarding email sequence

**Why next.** When a customer signs up + receives their welcome URL,
they often don't open it for 24 hours. By that point the
"first 60 seconds of trust" is cooled. A 4-touch email sequence
keeps the flame:

- T+0 welcome email with the `/welcome/[id]` link
- T+24h "did you watch the Loom? here's a 30-sec recap"
- T+72h "here's what your first batch looks like" (sample)
- T+7 days "your first delivery lands Monday — here's how to act on it"

**Effort.** 1 day. Resend templates + cron-driven sender + dedupe.

**Unlocks.**

- Higher % of customers reading the welcome by their first delivery
- Lower % asking "what happens next" in Slack on Wednesday

---

## 8. Public `/customers/[slug]` opt-in showcase

**Why next.** When 3+ customers opt in to a public win story, those
pages become marketing assets that compound: every prospect's
fit-call ends with "see Acme's page, that's roughly what your
12-week curve will look like." Letter #1 explicitly punted on
this until 3 customers were ready.

**Effort.** ~1 day. New `customer_showcase` table (or column on
tenants for `showcase_slug`/`showcase_blurb`), public page,
admin toggle.

**Unlocks.**

- Conversion lift on `/lead-engine` (visible 50+ green cells = trust)
- Word-of-mouth — customers proud of their public page tell peers

---

## 9. AI provider failover routing decisions surfaced to the operator

**Why next.** `src/lib/ai.ts` cascades automatically: NIM →
Cerebras → Anthropic. The fallback is correct. The operator never
sees that it happened. A weekly digest of "this week NIM was
unavailable for 14 minutes; we routed 23 calls to Anthropic at
$2.10 cost" turns silent infrastructure into a managed story.

**Effort.** ~4 hours. New `failover_events` table + cron + Slack
weekly summary.

**Unlocks.**

- Operator visibility into which providers to negotiate with
- Cost forecasting based on real failover patterns

---

## 10. Affiliate program activation

**Why next.** The `affiliates` + `referrals` tables exist. The
schema is wired. There's no front door. A `/affiliate/[code]`
landing page + an `/account/affiliate` dashboard activates the
flywheel — happy customers refer for 30% of MRR for 12 months.

**Effort.** 2 days. Public landing pages, account dashboard,
PayPal payout integration.

**Unlocks.**

- Customer-driven acquisition channel
- Lower CAC than any paid channel
- Especially powerful if linked from `/customers/[slug]` showcase
  pages (proposal #8)

---

## 11. Backup + restore drill (operational, not code)

**Why next.** Neon takes automatic backups. The day you need one,
you don't want to be discovering the restore process. A documented
quarterly drill (clone prod → drop a table → restore → verify
`/proof` still renders) is the only honest answer to "are backups
real?"

**Effort.** 2 hours per drill, once a quarter.

**Unlocks.**

- Confidence the worst-case database failure is recoverable
- A documented runbook for incident response

---

## 12. Runbook + on-call rotation document

**Why next.** Single-founder shops break when the founder takes a
week off. A documented runbook (`docs/RUNBOOK.md`) covering:

- "Customer says 'no batch arrived'" → 5-step procedure
- "PayPal webhook returning 500" → 5-step procedure
- "AI provider X is down" → which fallback, which Slack channel
- "Database query taking >5 s" → kill query, drill connection
- "I'm taking a week off" → which crons need babysitting

…makes the platform survivable when the founder is asleep, sick,
or on vacation. Write it before you need it.

**Effort.** 4 hours.

**Unlocks.**

- The first time a friend / contractor covers a week, they can do it
- The discipline of writing it forces the operator to find the
  gaps before customers do

---

## What's deliberately NOT on this list

These exist as ideas (not as proposals) because they don't pass the
"will this produce a customer / prevent a failure / give the
founder time" test:

- 138th agent
- 9th AI provider
- Dashboard rewrite to React Suspense
- Mobile native app
- Marketplace for third-party agents (waiting for ~50 customers)
- White-label customer tooling polish (waiting for 5 paying agencies)
- Vector memory tuning beyond what migration 0017 already gives
- Public API for third-party platforms to embed Sovereign

Each of these is a future bet. None of them moves the needle until
proposals 1–12 are shipped or explicitly rejected.

---

## How this document gets updated

Each Friday Letter (after STANDARDS.md §06) ends with one
question: "Did anything ship from PROPOSALS.md this week, and what
moved up the list?" The list is allowed to change. Skipping a week
without checking the list is not.

When a proposal ships, it moves out of this file and into
`docs/SHIPPED.md` with the commit hash + the metric it moved.
That archive is the record of compounding.
