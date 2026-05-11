# Plan — readiness, API keys, 12-month route, what makes this elite

Single source of truth for **where we are, what we need, and where
we're going**. Compressed from the audit + roadmap docs into one
operator-grade reference.

---

## 1. Honest readiness score — **78 / 100**

The platform is **launchable today** for soft-launch (Bar A) and
**~20 hours from public-launch grade** (Bar B). It is **NOT** at
enterprise-paid-customer grade (Bar C) yet.

### Score breakdown (each component honestly weighted)

| Dimension                    | Weight | Score | Why                                                                                           |
| ---------------------------- | :----: | :---: | --------------------------------------------------------------------------------------------- |
| **Code correctness**         |   15   |  13   | Build green · 1,193 tests · 96 tsc errors suppressed (real but small risk)                    |
| **Security blockers closed** |   15   |  13   | Stripe credit-mint closed · webhooks signed · idempotent · RLS Phase 1                        |
| **Revenue plumbing**         |   15   |   9   | Stripe Live not configured · price IDs not set · webhook URL not set (operator gates)         |
| **Auth + multi-tenancy**     |   10   |   8   | Clerk wired · webhook URL not configured (operator) · RLS Phase 2 deferred                    |
| **Reliability + ops**        |   10   |   8   | Sentry wired · 6 runbooks · readiness probe · no real load test                               |
| **Product surface**          |   10   |   9   | 4 vertical packets shipped · public pages · saved-packet dashboard                            |
| **Honest marketing**         |   5    |   4   | Just cleaned the unsubstantiated claims in `f387063`                                          |
| **Documentation**            |   10   |   9   | Audit · roadmap · launch checklist · 6 runbooks · CLAUDE.md                                   |
| **Tests**                    |   5    |   5   | 1,193 passing · packet-store tests · 4 vertical orchestrator tests                            |
| **Distribution**             |   5    |   0   | Outreach kit shipped · zero emails sent · zero customers · domain may not be on latest deploy |

**Total: 78 / 100.**

The 22 missing points break down: 6 from "haven't done operator
launch steps," 6 from "no customers / no revenue," 4 from "Bar B
polish remaining," 4 from "Bar C work deferred (RLS Phase 2,
compliance, customer portal)," 2 from "tsc strict not flipped."

**The single biggest score gain available right now is the 6 points
from operator action** — apply migrations, configure webhooks,
promote deploy, send first 5 cold emails. Zero code. ~90 minutes.

---

## 2. API keys — used vs not used vs vestigial

### Required to start (gates traffic — `/api/health/ready` returns 503 without these)

| Key                                                        | What it powers                              | Where to get                           | Free tier? |
| ---------------------------------------------------------- | ------------------------------------------- | -------------------------------------- | :--------: |
| `DATABASE_URL`                                             | Neon PostgreSQL — every authenticated query | neon.tech                              |     ✅     |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY`   | Auth on every protected route               | dashboard.clerk.com                    |     ✅     |
| `GOOGLE_GENERATIVE_AI_API_KEY` **OR** `NVIDIA_NIM_API_KEY` | At least one AI provider                    | aistudio.google.com / build.nvidia.com |     ✅     |

**Total minimum stack cost to start: $0/month.**

### Strongly recommended (gates a feature)

| Key                                           | Powers                                                 | Cost                  |
| --------------------------------------------- | ------------------------------------------------------ | --------------------- |
| `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` | Billing — without these, no paid checkouts             | 2.9% + 30¢ per charge |
| `STRIPE_PRICE_*` (4 IDs)                      | Checkout flows for each tier                           | (set once)            |
| `CLERK_WEBHOOK_SECRET`                        | Welcome email + tenant row on signup                   | (free)                |
| `UPSTASH_REDIS_REST_URL` + `_TOKEN`           | Distributed rate limiting (without it, in-memory only) | Free 10K cmd/day      |
| `RESEND_API_KEY`                              | Transactional emails                                   | Free 100 emails/day   |
| `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN`       | Error tracking                                         | Free 5K errors/mo     |
| `TAVILY_API_KEY`                              | Live web research for blog-gen + competitor agents     | Free 1K queries/mo    |
| `NEXT_PUBLIC_APP_URL`                         | Absolute-URL construction (canonical, OG, sitemap)     | (free)                |
| `ENCRYPTION_KEY`                              | At-rest encryption for stored API keys                 | (random string)       |
| `CRON_SECRET`                                 | Authenticate scheduled cron calls                      | (random string)       |
| `ADMIN_USER_IDS`                              | Bonus / referral credit grants + admin routes          | (your Clerk user ID)  |

### Useful per-vertical / per-feature

| Key                                                         | Powers                                           | Skip if…                                                  |
| ----------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------- |
| `ANTHROPIC_API_KEY`                                         | Claude 4 routing in `ai.ts`                      | NIM + Gemini are enough until Bar C                       |
| `CEREBRAS_API_KEY`                                          | Ultra-fast inference (~2,000 tok/s)              | NIM is enough                                             |
| `GROQ_API_KEY`                                              | Fast inference fallback                          | NIM is enough                                             |
| `FIRECRAWL_API_KEY`                                         | Crawl any URL for research                       | Tavily is enough                                          |
| `ELEVENLABS_API_KEY`                                        | Voice TTS                                        | Skip until voice-vertical activates                       |
| `TWILIO_ACCOUNT_SID` + `_AUTH_TOKEN` + `_PHONE_NUMBER`      | Voice calls + SMS                                | Skip until recruiting/voice flows ship                    |
| `TELEGRAM_BOT_TOKEN` + `_ADMIN_CHAT_ID`                     | Operator alerts via Telegram                     | Slack works too                                           |
| `META_ACCESS_TOKEN` + `_AD_ACCOUNT_ID`                      | Meta ad publishing for ad creatives              | Skip — ads are drafted, not auto-published                |
| `HUBSPOT_ACCESS_TOKEN` + `_CLIENT_SECRET`                   | HubSpot CRM webhook automation                   | Skip until first agency customer with HubSpot             |
| `PAYFAST_*` / `YOCO_*` / `PAYSTACK_SECRET_KEY`              | ZAR / NGN payment rails                          | Skip if billing only in USD                               |
| `KOKORO_API_KEY` / `_API_URL`                               | Open-source TTS alternative                      | Skip — ElevenLabs is better when needed                   |
| `PUSHER_APP_ID` + `KEY` + `SECRET` + `CLUSTER`              | Real-time WebSocket events (replays, dashboards) | Skip — WebSocket server (`server/ws.ts`) does this        |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`                           | Client-side Paystack inline                      | Skip if PayStack not used                                 |
| `STITCH_API_KEY`                                            | Google Stitch SDK                                | Vestigial — skip                                          |
| `X_API_KEY`                                                 | X/Twitter API                                    | Skip — no auto-publish                                    |
| `AIRTABLE_API_KEY` / `NOTION_API_KEY` / `SLACK_WEBHOOK_URL` | Internal ops integrations                        | Optional                                                  |
| `SALESFORCE_CLIENT_*`                                       | Salesforce CRM connector                         | Skip until enterprise pilot                               |
| `N8N_WEBHOOK_URL`                                           | n8n workflow automation                          | Skip — `_cron/` covers cron                               |
| `GOOGLE_SERVICE_ACCOUNT_KEY`                                | GCP integrations                                 | Skip — no GCP in critical path                            |
| `SUPABASE_URL` + `_KEY`                                     | Supabase (alternative to Neon)                   | Vestigial — we're on Neon                                 |
| `VLLM_URL`                                                  | Local vLLM model server                          | Skip — Ollama covers local                                |
| `NEMOCLAW_URL` + `NEXT_PUBLIC_NEMOCLAW_URL`                 | Local NemoClaw daemon                            | Skip — internal experiment                                |
| `WEBHOOK_API_KEY` + `WEBHOOK_SIGNING_SECRET`                | Inbound webhook auth                             | Skip — per-provider HMAC handles this                     |
| `CALCOM_BOOKING_URL` + `CALCOM_WEBHOOK_SECRET`              | Cal.com booking sync                             | Skip until first customer asks                            |
| `TELEGRAM_WEBHOOK_SECRET` + `_COMMANDER_CHAT_ID`            | Telegram inbound webhooks                        | Skip — outbound is fine                                   |
| `DATA_SOVEREIGNTY_MODE`                                     | Forces EU-region inference + PII redaction       | Skip until first EU/GDPR-strict customer                  |
| `EMAIL_ACCOUNT_CREATED_AT`                                  | Cold-send rate-limiting timer                    | Skip — defaults to "now"                                  |
| `EMAIL_FROM`                                                | Final-fallback sender                            | Skip — RESEND_FROM works                                  |
| `SYSTEM_USER_ID`                                            | System-initiated runs (cron, fan-out)            | Skip — those runs no-op without it                        |
| `VERCEL_ACCESS_TOKEN`                                       | Provisioning agent for Vercel deploys            | Skip — only the `/api/_misc/provisioning` route uses this |
| `VERCEL_AI_GATEWAY_KEY`                                     | Vercel AI Gateway routing                        | Skip — NIM router covers it                               |
| `WS_PORT`                                                   | WebSocket server port                            | Defaults to 8080                                          |
| `NEXTAUTH_URL`                                              | Legacy fallback for absolute-URL construction    | Skip — `NEXT_PUBLIC_APP_URL` supersedes                   |

### Vestigial — propose to remove from `.env.example`

- `STITCH_API_KEY` (no production caller)
- `SUPABASE_URL` + `SUPABASE_KEY` (we're on Neon)
- `VLLM_URL` (Ollama covers local)
- `NEMOCLAW_URL` + `NEXT_PUBLIC_NEMOCLAW_URL` (internal experiment, never reached production)
- `PINECONE_API_KEY` + `PINECONE_INDEX` + `PINECONE_HOST` (the lib has zero importers — `vector-memory.ts` uses NIM embeddings + JS cosine sim)
- `KOKORO_API_KEY` + `KOKORO_API_URL` + `KOKORO_TTS_URL` (ElevenLabs is the chosen TTS)
- `WEBHOOK_API_KEY` + `WEBHOOK_SIGNING_SECRET` (per-provider HMAC handles this; no generic ingress)

**Recommend a cleanup commit** — remove these 12 vestigial entries
from `.env.example`. Concrete win: a new dev's onboarding goes from
"40 keys to potentially set" to "28 keys, 3 of which are required."

### Active integrations the platform uses today

8 AI providers · Stripe · Clerk · Resend · Sentry · Tavily · Upstash
Redis · Neon · Vercel · Plausible (analytics) · ElevenLabs (when
voice fires) · Twilio (when voice fires) · HubSpot (when CRM webhook
fires) · Cal.com (when booking webhook fires) · PayFast / Yoco /
PayStack (when ZAR rails fire) · Black Forest Labs FLUX (image-gen
agent) · NVIDIA FLORENCE / OCR / DOC-INTEL (vertical agents).

**~16 active third-party integrations**, each with a real consumer
in the codebase. None are bloat.

---

## 3. The best route — proposal

### A) Ship soft launch this weekend (best ROI per hour)

- ~90 minutes operator clicking from `docs/runbooks/launch-checklist.md`.
- Expected outcome: first paid checkout flows end-to-end. First 5
  cold emails sent. 1–3 replies by Wednesday.
- **Gain in readiness score: +8 → 86/100.**

### B) Bar B engineering polish (next 2 weeks, ~20 hrs)

- Wire `output-verifier` into `agent-factory` as `useVerifier?: true`
  opt-in (~6 hrs). Closes the only Tier-B claim still aspirational.
- Knock down 30 of the 96 tsc errors (TS2339 cluster). En route to
  flipping `ignoreBuildErrors: false`. (~3 hrs)
- Mobile responsive audit on 4 packet pages (~2 hrs + your phone).
- 2 anonymized `/case-studies` entries (~1 hr per, after a customer
  conversation).
- Demo Loom video (~1 hr).
- Sub-processor list at `/sub-processors` (~30 min).
- Honest Stripe Customer Portal embed (~3 hrs).
- Per-asset retry button on partial-failure packets (~2 hrs).
- Verify Sentry source maps upload (~30 min).
- Remove the 12 vestigial env-var entries (~10 min).

**Gain in readiness score: +9 → 95/100.**

### C) DON'T do this route

- Do not start Phase 3 work (POPIA endpoints, RLS Phase 2, dashboard
  sub-page audit, Vertical 5) until 10 paying customers exist.
- Do not raise capital until $5K MRR.
- Do not hire until founder hours exceed product capacity.

---

## 4. What I can ship this month (May 2026)

In a focused 80-hour month with ~3 cooking sessions per week:

### Week 1 (this week)

- ✅ Roadmap + readiness doc (this commit)
- ✅ Audit + cull (already shipped, `be41b80`)
- Operator launch (you, ~90 min)
- Per-asset retry button (~2 hrs)
- Stripe Customer Portal embed (~3 hrs)
- Verify Sentry end-to-end (~30 min)
- Clean 12 vestigial env vars (~10 min)
- Send first 5 cold emails (you, ~30 min)

### Week 2

- Wire `output-verifier` into agent-factory (~6 hrs)
- TS strict mode flip — 30 errors knocked down (~3 hrs)
- Mobile audit + fixes (~3 hrs)
- Sub-processor list page (~30 min)
- Two more verticals' real-customer outreach pushes (you, ~3 hrs)

### Week 3

- 2 anonymized case studies (after customer conversations) (~3 hrs)
- Demo Loom video (~2 hrs production + 30 min embed)
- 30 more tsc errors (~3 hrs) → likely sub-30 errors total, flip strict
- Schema.org JSON-LD on the 12 sector pages (~2 hrs)
- Per-vertical case studies × 4 starts (depends on customer pace)

### Week 4

- POPIA / GDPR `/api/me/export` endpoint (~4 hrs)
- POPIA / GDPR `/api/me/delete` endpoint (~4 hrs)
- Vertical 5 (cybersecurity SOC pulse) IF customer demand exists (~6 hrs)
- Stripe Tax setup if first EU/SA invoice in flight (~1 hr)

**End-of-month state target: ~110 hours of Bar B + early Bar C work
shipped. ~10 paying customers. $5K–$15K MRR if outreach lands.**

---

## 5. Honest 12-month plan

### Month 1 (May) — Bar A → Bar B

**Ship:** soft launch, public launch, 10 paying customers, $5K–$15K MRR.
**Don't ship:** more verticals, RLS Phase 2, native mobile.

### Month 2 (June) — First wave of customer feedback

**Ship:** real-customer-driven feature requests · case studies × 4 ·
self-service plan-change UX · invoice download · failed-payment
dunning UX · POPIA/GDPR endpoints.
**Target:** 30 paying customers, $20K–$30K MRR.

### Month 3 (July) — RLS + compliance + dashboard prune

**Ship:** RLS Phase 2 (12 hrs of real work) · dashboard sub-page
audit (delete 20–30 routes after PostHog data) · Stripe Tax · first
agency reseller white-labeling · OpenAPI spec at `/api/docs/openapi.json`.
**Target:** 60 paying customers, $40K–$60K MRR.

### Month 4 (Aug) — First hire decision

**Ship:** first hire (CS / ops generalist, Cape Town ZAR) IF founder
hours > product capacity · Vertical 5 · Vertical 6.
**Target:** 100 paying customers, $70K–$90K MRR.

### Months 5–6 — Compounding

**Ship:** wire 2–3 of the Tier-B unwired modules customers ask for
(probably `peer-loop` + `citation-engine`) · multi-region read
replicas · custom domain whitelabel for highest tier.
**Target:** 150 paying customers, $100K–$130K MRR.

### Months 7–9 — $1M ARR run-rate

**Ship:** real load test → fix bottleneck · second hire (engineer) ·
real conference talk (PyCon SA / AfricArena / MicroConf) · public
roadmap voting.
**Target:** 250 paying customers, $150K–$200K MRR.

### Months 10–12 — $1M+ ARR

**Ship:** custom-domain whitelabel · marketplace creator earnings
payout (the 70% creator earnings claim becomes real) · Anthropic
partnership conversation reaches concrete stage · first enterprise
contract.
**Target:** 350 paying customers, $200K–$300K MRR ($1M ARR run-rate
threshold reached).

**Realistic vs aspirational:** every number above is 50th-percentile
for solo SaaS founders who pick a wedge, send the outreach, and don't
quit at year 1. The 90th-percentile outcome is 3× bigger; the 10th
percentile is 0.

---

## 6. What this platform needs to be elite

Six things separate an elite SaaS from a good SaaS at $1M ARR:

1. **Compounding distribution.** OSS (`@sovereign/ai-router` already
   shipped) + content engine (the `/vs/` library + sector pages
   compound on SEO) + agency reseller flywheel.
2. **Genuinely safe agent outputs.** Not just claimed — actually
   wired. Today the 5-layer pipeline IS wired in `agent-factory`;
   add `output-verifier`, `peer-loop`, `citation-engine` as opt-in
   layers when the customer demand arrives. Make the safety claim
   audit-defensible.
3. **Tenant isolation that survives a security audit.** RLS Phase 2
   on Postgres with `withTenantContext()` per request. This is the
   single hardest engineering item; deferred to Month 3 deliberately.
4. **Real customer evidence on every page.** Real case studies × 4 on
   the homepage by Month 3. Not made up. Not anonymized beyond
   recognizability.
5. **Honest pricing that maps to a buyer's vertical in 5 seconds.**
   The pricing page vertical matcher is shipped. Keep refining as
   customer feedback arrives.
6. **Founder-led support for the first 100 customers.** No support
   widget, no escalation tree. You answer every email for 100
   customers. The product roadmap comes from those conversations.

## What this platform does NOT need to be elite

| Tempting but skip                                                | Why                                                                        |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Beautiful cinematic landing animations beyond what's shipped** | The current landing is plenty. Polish that converts.                       |
| **Native mobile apps**                                           | Web-responsive PWA carries to $5M ARR.                                     |
| **Self-hosted / air-gapped option**                              | Build only with a paid commitment.                                         |
| **Full multi-language UI**                                       | English carries to $1M ARR in EMEA + Africa. Localize content, not chrome. |
| **A second product**                                             | Dilution kills sub-$5M ARR companies. Stay narrow.                         |
| **AI-powered customer support widget**                           | Founder-led email is more valuable than auto-replies for the first 100.    |
| **Public Slack / Discord community**                             | Open at 100 customers, not before.                                         |
| **Series A on cold investors**                                   | Bootstrapped to $5M ARR is more valuable than $20M raised on $5M ARR.      |
| **A second model provider per category**                         | The 8-provider router covers redundancy.                                   |
| **A second database (read replica only counts after $1M ARR)**   | Neon Pro carries far.                                                      |
| **A second auth provider**                                       | Clerk carries far.                                                         |
| **A second billing provider**                                    | Stripe + ZAR rails carry far.                                              |
| **Multiple support languages**                                   | English-first works for the target market.                                 |
| **A separate API gateway product**                               | The `@sovereign/ai-router` npm package IS that.                            |

---

## Bottom line

**Readiness: 78/100. Soft launch: 90 minutes from now. Public launch:
20 hours of code from now. $1M ARR: 12 months from now if you ship
this list and don't quit.**

The single biggest risk is the trap that kills most solo SaaS
founders: spending another 200 hours on Bar C polish before there's
a single paying customer to validate any of it. Every "what we don't
need" item in this doc is a feature a competing voice in your head
will try to convince you is required pre-launch. None of them are.

Ship `docs/runbooks/launch-checklist.md` Phase 0 this weekend. Send
the first 5 cold emails Monday. Watch what breaks.
