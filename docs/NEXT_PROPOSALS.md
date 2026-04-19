# Next-Level Proposals — Beyond the Core 10

These are strategic + product proposals that emerged from deep review of
the codebase and the Claude Partner Network thread. Ranked by
**defensibility × speed to ship × effect on conversion**.

---

## K — Outcome Pricing Guarantee (7-day refund on no-results)

**Problem:** Every AI agent platform on the market says "try it, you'll
love it." Customers have been burned by credits-that-expire and
hallucinated outputs. Trust is the friction, not price.

**Proposal:** Every paid tier includes a **"Results in 7 Days" money-back
guarantee**. If your agents haven't generated at least one of:
- 10 qualified leads
- 5 published pieces of content
- 1 completed competitor dossier
- 1 signed client call

…we refund your first month. No questions. One email.

**Why it's defensible:** Competitors won't copy it because most can't
guarantee outcomes (credit-based models don't know what "done" means).
You can because your agents track `playbook_runs.status = done` and we
have the metering data to validate claims.

**Effort:** XS. A single UI string + one refund logic path in Stripe.

---

## L — The Founder Network (first-100 program)

**Problem:** No paying customers yet. Word-of-mouth needs a cohort.

**Proposal:** Extend the existing "Founders" hardcoded list to an
explicit **First-100 Founder Network**. Not a discount — a
relationship:
- Lifetime 50% off
- Monthly 1:1 with the founder (you) — 30 min
- Direct Slack access
- Vote on roadmap (top-voted feature ships every month)
- Public recognition: optional "Founder Network Member" badge on
  their LinkedIn / Twitter
- Referral commission: 30% of every customer they refer, forever

**Why it's defensible:** Competitors can discount, but the
"voting-on-roadmap + direct founder access" only works when there's
one founder. Becomes a live demo of the partnership model Anthropic
is already interested in.

**Effort:** S. Dashboard card + Stripe metadata + Linear board for
the vote tally. ~2 hours.

---

## M — Agent Resume Files (`.agent.md`)

**Problem:** Agent marketplace is empty. Developers need a reason to
publish.

**Proposal:** Every agent ships with a **resume file** at
`.claude/agents/<slug>.agent.md`. It contains:
- What the agent does (one paragraph)
- Inputs with examples
- Outputs with examples
- Benchmarks (latency p50/p95, quality score)
- Dependencies (models used, APIs called)
- Author + license
- Change log

Agents that ship a resume get **auto-featured** in the marketplace.
Resume format is open — other platforms can adopt it.

**Why it's defensible:** Format-ownership. If `.agent.md` becomes the
way to publish an AI agent (the way `README.md` became the way to
publish code), every agent marketplace converges on your spec. Same
playbook as `package.json` and `Cargo.toml`.

**Effort:** S. Zod schema + `/api/marketplace/publish` route that
parses resumes.

---

## N — Sovereign IQ Score

**Problem:** Customers don't know how to evaluate their own AI maturity.

**Proposal:** A free public tool at `/sovereign-iq` that takes a
company domain and returns:
- An AI-augmentation maturity score (0-100)
- Which of 8 categories they're weak in (lead gen, content, SEO,
  support, sales, ops, analytics, compliance)
- A custom 25-playbook recommendation for their score

Powers itself via:
1. Public-web research on the domain (Tavily)
2. Competitor agents scanning their stack
3. Nexus Protocol synthesizing the verdict

**Why it's defensible:** The score becomes a category benchmark.
Competitors either ignore it (and lose the conversation) or adopt it
(and become your downstream).

**Effort:** M. Reuses existing agents + Nexus. ~half-day.

---

## O — Voice-first Nexus Protocol

**Problem:** Nexus is mouse+keyboard. Demoability drops when a VC is
on a phone call.

**Proposal:** `/nexus/voice` — speak your question, hear the four
models argue, hear Gemini synthesize the final answer. Uses existing
Magpie TTS + Web Speech API.

**Why it's defensible:** Every competitor's demo is "type a prompt,
wait." A phone call where you *hear* four AIs debate is a different
artifact entirely.

**Effort:** M. All the pieces exist (Nexus API, TTS, speech
recognition). ~half-day to stitch.

---

## P — Agent OS for Mobile (iOS companion)

**Problem:** Today Sovereign Matrix is web-only. Founders live on
their phones.

**Proposal:** SwiftUI iOS app (React Native would also work) with:
- Dashboard tile list (recent runs, active schedules)
- One-tap "Run playbook"
- Push notifications when a playbook completes
- Share sheet: "Summarize this article with Sovereign"

**Why it's defensible:** Claude/ChatGPT have phone apps, but no AI
*agent* platform does. First-mover moat on the home-screen icon.

**Effort:** L (day+ / week of focused work). Can start with a PWA
wrapper of the dashboard for same-day ship, native later.

---

## Q — Agent Hardware Bundle (pre-loaded Mac Mini)

**Problem:** "Run locally via Ollama" is a line item buried on the
pricing page. Nobody configures it.

**Proposal:** Sell a pre-configured Mac Mini M4 (or Framework Desktop)
that ships with:
- Sovereign Matrix pre-installed
- Ollama with the top 10 agents loaded
- A pre-generated Clerk organization
- One-time setup wizard ("enter your subdomain")
- Hardware is physical proof of the "runs on your own hardware" claim

Priced at $2,999 — Mac Mini M4 is ~$999 at cost; $2,000 margin covers
annual support + software subscription.

**Why it's defensible:** Nobody else ships hardware. It also flips the
"enterprise security" conversation: *"Your data never leaves your
building."*

**Effort:** L. Logistics-heavy (supplier, shipping, returns). But
mothly run rate of 10 units = $30k/mo revenue with marginal support
cost.

---

## R — Weekly Intelligence Report (auto-generated from playbook runs)

**Problem:** Customers churn because they forget the platform is
working.

**Proposal:** Every Monday 07:00 UTC, send a personalized email:
- "Here's what Sovereign Matrix did for you last week"
- Aggregated from `playbook_runs` + `usage`
- Claude writes it in the customer's brand voice (BYOK)
- Highlights: "Your lead finder sourced 47 prospects. The competitor
  scanner tracked 3 new competitors. Your top-performing playbook this
  week was X."
- CTA: "Upgrade to Growth to unlock Y more runs"

**Why it's defensible:** Usage-based retention artifact. Once this
lands in the customer's inbox weekly, they can't forget the platform
exists.

**Effort:** S. We already ship a `weekly-report` agent — extend to send
per-user, not just per-admin.

---

## S — "Train your agent" recorder

**Problem:** Every customer wants slightly different behavior. BYOK
is key-level, not behavior-level.

**Proposal:** `/dashboard/train` — a recorder UI where the user
demonstrates a task once (file, phone call, webpage flow). Sovereign
ingests the recording, extracts the pattern, and creates a custom
playbook for that user. Built on top of Nexus-style multi-model
consensus to distill the pattern.

**Why it's defensible:** The corpus of user-specific playbooks becomes
data moat. Competitors can't replicate your playbook library without
replicating your user-hours.

**Effort:** L. Requires video/audio ingestion + a recording UI. Start
with text-only pattern extraction (paste examples, we generate the
playbook).

---

## T — White-label Claude Partner Portal (sold to agencies)

**Problem:** Agencies want to resell AI agents to their clients but
don't want to build the platform.

**Proposal:** Every Enterprise tier gets a **branded portal**:
- `<agency>.sovereignmatrix.agency` or custom domain
- Their logo, their colors, their support email
- Their clients see "Powered by Claude" (honestly — you route to
  Claude), never see "Sovereign Matrix"
- They charge their clients $200/month/seat, you charge them
  $50/month/seat

**Why it's defensible:** You already have the multi-tenant architecture
(RLS, tenant scoping, per-user BYOK). Exposing it as a white-label
product is a 20-agent effort, not a 200-agent one. Every agency you
sign becomes a distribution channel you don't pay for.

**Effort:** M. Existing `/dashboard` → tenant-scoped subdomain
routing. ~1 day.

---

## Strategic stack ranking (if you pick only 3)

1. **R — Weekly Intelligence Report** (retention + conversion; S effort)
2. **K — Outcome Pricing Guarantee** (trust unlock; XS effort)
3. **T — White-label Agency Portal** (distribution; M effort)

All three can ship in a focused week. Each reinforces the others:
- R gives customers proof it's working
- K removes the risk of trying
- T turns every agency into a growth engine

Combined, these three are the "how do we get to 100 paying users in
60 days" plan — not "build more features."
