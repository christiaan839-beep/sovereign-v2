# Sovereign Matrix — Growth Plan

Internal planning document. Not customer-facing copy.

**Status as of 2 September 2026.** This plan was written as a day-numbered
sequence starting at "Day 1". That start never happened. Phase 1 is a two-day
activation checklist and not one of its boxes is ticked; `CLAUDE.md` still
lists the same operator steps under "Pending Manual Steps" (migrations
0002-0004, the Stripe webhook endpoint, the four Stripe price IDs, the Clerk
webhook, `CLERK_WEBHOOK_SECRET`). Every phase below it is blocked on that
same checklist, so every downstream day number is dead too.

The original day ranges are kept in the headings on purpose. They are the
record of what was promised, and deleting them would hide the miss. New dates
are not being invented here — a phase gets a date when the phase before it
actually closes.

Numbers in this document match `LAUNCH.md`, `LAUNCH-CONTENT.md` and
`VIRAL-CONTENT.md`. Derivations are in the verified-numbers table at the
bottom of `VIRAL-CONTENT.md`.

---

## The Thesis

Businesses are handing agents real work: client lists, case files, contracts,
patient records. The bottleneck is not model quality. It is that the operator
cannot say where the data went, who approved the action, or what the model
was asked.

Sovereign Matrix is the execution layer for that problem. Local-first
routing so the prompt can stay inside the operator's network. A 5-check
pipeline on every output. Four trust levels so autonomy is a dial rather than
a switch. An immutable execution audit so an action can be reconstructed
after the fact.

Market-size forecasts and third-party quotes have been removed from this
section. They were not sourced and they were not load-bearing: the argument
above stands without them.

---

## Phase 1: ACTIVATE (was Days 1-2 — not started)

**Goal: platform goes live with real AI output**

Blocking everything else. Until this closes, no phase below can begin.

### Environment

- [ ] Set NVIDIA_NIM_API_KEY in Vercel (open-model routing activates)
- [ ] Set GEMINI_API_KEY in Vercel (default hosted path activates)
- [ ] Set DATABASE_URL in Vercel (persistence activates)
- [ ] Run pending migrations in the Neon console (`drizzle/` is canonical;
      CLAUDE.md lists 0002-0004 as outstanding)
- [ ] Set ENCRYPTION_KEY + NEXT_PUBLIC_APP_URL
- [ ] Set STRIPE keys and the four price IDs (STRIPE_PRICE_STARTER,
      STRIPE_PRICE_ARRAY, STRIPE_PRICE_NODE, STRIPE_PRICE_ENTERPRISE)
- [ ] Register the Stripe webhook endpoint → `/api/payments/stripe/webhook`
- [ ] Register the Clerk webhook endpoint → `/api/webhooks/clerk`, and set
      CLERK_WEBHOOK_SECRET
- [ ] Set RESEND key (transactional email activates)
- [ ] Set GROQ + CEREBRAS keys

### Verification

- [ ] Free competitor scan returns a real brief
- [ ] Voice assistant speaks with a real voice
- [ ] Smart router picks a model per task and the choice is visible in the
      transparency payload
- [ ] Full flow: signup → onboarding → first playbook → real output
- [ ] Stripe checkout: click → pay → entitlement granted via the webhook
- [ ] Fix runtime bugs that only surface against live provider APIs

**Success metric:** one person can sign up, run a playbook, and get real
output.

---

## Phase 2: FIRST 10 USERS (was Days 3-7 — not started)

**Goal: 10 users generating real output**

### Acquisition

- [ ] Post on LinkedIn (copy in LAUNCH.md)
- [ ] Post the Twitter thread (copy in LAUNCH.md)
- [ ] Share /free/competitor-scan in 5 relevant communities
- [ ] DM 10 agency owners you know personally (template in LAUNCH-CONTENT.md)
- [ ] Grant the Founder plan to the first 10 signups: 10,000 runs a month,
      every playbook, no card

### What they experience

1. Land on sovereignmatrix.agency, see the hero and the live terminal demo
2. Run the free competitor scan, get a real brief, no signup
3. Sign up, 5-step onboarding, first playbook suggested from their goal
4. Run Lead Blitz, get enriched leads
5. Voice assistant answers questions in a real voice
6. Dashboard shows real execution metrics

### Feedback loop

- [ ] Slack channel for early users
- [ ] Daily check-in: what worked, what broke, what is missing
- [ ] Reported bugs fixed within 24 hours
- [ ] Requested features shipped within 48 hours where they are small

**Success metric:** 3 of 10 users run a second playbook unprompted.

---

## Phase 3: FIRST REVENUE (was Days 8-14 — not started)

**Goal: first paying customer**

### Conversion

- Free tier shows value, then prompts at the quota edge
- "Your free tier used 47 of 50 runs. Starter is $19/mo for 200."
- Agency pitch: Enterprise at $499/mo includes the white-label dashboard and
  10,000 runs; resell under your own brand at your own price

### Content

- [ ] Publish the queued blog posts through the smart router
- [ ] Share the 18 comparison pages on social
- [ ] Post the architecture write-up on r/SaaS and Indie Hackers
- [ ] Publish the local-execution write-up: what the Ollama path does, what
      leaves the network on each route, and what the audit trail records

### Partnerships

- [ ] Reach out to 3 agency owners for a white-label pilot
- [ ] Offer a 60-day Enterprise trial
- [ ] Convert one into the first named testimonial

**Success metric:** $19 or more in recurring revenue.

---

## Phase 4: PRODUCT HUNT LAUNCH (was Days 15-21 — not started)

**Goal: a strong launch day**

### Preparation

- [ ] Product Hunt listing (copy in LAUNCH.md)
- [ ] Early users lined up to comment on launch day
- [ ] Respond to every comment within 30 minutes
- [ ] 3 real testimonials ready
- [ ] Demo video: type a goal, agents execute, real output

### Launch day

- [ ] Post at 12:01 AM PST
- [ ] Share on all social channels at once
- [ ] Email the waitlist
- [ ] Watch /status for outages
- [ ] Fix bugs in real time

**Success metric:** top 5 Product of the Day. The previous "500+ upvotes"
target was removed; it was a number with no basis and no lever attached
to it.

---

## Phase 5: SCALE TO 100 USERS (was Days 22-60 — not started)

**Goal: evidence of product-market fit**

### Channels

1. **SEO:** 18 comparison pages and 26 sector pages are deployed
2. **Social proof:** early user testimonials on the landing page
3. **Referral programme:** what is actually shipped is 30% recurring
   commission with a 90-day attribution window on /affiliate, plus 50 bonus
   runs per referral in `src/lib/referral-system.ts`. The old
   10%/25%/40% tier ladder in this slot was never built and did not match
   the live page; reseller and agency-partner rates are undecided.
4. **Free tools:** competitor scan, SEO audit, lead finder
5. **Content:** weekly post targeting buyer-intent keywords

### Product work driven by feedback

- [ ] Top 3 requested features within 2 weeks
- [ ] Reported bugs fixed within 24 hours
- [ ] Dashboard UX refined from session recordings
- [ ] Agent quality improved from evolution-engine learnings

### Revenue targets

Targets, not forecasts. None has started, because Phase 1 has not.

- Month 1: 10 users, $500 MRR
- Month 2: 50 users, $3,000 MRR
- Month 3: 100 users, $8,000 MRR

---

## Phase 6: AGENCY ECOSYSTEM (was Days 61-120 — not started)

**Goal: 10 agencies white-labelling**

### Arithmetic

10 agencies at the $499/mo Enterprise tier is $4,990 MRR from agencies alone,
before their end users. Each agency bringing 20 clients puts 200 people on the
platform.

### What agencies get

- White-label dashboard with their logo
- Custom domain
- Client portals with isolated data
- 140 agents branded as their service
- A marketplace revenue share, split to be decided. The 80/20 figure
  previously stated here is not set anywhere in the code or on any page.

### Why they stay

This section previously argued that agencies could not leave because their
client data lived on our infrastructure. That is both a bad argument and a
direct contradiction of the local-execution positioning in the launch copy,
so it is gone. The honest version:

- Agent performance compounds through the evolution engine, and that history
  is per-tenant
- Their client portals, branding and workflows are configured here
- Data export at `/api/me/export` means leaving is possible, which is the
  point — retention has to be earned each month

---

## Phase 7: DEVELOPER MARKETPLACE (was Days 121-180 — not started)

**Goal: 50 developers building agents**

### Strategy

- Open the Agent SDK (docs at /developers/docs)
- A majority revenue share to the developer; the exact split is undecided
  and not set anywhere in the code
- Featured agents get homepage placement
- First 50 developers get a Founding Developer badge

### What gets built

- Sector agents (legal, healthcare, finance)
- Integration agents (Shopify, HubSpot, Salesforce)
- Niche agents (podcast transcription, patent search, code review)

### Network effect

More developers, more agents, more users, more developers. This is the
strongest structural advantage in the plan and the furthest from being real.

---

## Phase 8: ENTERPRISE (was Days 181-365 — not started)

**Goal: first Enterprise deal at $499/mo**

### Built and verifiable

- [x] 5-check output pipeline (`src/lib/output-verifier.ts`)
- [x] 4 trust levels (`src/lib/trust-levels.ts`)
- [x] Immutable execution audit (`src/lib/execution-audit.ts`)
- [x] Data export endpoint (`/api/me/export`)
- [x] Admin panel with user management (`/dashboard/admin`)
- [x] Deep health check API (`/api/health/deep`)
- [x] Local and air-gapped execution path (Ollama, routed ahead of every
      hosted provider in `src/lib/ai.ts`)

### Compliance — not built, do not claim

The previous version of this list ticked "SOC 2 narrative" and "HIPAA-ready".
Neither is a thing we can assert. Use the same language the live site uses:

- [ ] **SOC 2 Type II** — a readiness programme, not a certification. Trust
      Services Criteria are mapped and self-assessed on /trust. No audit firm
      engaged, no report held. Publish the audit window when an auditor is
      engaged; do not commit to a date before then.
- [ ] **HIPAA** — we have HIPAA-aware controls and the Ollama local path
      supports air-gapped processing where patient data stays on the
      customer's infrastructure. A BAA is available for enterprise
      deployments. Never "HIPAA-compliant" or "HIPAA-ready".
- [ ] **GDPR / POPIA** — designed to be compliant: PII scanning and redaction
      in the output pipeline, data export at `/api/me/export`. "Designed to be
      compliant", not "compliant".
- [ ] **ISO 27001, PCI DSS** — no claim of any kind. We hold neither and have
      no programme in flight.

### Enterprise sales

- Target: 5 prospects per month
- Channel: LinkedIn outreach, leading with local execution and the audit trail
- Demo: a live competitor scan of the prospect's own competitor
- Close: 60-day pilot into an annual contract

---

## The Numbers

The "Now" column is measured from this working tree. Every other column is a
target that has not started, because Phase 1 has not started.

| Metric             | Now (verified) | Target: 30 days in | 90     | 180     | 365     |
| ------------------ | -------------- | ------------------ | ------ | ------- | ------- |
| Users              | 0              | 30                 | 100    | 500     | 2,000   |
| MRR                | $0             | $1,000             | $8,000 | $25,000 | $80,000 |
| Agents             | 140            | 140                | 150    | 200     | 300     |
| Models in registry | 20             | 20                 | 25     | 30      | 40      |
| Pages              | 267            | 275                | 290    | 320     | 360     |

Verification: `npm run check:registry` for agents; the `MODELS` record in
`src/lib/model-registry.ts` for models; `find src/app -name page.tsx` for
pages. The deploy-count row was removed — it measured effort, not progress.

---

## The Moats

1. **Local-first execution.** The router tries a customer-supplied Ollama
   endpoint before any hosted provider. For regulated buyers this is the
   difference between a policy question and a network question. It is also
   the one claim in the whole plan that is simultaneously verifiable, hard to
   copy without rearchitecting, and worth paying for.

2. **140 pre-built agents.** Each carries its own prompt and sector context.
   The registry is generated and checked in CI, so the count is a fact rather
   than a marketing number.

3. **The execution layer.** Trust levels, the 5-check output pipeline,
   consensus across 2-3 models, output transparency and the immutable audit
   trail. Individually replicable; together they are the product.

4. **Evolution engine.** Agent quality improves from run history, and that
   history is per-tenant. A competitor starting later starts with none of it.

5. **Developer marketplace.** Once developers build on the SDK, switching
   costs rise for everyone. Currently aspirational — see Phase 7.

6. **Agency white-label.** Each agency brings its own client base onto the
   platform under its own brand.

7. **Flat pricing.** Starter $19, Sovereign Node $199, Enterprise $499, all
   monthly and all with a fixed run quota. Metered competitors have to charge
   more as the product gets more useful. We do not. Named-competitor price
   comparisons were removed from this section: we cannot substantiate another
   company's pricing, and the structural argument does not need them.

---

## What Is Already Built

```
267 pages | 418 API routes | 140 agents | 29 playbooks
20 models across 8 providers | 4,510 tests across 295 files
252,000 non-blank lines of TypeScript | 103 dashboard pages
18 comparison pages | 26 sector pages
5-check output pipeline | 4 trust levels | output transparency
Execution audit | error recovery with circuit breakers | deep health checks
Voice assistant | email builder | reports | analytics | evolution engine
Admin panel | billing | referrals | integrations dashboard
Launch copy (Product Hunt, LinkedIn, X) | API key documentation
```

The platform is built. Phase 1 is an afternoon of environment configuration
that has not been done, and it is the only thing standing between this
document and its first real data point.
