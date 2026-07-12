# Honest roadmap — Sovereign Matrix v2

What we need, what we don't need, when we need it. Categorized by
phase so you can see exactly which line of work is gating which
revenue threshold.

This roadmap is the source of truth — the audit doc
(`docs/audits/codebase-audit.md`) and the launch checklist
(`docs/runbooks/launch-checklist.md`) are its execution arms.

---

## Phase 0 — Today · Soft launch unblock

**Goal:** the platform can take a paying customer this week.

### What we need

- Apply Neon migrations 0002–0020 (Phase 1 of launch-checklist).
- Configure Stripe webhook endpoint + 4 price IDs.
- Configure Clerk webhook endpoint.
- Set required env vars in Vercel (Phase 2 of launch-checklist).
- Promote the latest deploy to production.
- 7-step in-browser smoke test (Phase 6 of launch-checklist).

**Total: ~90 minutes of operator clicking. Zero code work.**

### What we don't need

- More features.
- More pricing tiers.
- More vertical packets.
- Migrating the connection layer to enable strict RLS.
- Wiring Tier-B unwired modules.
- Mobile responsive audit (defer until first user complains).
- TypeScript strict mode (96 errors are runtime-discoverable, not customer-facing).
- Demo Loom video.
- Real `/case-studies` entries (the curated fallback works for now).

---

## Phase 1 — Week 1 · First 5 paying customers

**Goal:** convert 5 of the people you cold-email into paying users
on the Starter or Array tier. Watch them use the platform.

### What we need

- **Operator:** send 10 cold emails per day from `docs/outreach/`.
- **Operator:** WhatsApp + Slack channel for those 10 leads —
  founder-led support.
- **Code (~3 hrs):** add a per-asset retry button on partial-failure
  packets. The orchestrator already records `errors[]`; the UI
  needs a button that POSTs `{ kind, retryAsset }` to a new
  `/api/agents/<kind>?retry=<asset>` route. Use the saved input
  from the original packet; only the failed sub-asset re-runs.
- **Code (~2 hrs):** Stripe Customer Portal embed at
  `/dashboard/billing` — required before first churn event.
- **Code (~1 hr):** verify Sentry fires + source maps upload
  (operator triggers a deliberate test error).
- **Code (~2 hrs):** the **honest copy pass** — remove
  unsubstantiated "5-layer verifier / PEER loop / evolution
  engine" claims that the audit flagged. (Shipping in this commit.)

### What we don't need

- POPIA / GDPR data-export endpoint (defer until first EU customer).
- Stripe Tax setup (defer until first EU/SA invoice over the VAT threshold).
- Multi-org / team support (10 sole-operator customers don't need it).
- WhatsApp Business API direct send (manual broadcast is fine for 5 customers).
- Per-vertical PDF templates (the print stylesheet works).
- Visual regression tests (no two designs to compare).
- Custom 404 / 500 brand pages beyond what's already shipped.
- Audit of the 119 components (zero customer-visible impact).
- Dashboard sub-page pruning (save the trauma).

---

## Phase 2 — Weeks 2–4 · Public launch

**Goal:** Product Hunt + Show HN + Twitter thread → 1,000+ visitors
in 48 hrs. ~30 paying customers by end of week 4.

### What we need

- **First 2 anonymized case studies** (one agency, one recruiter
  ideally) to break the "no proof" objection. EXT — one customer
  conversation each.
- **60–90s demo video** embedded on the landing. Loom is fine.
- **TS strict mode flip** (~8 hrs): knock down the 96 tsc errors,
  flip `ignoreBuildErrors: false`. Real engineering signal when
  HN engineers click into the repo.
- **Mobile responsive audit** (~2 hrs): spot-check the 4 packet
  intake pages on a real phone. Fix breakpoints.
- **Robots.txt + canonical URL audit** (~1 hr): every public page
  has the right canonical, robots.txt allows everything we want
  indexed, blocks `/dashboard/*`, `/api/*`, `/portal/*`.
- **Wire `output-verifier` into agent-factory** as `useVerifier?: true`
  opt-in (~6 hrs). Turn the 5-layer claim from "in the codebase"
  into "actually runs on every packet." Latency budget: +400ms p50.
- **Pre-launch security review** — invoke the `security-reviewer`
  agent on every commit since `main`. Fix any HIGH or CRITICAL findings.
- **Sub-processor list** at `/sub-processors` (~30 min): public
  list of every third party that touches customer data
  (Anthropic, OpenAI, NIM, Stripe, Clerk, Resend, Sentry, Vercel,
  Neon, Upstash). Required by enterprise customers.

### What we don't need

- The full Tier-B wiring (output-refiner, peer-loop, citation-engine
  beyond verifier — wire them as customer demand materializes).
- Agent retries on transient failures beyond what circuit-breaker.ts
  already does.
- Per-vertical structured renderers beyond what's shipped (the
  raw-JSON fallback for unknown shapes is acceptable).
- A/B testing infrastructure (GrowthBook is wired but ROI is small
  pre-100-customers — A/B tests need volume).
- LinkedIn Recruiter API connector (huge approval lead time, low ROI
  for first-30 recruiting customers).
- Property24 / RETS / MLS feed format export (real-estate vertical's
  customers will tell you which they need).
- Multi-currency for offer cards beyond ZAR/USD/GBP/EUR/AUD (already
  shipped).
- New verticals (5–8 currently in flight is plenty).
- Onboarding tour / per-vertical walkthroughs (raw clarity > tour).

---

## Phase 3 — Months 2–3 · 100 paying customers

**Goal:** $25K–$50K MRR. Enough customer telemetry to see what to
build next without guessing.

### What we need

- **Dashboard sub-page audit** (~6 hrs): now that you have 100
  customers, look at PostHog / Plausible. Any sub-page with <1%
  unique-user click-through this month: delete. Estimated cuts:
  20–30 sub-pages of the current ~70.
- **POPIA / GDPR data-export + delete endpoints** (~8 hrs combined).
  Required before any EU customer renews.
- **Postgres RLS Phase 2** (~12 hrs). Switch from neon-http to
  neon-serverless WS driver, build `withTenantContext()`, migrate
  every authenticated route. Genuine multi-tenant isolation.
  Defense-in-depth required for enterprise pilots.
- **Stripe Tax** for SA + EU. Stripe handles the math; you flip
  the toggle in dashboard.
- **Failed-payment dunning UX**. Stripe handles the email cycle;
  in-app banner needs wiring.
- **Per-vertical case studies × 4** (one per vertical). The
  social-proof flywheel only spins with concrete proof points.
- **Vertical 5: cybersecurity SOC pulse** (~6 hrs orchestrator +
  page + tests). Add only after customers from Verticals 1–4 are
  saturated and the SOC market is a deliberate expansion.
- **API key tier UX** (~4 hrs). Developer-tier customers need a
  self-service `/dashboard/keys` page that's prettier than the
  current `/api/keys` list endpoint.
- **Self-service plan-change UX** (~3 hrs).
- **Invoice / receipt download in dashboard** (~2 hrs).

### What we don't need

- More than 5 verticals total (4 shipped, 1 cybersecurity acceptable
  — beyond that is dilution).
- Self-hosted / air-gapped deployment (only build if a single Fortune
  500 prospect is demanding it with budget attached).
- Native mobile apps (web-responsive PWA is enough until ARR > $5M).
- Real-time collaborative editing (single-user dashboards are fine).
- Public SDK in 5 languages (the `@sovereign/ai-router` Node package
  - the OpenAPI spec are enough for the next year).
- A/B testing on hero copy (still too low volume to be statistically
  meaningful).
- LinkedIn Recruiter API connector (still too long an approval cycle).
- Custom domain whitelabel (`agency.com` instead of
  `agency.sovereignmatrix.agency`) — premium add-on, build only when
  asked with budget.

---

## Phase 4 — Months 3–12 · Path to $1M ARR

**Goal:** $80K MRR ($1M ARR run-rate) by month 12 if growth holds.
This is where the "infrastructure ahead of consumers" library
finally pays off — wire the modules customers ask for.

### What we need

- **Wire 3–5 of the unwired Tier-B modules** based on customer
  demand: probably some combination of `peer-loop`, `citation-engine`,
  `swarm-protocol`, `cost-ledger`, `solution-templates`.
- **First hire:** customer support / ops generalist (Cape Town / ZAR
  salary). When founder-led support is taking >30% of your week,
  you need this hire.
- **First contractor:** designer for the v3 marketing site refresh
  (~$5K-$10K project). Customers will tell you when v2 starts to
  feel dated.
- **Real load testing** (~4 hrs): k6 or Artillery against the four
  vertical packet routes at 100 concurrent. Find the bottleneck
  before launch traffic does.
- **Connection-pooled Postgres** for >5K DAU (PgBouncer port).
- **Multi-region read replicas** for global customers (probably US
  east + EU).
- **Custom domain whitelabel** for the highest-paying agency tier.
- **Public roadmap voting** (the `/roadmap` page exists; wire it to
  a real upvote backend).
- **Quarterly anonymized financial transparency post** on the blog —
  real founder-led SaaS does this, builds trust.
- **First conference talk** (PyCon SA, AfricArena, MicroConf
  Cape Town).

### What we don't need (still)

- A second product. Stay narrow until $5M ARR.
- A second platform target (web is fine).
- An on-prem version unless contracted with a real PO.
- A reseller program beyond the existing whitelabel infra.
- Aggressive paid acquisition. Distribution-led growth (OSS,
  content, conferences) compounds; ad spend doesn't.

---

## What we explicitly DON'T need — at any phase

These are the temptations to avoid until very late, if ever.

| Item                                                            | Why not                                                                                                                             |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Discord / chat support widget on landing**                    | A 1-person team can't staff it. Email is fine until $500K ARR.                                                                      |
| **Mobile native app**                                           | Web-responsive + PWA is enough until $5M ARR.                                                                                       |
| **Replace Clerk with self-built auth**                          | Clerk's $99/mo (free for first 10K MAU) is far cheaper than your time to maintain auth.                                             |
| **Replace Stripe with Paddle / LemonSqueezy**                   | Stripe's tax + dunning is best-in-class. Switching costs > the marginal MoR savings.                                                |
| **Build a Sovereign-branded LLM**                               | Anthropic / OpenAI / NIM are commodity infrastructure; differentiate on the agent layer, not the model layer.                       |
| **AI ethics committee / responsible AI office**                 | Premature. Document your safety pipeline; that's enough until $10M ARR.                                                             |
| **Series A fundraise on cold investors**                        | Bootstrapped to $5M ARR is more valuable than $20M raised for $5M ARR. Only raise if a partner is the right answer (not the money). |
| **Public Discord / Slack community**                            | Community-led growth pays off only with critical mass. Open it at 100 customers, not before.                                        |
| **Speaking at conferences before having a real customer story** | Sounds good, costs travel + prep, no leverage without proof.                                                                        |
| **Build a Sovereign Matrix podcast**                            | Founder time better spent shipping product or talking to customers 1:1.                                                             |

---

## API surface — keep / cut summary

Compressed from `docs/audits/codebase-audit.md`. Every top-level
API directory under `src/app/api/`, with explicit verdict:

### KEEP — production-critical (gates revenue or auth)

`/api/agents/[...path]` (catch-all) · `/api/playbooks/run` ·
`/api/health/ready` · `/api/health` · `/api/_payments/stripe/webhook` ·
`/api/_payments/payfast/*` · `/api/_payments/yoco/*` · `/api/payments/*` ·
`/api/_webhooks/clerk` · `/api/_webhooks/crm` · `/api/_webhooks/calcom` ·
`/api/_webhooks/yoco` · `/api/_webhooks/zapier` · `/api/credits` ·
`/api/v1/[...path]` · `/api/free/run` · `/api/og` · `/api/packets/*` ·
`/api/case-studies` · `/api/leads` · `/api/keys` · `/api/admin/*` ·
`/api/ai` · `/api/nim` · `/api/research` · `/api/cron/*` ·
`/api/_cron/*` · `/api/mcp` · `/api/_misc/*`

### KEEP — useful, monitor for usage

`/api/jobs` · `/api/scheduled-workflows` · `/api/sequences` ·
`/api/workflows` · `/api/usage` · `/api/user/plan` ·
`/api/marketplace` · `/api/data-export` ·
`/api/portal/metrics` · `/api/voice` · `/api/founders` ·
`/api/waitlist` · `/api/referrals` · `/api/referral/apply` ·
`/api/api-catalog` · `/api/models/discover` · `/api/generations` ·
`/api/clients` · `/api/projects` (alias) · `/api/content` ·
`/api/approvals` · `/api/settings` · `/api/_settings/*` ·
`/api/_email/send` · `/api/_email/unsubscribe` ·
`/api/_content/*` · `/api/_health/*` · `/api/_integrations/*`

### INVESTIGATE — verify reachability before next sprint

`/api/[...catchall]` (mega catch-all) — verify it doesn't shadow real routes.
`/api/demo` — verify it's still called from anywhere.
`/api/do` — "the simplest API in the platform" — verify intent.
`/api/founders`, `/api/waitlist` — confirm they have callers from current pages.

### NO TOP-LEVEL ROUTES PROPOSED FOR DELETION

Every route either backs a known path, is an alias kept for back-
compat, or sits in the catch-all family. The audit found zero pure
dead routes at the top level. Save your deletion energy for libs and
sub-pages.

---

## Lib surface — keep / cut summary

Compressed from the audit. ~148 modules, three tiers.

### Tier A (~40 modules) · KEEP

Core infrastructure on every request: agent-factory, ai router,
auth-guard, plans, plan-enforcement, stripe, packet-store,
playbooks, tenant-resolver, circuit-breaker, retry, rate-limit,
logger, crypto, nvidia, etc.

### Tier B (~32 modules) · KEEP and TAG (already done in `be41b80`)

Infrastructure built ahead of consumers. The audit-marker comment
flags every one. **Wire only when a customer feature requires it.**
Examples: output-verifier, peer-loop, citation-engine,
swarm-protocol, evolution-engine, cost-ledger.

### Tier C (5 modules) · DELETED IN `be41b80`

`factory.ts`, `tenant-scope.ts`, `email-sequences.ts`,
`validation.ts`, `crm.ts`. 876 LOC removed.

---

## Pages — keep / cut summary

### KEEP

Landing (`/`) · `/pricing` · `/playbooks` (index) ·
`/playbooks/<vertical>` (4) · `/anthropic` · `/now` · `/case-studies` ·
`/about` · `/blog` · `/changelog` · `/contact` · `/docs` ·
`/marketplace` · `/showcase` · `/free/<tool>` (3) ·
`/vs/<competitor>` (16+) · `/for-<vertical>` (12) ·
`/login`, `/signup`, `/dashboard/*` (the pages backing real flows).

### REVIEW IN PHASE 3 (after 100 customers + analytics)

The ~70 dashboard sub-pages. Estimated 20–30 to delete based on
zero-traffic. Names that look thematically vague today:
`audit-destroy`, `morpheus-shield`, `cyber-audit`, `god-eye`,
`ghost-protocol`, `omnipresence`, `holographic-agent`,
`avatar`, `dream` — most of these need either real workflows or
deletion.

### KEEP (special)

`/portal/<id>/*` and `/wl/<domain>/*` — whitelabel surfaces.
Production-critical for the agency reseller play.

---

## Database — keep all

All 38 tables back production code paths. Migration parity check
in CI verifies on every commit. **No table proposed for deletion.**
Pending: apply migrations 0002–0020 in Neon (Phase 1 of
launch-checklist).

---

## Components — defer audit

119 components, mixed level of activity. **Defer detailed audit to
Phase 3** (after 100 customers). The bloat here is invisible to
customers and the cost of the audit (1–2 days of careful triage)
is too high to justify pre-launch.

---

## Bottom line

**You are 90 minutes from soft launch. You are ~20 hours from public
launch.** Everything else compounds after the first paying customer
exists.

The biggest risk this roadmap protects against is the trap that
kills most solo SaaS founders: **building Phase 3 features in a
Phase 0 environment**. Every "what we don't need" item in this doc
is a feature a competing voice in your head is trying to convince
you is required pre-launch. None of them are.

Ship. Watch. Iterate.
