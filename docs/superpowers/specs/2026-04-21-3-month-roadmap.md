# Sovereign Matrix — 3-Month Roadmap

> **Goal:** Go from "code-complete on a feature branch" to "the best
> operational-AI platform for builders and operators," measured against
> the six pillars below, in 12 weeks.

**Date:** 2026-04-21
**Scope:** Full platform strategy. Supersedes the per-lane plan
(`2026-04-21-landing-redesign-design.md` and the Computer Use plan) —
this doc sets the sequencing; each sub-plan ships within a week.
**Status:** Proposed — requires user approval before execution.

---

## Part I — What "Best Platform" Means (North Stars)

Six pillars, in order of leverage:

1. **Reliability** — we keep our SLOs (99.9% availability, p95 agent
   latency <8s, voice first-audio <1.5s). Breaches are rare and visible.
2. **Trust** — every run has a verification receipt. No hallucinated
   outputs make it past the critic layer. Immutable audit trail.
3. **Speed** — user action → visible result in under 5s for agents,
   under 2s for voice. Compare favorably with Grok + Perplexity.
4. **Differentiation** — at least two capabilities no competitor has:
   `/world` (the constellation), Computer Use with persistent sessions,
   A2E economy (agents hire agents), sovereignty routing.
5. **Ecosystem** — creators submit, users install, agents chain to
   each other. 80% creator payouts are not a promise, they're a receipt
   on every run.
6. **Revenue** — paid-user MRR grows each month. Founder program →
   Growth tier → enterprise conversion exists as a funnel, not a
   hypothesis.

Each week's work MUST move at least one pillar. Work that doesn't moves
to the backlog.

---

## Part II — Baseline: Where We Are Today (2026-04-21)

**Shipped on `claude/wizardly-benz`** (not yet on main):

| Plan | Scope | Status |
|---|---|---|
| Plan 1 | Revenue Engine — credit holds, Stripe, pay-per-run tier | ✅ |
| Plan 2 | Sovereign World — `/world`, marketplace, submissions, reviews, leaderboard | ✅ |
| Plan 3 | Voice Agent — WS pipeline, personas, VAD + Parakeet ASR (L1.7) | ✅ |
| Plan 4 | Observability + Evals + SLOs (L1.1, L1.3 closed follow-ups) | ✅ |
| Plan 5 | Scheduled Playbooks — cron, dispatcher, UI | ✅ |
| L1 polish | 7 follow-ups closed (SLOs, free-tier voice, costs, creator payout, moderation, VAD) | ✅ |

**Metrics:** 1533/1533 tests, 0 TS errors, 0 lint errors. ~150 commits.

**What's blocking reality:** nothing is deployed. All of the above is
on a feature branch. Zero users have touched any of it yet.

---

## Part III — Month 1: LAUNCH (Weeks 1-4)

**Theme:** Ship what exists. Get real signal. Every "launch" mistake
I avoid here is one I don't have to fix later.

**Pillar focus:** Reliability, Trust, Revenue.

### Week 1 — Deploy Week

**Primary goal:** Everything on `claude/wizardly-benz` is live in
production and observable.

**Deliverables:**

- [ ] Merge `claude/wizardly-benz` → `main` (via one big reviewed PR or
      a chain of per-plan PRs — probably the former given it's
      already atomic per commit).
- [ ] Run all pending migrations on Neon prod (0002, 0003, 0018–0023,
      plus new 0020 sovereign_world). Verify row counts + indexes.
- [ ] Set all env vars (see `docs/runbooks/*-deploy.md` — 4 runbooks,
      one per major plan).
  - `VOICE_SESSION_SECRET`, `NVIDIA_NIM_API_KEY`, `STRIPE_*`, `CRON_SECRET`,
    `SENTRY_DSN`, `POSTHOG_*`, `UPSTASH_REDIS_REST_URL/TOKEN`,
    `SLACK_WEBHOOK_URL` (for breach cron), `ADMIN_USER_IDS`.
- [ ] Seed production: `node scripts/seed-agent-metadata.mjs`. Verify
      137 rows in `agent_metadata`.
- [ ] Disable Vercel Deployment Protection (currently SSO-gated).
      Only `ALLOW_PREVIEW_DEPLOYMENTS` stays.
- [ ] Deploy `server/voice-ws.ts` to Railway. Set `NEXT_PUBLIC_VOICE_WS_URL`
      in Vercel to the Railway hostname.
- [ ] **Verification walkthrough** (manual, 30 min):
  1. `/api/health/deep` → 200, all checks green
  2. Run a free playbook end-to-end
  3. Top up $10 via Stripe → verify credits appear
  4. Run a paid agent → verify hold + capture in billing
  5. Open `/world` → 137 dots rendered, clicking opens drawer
  6. Open `/dashboard/voice-assistant` → mic permission, VAD
     triggers, ASR returns transcript, TTS plays back
  7. Submit a test agent via `/developers/submit` → approve in
     `/dashboard/admin/agents` → appears public at `/agents/[slug]`

**Metric gate:** `/api/health/deep` stays green for 24h. Failing this
blocks Week 2.

**Risks:**
- Migration deadlock on live Neon DB. Mitigation: run each migration
  in its own transaction + have rollback SQL ready.
- Railway WS fails under real mic traffic (codec edge-cases). Mitigation:
  keep the typed-transcript path as fallback (already done in L1.7).

---

### Week 2 — Polish Week (Landing Redesign)

**Primary goal:** First-touch impression is premium. Converts.

**Deliverables:**

- [ ] Execute Lane 2 landing redesign per
      `docs/superpowers/specs/2026-04-21-landing-redesign-design.md`.
      7 atomic commits.
- [ ] Add `RecentRunsTicker` tied to real `/api/playbooks/runs` data —
      will be sparse in week 2 but populates as week 3 onboarding runs.
- [ ] Hero copy A/B test setup via PostHog feature flag. Two variants:
      current "The Agent Infrastructure Stack" vs. new "Your operational
      AI, verified every run." Collect 72h of click-through data.
- [ ] **Mobile polish:** walk the full landing on 375px and 414px
      viewports. Every clipping / scroll-bug / tap-target under 44px
      gets fixed. No new features; just reading and breathing.
- [ ] `/pricing` page pass (not redesign — just ensure alignment with
      plans.ts after L1.2 changes surfaced free-tier voice).

**Metric gate:** Landing Lighthouse Performance ≥ 92 on mobile. New
conversion rate on "Run Free Playbook" CTA compared to baseline (need
baseline from Week 1's first traffic).

---

### Week 3 — Founder Program Week

**Primary goal:** 10 paying founder-tier users, each having run ≥ 3
playbooks, each having left at least one review.

**Deliverables:**

- [ ] **Outreach:** personal email to 50 candidates from your network +
      relevant public agent-builder communities (LessWrong, HN,
      indie-hacker subreddits, Twitter). Subject: "I built what Grok
      promised — want 3 free months to try it?"
- [ ] **Founder-mode onboarding wizard:** when a founder-program code
      is redeemed, skip the generic onboarding; run a 5-minute
      personalized setup with a Calendly-booked call. This converts
      far better than self-serve for the first cohort.
- [ ] **HITL-monitoring dashboard:** one admin page at
      `/dashboard/admin/live` showing every active playbook + voice
      session with a "kill" button. You watch the first 72 hours in
      real-time so you catch anything weird before a user does.
- [ ] **Support Slack channel:** one-click Slack invite in dashboard
      (`Get help`). Auto-bot replies tagged with their `user_id` so
      you can mine for patterns.
- [ ] **First case studies:** by Friday, 3 of the 10 have a written
      1-paragraph testimonial. Offer a credit bonus ($25) in exchange.

**Metric gate:** ≥ 8/10 founders complete their 3rd playbook run. < 2
support tickets per user in the first week. Zero sessions > p95 SLO.

**Why this pillar:** Revenue starts. Trust is proven (they tell you
where the seams are). Reliability is stress-tested with low-volume
traffic before real scale.

**Risks:**
- No one replies to outreach. Mitigation: your "operational AI" TikTok
  script (`docs/second-brain/inbox/2026-04-21-operational-ai-positioning.md`)
  as a fallback — post 3 short-form videos, drive traffic from there.

---

### Week 4 — Polish-from-Signal Week

**Primary goal:** Every repeated friction point from Week 3's founders
is fixed by end of week.

**Deliverables:**

- [ ] Triage all support tickets + Slack messages. Group by theme.
- [ ] Ship whatever the top 3 themes are. Common candidates (will learn):
  - "I can't find my agent runs from yesterday" → history UX fix
  - "Voice cut me off mid-sentence" → VAD sensitivity tuning
  - "Credit display is confusing" → billing UI clarification
- [ ] **First case-study landing-page section.** 3 testimonials live.
      This is social proof that wasn't possible before Week 3.
- [ ] **Lane 1 cron verification** — watch a full SLO breach cron
      execute on Monday. Confirm it posts to Slack.
- [ ] **Month 1 retrospective doc** at `docs/retros/2026-05-month-1.md`:
      what shipped, what didn't, what we learned, what changes the
      Month 2 plan based on the signal.

**PIVOT GATE:** if by end of Week 4 we have < 5 paying users AND the
outreach strategy has been tried seriously, Month 2 pivots from "moat"
to "distribution." Different plan for that case (see Part IV
alternate).

---

## Part IV — Month 2: MOAT (Weeks 5-8)

**Theme:** Build what competitors can't ship in 6 months. Month 1
proves the platform works; Month 2 makes it inevitable.

**Pillar focus:** Differentiation, Trust.

### Week 5 — Computer Use Foundations

**Primary goal:** Persistent browser sessions per user — not per request.

**Deliverables:**

- [ ] **Lane 3 kickoff** — write the Computer Use expansion plan spec.
- [ ] Ship step 1 of the plan: browser-session persistence.
      Architecture: one lightweight container per user session (via
      Browserbase, Hyperbrowser, or a Railway-hosted Playwright pool
      — pick based on cost/session-lifetime).
- [ ] New agent: `computer-use-persistent` with `startSession`,
      `resumeSession`, `endSession` sub-endpoints. Existing
      `/api/agents/computer-use` becomes the "one-shot" variant.
- [ ] **Action types:** `fill_form`, `click`, `extract_table`,
      `wait_for_selector` — typed helpers so agents don't have to
      write raw xpath.

**Why this is the moat:** CrewAI, Lindy, n8n can't do this natively.
It's what separates "AI tool" from "operational AI" (your TikTok
positioning).

### Week 6 — Voice v2 + Echo-Cancellation

**Primary goal:** Voice feels like Grok. Competitive parity.

**Deliverables:**

- [ ] **Per-sentence playback:** instead of accumulating all audio
      chunks until `turn-done`, play sentence #1 while the server is
      still synthesizing sentence #2. Shaves ~800ms of perceived
      latency. Needs MediaSource Extensions or chained Audio elements.
- [ ] **Echo cancellation:** tune `getUserMedia({ echoCancellation,
      noiseSuppression, autoGainControl })`. Test on speakers + AirPods.
- [ ] **Voice cloning (Chatterbox):** stretch — add a 7th persona
      slot that lets paying users upload a 30-second sample, clone
      via NIM's Chatterbox model. Requires admin approval
      (PII/consent/spoof policy).
- [ ] **Streaming ASR:** replace one-shot Parakeet with streaming
      mode so user sees partial transcripts as they speak. Shaves
      another ~500ms.

**Metric gate:** `voice_first_audio_p95` drops from current target
1.5s to observed 900ms. User-reported "feels instant" in Slack.

### Week 7 — A2E Flows (Agents Hiring Agents)

**Primary goal:** One agent can `spawn` another agent as a sub-task.
Ledger reflects the hand-off.

**Deliverables:**

- [ ] `POST /api/agents/[slug]/spawn` — inside an agent handler, call
      this to run another agent synchronously. Credit holds nest:
      the parent's hold covers the child's cost up to a limit.
- [ ] **Capped A2E spending** per parent-run. Prevents runaway spend.
- [ ] **New agents:** 3 built-in A2E chains that demonstrate the
      pattern — e.g., `lead-blitz` internally spawns
      `contact-enrichment` for each prospect.
- [ ] **UI thread view:** `/dashboard/runs/[id]` shows the spawn
      tree visually (parent → children → grandchildren).

**Why this is the moat:** Nobody has ledger-integrated agent chaining
with per-step cost attribution. This unlocks the "agents hire agents
autonomously" positioning from the marketplace hero copy.

### Week 8 — Trust Layer — Public Audit Trail

**Primary goal:** Every run has a shareable, verifiable receipt URL.

**Deliverables:**

- [ ] **Receipt page:** `/runs/[id]/receipt` — public (no auth,
      signed URL) — shows the full execution trace: system prompt,
      user input, model chain, verification layer pass/fail, final
      output, timestamp, cryptographic hash.
- [ ] **Receipt signature:** HMAC-sign with a rotating key. Add a
      "verify receipt" endpoint that validates the signature.
- [ ] **OG preview:** the receipt URL has a rich OG preview with
      the agent's icon + "Verified by Sovereign Matrix" badge.
      Users share these as proof in their own content/case studies.
- [ ] **Add to every agent response:** response headers include
      `X-Receipt-URL: https://sovereignmatrix.agency/runs/[id]/receipt`.

**Why:** Legal + healthcare + financial buyers require audit trails.
This is the sale-closer for enterprise. Also: sharing a receipt on
Twitter doubles as distribution.

**PIVOT GATE:** Month 2 review. If fewer than 50 paying users by
end of Week 8, Month 3 pivots to "distribution + partnerships," NOT
"scale + enterprise."

---

## Part V — Month 3: SCALE (Weeks 9-12)

**Theme:** Compound. Open the ecosystem. Enterprise-ready.

**Pillar focus:** Ecosystem, Revenue.

### Week 9 — Mobile (React Native OR polished PWA)

**Primary goal:** 50% of monthly runs come from mobile within 30 days.

Decide in Week 8 based on data:
- If voice is ≥ 30% of usage → React Native app (native mic + push
  is non-negotiable). ~2 weeks of work.
- If voice < 30% → iOS/Android PWA polish instead. ~3 days of work.

**Deliverables (RN path):**

- [ ] Expo + Clerk RN + the minimum screens: /world, one playbook
      launcher, voice agent, billing. No /developers/submit.
- [ ] Apple + Google app store submission (TestFlight first). Use
      existing Clerk OAuth for login.

**Deliverables (PWA path):**

- [ ] Manifest.json, service worker, install prompt. Tailwind pass
      for all existing dashboard pages at mobile-first widths.
- [ ] Native share via `navigator.share` on receipt URLs.

### Week 10 — Enterprise Tier Activation

**Primary goal:** First enterprise contract signed ($499-999/mo).

**Deliverables:**

- [ ] **SSO** via Clerk's enterprise SAML integration.
- [ ] **Private tenant deployment** option — the existing
      `tenant-resolver.ts` already scopes everything; wire a
      per-tenant DATABASE_URL env var for true DB isolation (the
      "sovereignty" story made real).
- [ ] **SLA page** at `/enterprise/sla` publishing the actual SLOs
      from Plan 4 as contractual terms.
- [ ] **Contract + onboarding playbook:** DocuSign template,
      stripe invoicing for annual contracts, first-30-days
      white-glove migration.

### Week 11 — Partner / Reseller Program

**Primary goal:** 3 agencies signed up as resellers. Each brings
their own client base to the platform.

**Deliverables:**

- [ ] **White-label mode:** custom subdomain (`clientname.sovereignmatrix.agency`)
      with the reseller's brand colors + logo. DB-stored brand config
      per tenant.
- [ ] **Agency commission ledger:** resellers earn 20-30% of all
      billings from clients they bring. Uses the same `creator_payout`
      primitive from L1.5 — no new infrastructure.
- [ ] **Agency console page:** `/dashboard/agency` — client list,
      aggregated MRR, per-client run counts.

### Week 12 — Ecosystem Ignition + Retrospective

**Primary goal:** Catalog doubles in size via 3rd-party submissions.
Month 3 case studies. Plan the next quarter.

**Deliverables:**

- [ ] **Public submission push** — "We pay $500 for the best new
      agent this month" promo. Landing page + social push. Expect
      15-30 submissions.
- [ ] **Approval automation:** the admin moderation panel (L1.6)
      gets a "soft-approve" mode where submissions with a high
      NemoGuard safety score auto-publish as unlisted and await
      one-click public promotion. Reduces review time.
- [ ] **Leaderboard TV:** a public `/leaderboard` widget embedded
      in a large display at the office — rolling top-10 agents by
      success rate today. Slightly ego, mostly effective.
- [ ] **Q1 retrospective:** what worked, what didn't, what to
      bet on in Q2 (month 4-6).

---

## Part VI — Success Metrics by Month

| Metric | Baseline | End M1 | End M2 | End M3 |
|---|---|---|---|---|
| Paying users | 0 | 10 | 50 | 150 |
| MRR | $0 | $300 | $2.5k | $10k |
| Monthly runs | 0 | 500 | 5k | 25k |
| 3rd-party agents | 0 | 0 | 3 | 20 |
| Enterprise contracts | 0 | 0 | 0 | 1 |
| Partner agencies | 0 | 0 | 0 | 3 |
| Uptime % (30d) | — | 99.5% | 99.7% | 99.9% |
| p95 voice latency | — | 1.5s | 1.1s | 900ms |
| NPS | — | — | ≥ 40 | ≥ 50 |

These are assumptions, not commitments — refine after Week 1's real
traffic starts.

---

## Part VII — Risk Register

| Risk | Likelihood | Blast | Mitigation |
|---|---|---|---|
| Migration fails in prod | Low | High | Rollback SQL + transactional migrations (already written) |
| First week: zero users find us | Medium | Medium | TikTok script + personal outreach + warm intro list |
| Railway WS has codec issues live | Medium | Medium | Typed-transcript fallback (done in L1.7) |
| NIM rate limits under real load | Low | High | 11-deep failover chain (exists) + Cerebras key activated |
| Stripe webhook flake | Low | High | Idempotency via stripe_events (done in Plan 1) |
| NPS < 30 in Month 1 | Medium | High | Week 4 is dedicated polish-from-signal; if polish isn't enough the Month 2 plan pivots |
| Enterprise demands features we don't have | High | Medium | White-glove in Week 10 means we can say "custom" instead of "not yet" |
| I'm solo and burn out | High | High | Explicitly limit to one 8h+ day per week. The retros at end of each month catch early warning |
| The "operational AI" positioning doesn't click | Medium | High | Week 2 A/B test + Week 4 signal review let us change copy fast |
| Cost per run exceeds $0.10 | Low | High | Smart Router routes to cheapest model that passes quality gate; ai-cost-auditor agent checks PRs |

---

## Part VIII — What I Need From You (decisions before Week 1)

Strategic calls only you can make. **These shape the plan; please flag
any you want to change.**

1. **Team size for these 12 weeks.** I've planned as if solo. If another
   engineer joins, the plan collapses Week 6 into Week 5 and the
   distribution work in Month 3 happens in parallel.

2. **Ceiling on paid infrastructure.** Current stack (Neon, Vercel,
   Railway, Upstash, Clerk, Stripe, NIM free tier) costs ~$150/mo.
   Adding Browserbase for Computer Use + RN app = ~$500/mo. Is that OK?

3. **Go-to-market bias.** Two strategies:
   - **Founder-led sales** (Month 1 plan): high-touch, slow volume,
     $500 ACV, 80% retention.
   - **Content-flywheel** (TikTok + SEO): low-touch, mid volume,
     $50 ACV, 30% retention.
   The plan above is biased toward founder-led. Change that?

4. **Enterprise-first or self-serve-first in Month 3.** Week 10
   prioritizes enterprise; if you want self-serve at scale instead,
   Week 10 becomes "public launch day" instead.

5. **What are you NOT willing to ship?** Voice cloning (Chatterbox)
   has consent/spoof risk. Partner white-label adds support load.
   Flag any feature here you'd rather skip.

---

## Part IX — Definition of Done (quarter)

At the end of Week 12, we have:

- ✅ 150+ paying users across all tiers
- ✅ $10k+ MRR
- ✅ 20+ 3rd-party agents in the catalog
- ✅ 1+ enterprise contract signed
- ✅ 3+ partner agencies reselling
- ✅ Uptime ≥ 99.9% measured over 30 days
- ✅ A mobile experience that 50% of runs use
- ✅ A public audit-trail receipt on every run
- ✅ A Q2 plan informed by real data, not guesses

If we hit 6+ of these, "best platform" has a plausible claim. If we
hit all 9, it's no longer a claim — it's a fact.

---

## Part X — Execution Principles (guardrails for the 12 weeks)

1. **One primary goal per week.** Everything else moves to backlog
   or next week. No parallel "bonus" initiatives.
2. **Ship > perfect.** The retro at end of each month is when polish
   happens, not during.
3. **Every commit is individually revertible.** Same discipline as
   L1-L3 of this session.
4. **Tests stay green.** 1533 → 1533 + N. If a commit drops coverage,
   it's rebased.
5. **User signal > founder intuition** after Week 3. The retros
   explicitly weigh user feedback over my priors.
6. **Weekly retros at end of each week** — 30 min, 3 questions:
   what shipped, what surprised us, what changes next week?
