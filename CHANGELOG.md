# Changelog

All notable changes to Sovereign Matrix are documented here.

## [2.13.0] — 2026-05-12

The **distribution + vertical-lift** pass. Wires the Cook 63/64 Slack

- GitHub adapter libraries to live HTTP surfaces and ships the
  Tier-1 pharma ICP vertical landing.

### Added

- **`src/app/api/_webhooks/slack/route.ts`** (Cook 67) — `/api/_webhooks/slack`
  route handler. Slack v0 HMAC verification, 5-minute freshness gate,
  slash-command dispatcher (`/sovereign run | verify | help`). Returns
  503 without `SLACK_SIGNING_SECRET` — no silent unauthenticated
  acceptance.
- **`src/app/api/_webhooks/github/route.ts`** (Cook 68) — GitHub App
  webhook handler. `x-hub-signature-256` HMAC verify, `x-github-delivery`
  idempotency, `pull_request` extraction to a typed review request.
  Returns 503 without `GITHUB_WEBHOOK_SECRET`.
- **`src/app/for-pharma/page.tsx`** (Cook 69) — Tier-1 ICP vertical
  landing. Hero, 5 primitives (Part 11 receipts, protocol-deviation
  rubric, multi-party attestation, hallucination guard, framework
  mappings), 3 use cases (Type C briefing, DSUR drafting, regulatory
  intel sweep), 8 pre-mapped controls.

### Notes

- The Slack / GitHub HTTP routes still need their corresponding apps
  registered in the respective developer portals (Slack App Manifest,
  GitHub App OAuth). The route handlers are correct + signed-verifiable
  the moment those external registrations exist.

---

## [2.12.0] — 2026-05-12

The **close-the-loop** pass. 6 final elite-tier primitives bring
the Tier 1-7 expansion playbook to **34/34 coverage** on the branch.

### Added

- **`src/lib/tools/browser-automation.ts`** (Cook 61 / Tier 2 #8) —
  Tier-3 browser-automation tool with typed discriminated-union
  action grammar (navigate / click / type / screenshot / wait /
  evaluate). Reuses Cook 36 SSRF guard. 30-action cap, 30s per-step
  timeout, screenshot output truncated to 200 KB.
- **`src/lib/marketplace-core.ts`** (Cook 62 / Tier 4 #16) — Third-
  party agent listing core. State machine (draft → submitted →
  approved → published; rejected / unpublished). `splitRevenue()`
  banker's-rounded so platform + developer cents always sum to total —
  no fee leakage. Published listings require ≥1 safety layer +
  non-zero price.
- **`src/lib/slack-adapter.ts`** (Cook 63 / Tier 5 #21) — Slack v0
  HMAC verifier + slash-command parser. 5-minute freshness, 30s skew,
  constant-time compare. Ephemeral-by-default response builder.
- **`src/lib/github-adapter.ts`** (Cook 64 / Tier 5 #25) — GitHub
  webhook HMAC verifier + pull-request extractor + check-run builder.
  Conclusion-required-when-completed gate.
- **`src/lib/extension-sdk.ts`** (Cook 65 / Tier 5 #22 + #23) — Shared
  adapter for browser + VS Code extensions. `invokeAgent()` validates
  PAT, slug, selection (text, URL safety, byte cap) before any HTTP
  call; discriminated outcome covering rate-limited, upstream-error,
  network-error, malformed-response.
- **`src/lib/workflow-builder.ts`** (Cook 66 / Tier 6 #27) — Typed
  visual-builder DSL with validation (no-start, multiple-starts,
  cycles via DFS three-color, dangling edges, orphans, branch-arm
  - agent-slug shape) and compile-to-Cook-37 emitter.

### Notes

- 93 new tests; total branch suite at 1843 passing.
- All 7 tier playbooks complete at the library layer:
  Tier 1 (5/5), Tier 2 (5/5), Tier 3 (5/5), Tier 4 (5/5),
  Tier 5 (5/5), Tier 6 (5/5), Tier 7 (4/4).

---

## [2.11.0] — 2026-05-12

The **revenue + ops** pass. 5 modules + HMAC hardening.

### Added

- **`src/lib/audit-bundle.ts`** (Cook 56 / Tier 4 #18) — Compliance
  evidence-pack subscription. Composes Cook 46 scheduling + Cook 53
  attestation + Cook 55 receipt analytics. `bundleId =
sha256(tenantId|periodStart|periodEnd)` — deterministic idempotency.
- **`src/lib/whitelabel-pricing.ts`** (Cook 57 / Tier 4 #20) — Per-
  domain pricing rules. Flat $/run or markup-over-cost. Token-bucket
  rate limiter that refills over time + caps at capacity.
- **`src/lib/soc2-monitor.ts`** (Cook 58 / Tier 7 #34) — 9-rule SOC 2
  TSC posture aggregator. Pass / warn / fail / not-applicable per
  rule + per-TSC + overall fraction.
- **`src/lib/cli-dispatcher.ts`** (Cook 59 / Tier 5 #24) — Typed argv
  parser + `CommandRegistry`. `--flag value`, `--flag=value`, `-short`,
  bare-boolean parsing. Required-flag enforcement.
- **`src/lib/voice-loop.ts`** (Cook 60 / Tier 2 #7) — ASR → agent →
  TTS orchestrator. MIME allowlist, byte + transcript caps, per-stage
  latency tracking, discriminated failure codes.

### Changed

- **`src/lib/attestation-letter.ts`** — security hardening:
  `verifyAttestationLetter` switched to `lastIndexOf` for signature
  block extraction (defense against body fields that contain the
  sentinel); constant-time compare now pads both buffers to the longer
  length so loop length is independent of supplied signature length
  (closes a 1-bit length oracle).

### Notes

- 66 new tests; security review came back 0 critical / 0 high (after
  hardening) / 4 medium / 2 low. Overall risk LOW.

---

## [2.10.0] — 2026-05-12

The **trust + UX + receipts** pass. 5 modules + 68 tests.

### Added

- **`src/lib/selective-disclosure.ts`** (Cook 51 / Tier 3 #12) — Merkle-
  proof selective disclosure with domain-separated leaf vs internal
  hashing (0x00 / 0x01 prefix). Reveal one receipt field without
  exposing the rest.
- **`src/lib/billing-math.ts`** (Cook 52 / Tier 4 #19) — Pure cents
  math with banker's rounding. Monthly / annual cadence quote, prorated
  upgrades + downgrades, calendar-aware `addMonths()` (end-of-month
  clamp, leap-year aware).
- **`src/lib/attestation-letter.ts`** (Cook 53 / Tier 7 #33) — HMAC-
  signed compliance attestation letter that composes the framework
  scorecards from Cook 49.
- **`src/lib/tools/code-sandbox.ts`** (Cook 54 / Tier 2 #10) — Tier-3
  code-execution tool. Python / Node / Bash allowlist, 50 KB code cap,
  30s default timeout (300s max), literal `confirmExecution` guard.
- **`src/lib/receipt-analytics.ts`** (Cook 55 / Tier 6 #29 + #30) —
  Pure timeline + diff aggregators. Daily / weekly bucketing, per-
  status counts, top agents per bucket, field-by-field diff with
  added / removed / changed / same ops.

---

## [2.9.0] — 2026-05-12

The **trust + revenue + compliance + UX** pass. 10 modules + 100+
tests across Tiers 2-7.

### Added

- **`src/lib/hallucination-detector.ts`** (Cook 41 / Tier 3 #14) —
  Verifier layer 6. Sentence-by-sentence groundedness scoring against
  supplied sources. Lexical overlap + explicit citation.
- **`src/lib/bias-auditor.ts`** (Cook 42 / Tier 3 #15) — Fairness
  rubric across 4 dimensions (gendered language, stereotyping,
  absolutist claims, demographic exclusion).
- **`src/lib/multi-party-attestation.ts`** (Cook 43 / Tier 3 #11) —
  N-witness co-signed receipts with M-of-N + all-of quorum policies.
  Cross-witness immunity via witness-id-in-digest.
- **`src/lib/red-team.ts`** (Cook 44 / Tier 3 #13) — Baseline adversarial
  probe library + campaign runner with concurrency.
- **`src/lib/cost-telemetry.ts`** (Cook 45 / Tier 6 #28) — Per-
  agent / model / tenant spend aggregator with percentile-based
  anomaly flagging.
- **`src/lib/scheduling.ts`** (Cook 46 / Tier 2 #6) — Pure 5-field
  cron parser + next-fire computation.
- **`src/lib/webhook-triggers.ts`** (Cook 47 / Tier 2 #9) — Typed
  (source, eventType) → agent mapping with signature gate +
  conditional dispatch.
- **`src/lib/pay-per-replay.ts`** (Cook 48 / Tier 4 #17) — Microbilling
  for receipt verification API.
- **`src/lib/compliance-mappings.ts`** (Cook 49 / Tier 7 #31 + #32) —
  EU AI Act Annex IV + NIST AI RMF + ISO 42001 controls mapped to
  Sovereign capabilities.
- **`src/app/agents/page.tsx`** (Cook 50 / Tier 6 #26) — Public
  catalog of all 145 agents grouped by inferred category.

---

## [2.2.0] — 2026-05-11

The **audit-grade UX pass**. Builds on the v2 launch's verifiable
receipts foundation by making the moat tangible everywhere a visitor,
customer, or compliance officer looks. Repositions the platform from
indie-hackers "founders-club" framing to audit-grade infrastructure
for AI in regulated industries.

### Added

- **`/explorer`** — public block-explorer-style live feed of receipts
  being signed. Polls every 12s, cyan-themed, framer-motion staggered
  entrance, stats strip. Subscribe via RSS link.
- **`/badge`** — public verification-badge builder. Paste receipt id →
  pick theme → toggle link-back → live preview using the actual
  `/embed/verify.js` → copy snippet. Accepts `?id=<receipt>` deep-link.
- **Receipt page (`/r/[id]`) live verification** — auto-verifies on
  mount with timing animation, share widget (copy + tweet),
  collapsible "verify in your own browser" panel with copy-pasteable
  7-line JS snippet that works on preview deploys + white-label
  domains.
- **Landing `<LiveVerifierDemo />`** — interactive proof block on the
  landing. Fetches the freshest public receipt, animates real
  `/api/verify` round-trip, "Tamper & verify" mutates one byte and
  shows the HMAC reject.
- **Dashboard `<AuditPulseStrip />`** — at the top of `/dashboard`:
  signed-receipt count, truncated Merkle chain root, copy-root button,
  audit-bundle download, audit-trail link.
- **Receipts list → badge builder wiring** — per-row "Get badge" code
  icon on `/dashboard/receipts` opens `/badge?id=…` pre-filled. Three
  clicks from receipt to live verification badge on the customer's
  own domain.
- **Coinbase Commerce integration** — BTC / ETH / USDC / DAI / LTC /
  DOGE / SHIB checkout via hosted Commerce charges. UI gated behind
  `NEXT_PUBLIC_CRYPTO_PAYMENTS_ENABLED` (off by default; backend
  routes always live). Hardened webhook: amount + currency validation,
  charge refetch via merchant API, rate-limited, prototype-pollution-
  safe plan lookup, idempotent on event id.
- **Cinematic landing dividers** — `<SectionDivider />` with cyan /
  copper alternation marks the audit ↔ marketing surface boundaries
  per the dual-accent rule.
- **Film-grain overlay** — `<FilmGrain />` pure-SVG noise component
  (~280 bytes inlined) for premium cinematic depth.
- **Audit-grade SEO** — root `<head>` metadata, OG, Twitter, JSON-LD
  rewritten to lead with the verifiable-receipts narrative.
- **`docs/design-system/brand-colors.md`** — codifies the dual-accent
  rule (cyan = audit/infrastructure, copper = marketing/agency).
- **`docs/crypto-payments.md`** — three-mode framing
  (centralized / hybrid / self-custody).
- **+41 tests** — full coverage for `/api/agent-runs/recent-public`,
  `/api/agent-runs/latest-public`, Coinbase Commerce lib + webhook.
  Webhook tests pin every security-review finding to a regression
  case.

### Changed

- **Pricing simplified** — 5 visible tiers (Founder / Starter $19 /
  Growth $49 / Sovereign Node $199 / Enterprise $499) → 3 visible
  (Free / Pro $49 / Team $199). `plans.ts` retains all 6 legacy plan
  IDs for backward compatibility with existing subscribers.
- **Landing professionalization** — removed `<StackKiller />` cost-
  displacement section ("vs HubSpot $890/mo, vs Apollo, vs Jasper")
  and `<FounderSeats />` ("100 seats", "Direct Slack to the founder",
  monthly 1:1 founders-club pitch). vs-competitor trust-line links
  → VAOS 1.0 spec / Live verifier demo / Receipt explorer.
- **"Email the founder" CTA → "Contact sales"** with role address
  (`hello@sovereignmatrix.agency`).
- **TypeScript strict mode** — `typescript.ignoreBuildErrors: false`
  enforced on every PR's CI Build gate. Every error knocked down or
  scoped with a concrete `@ts-expect-error`.
- **Root loading screen** — emerald → cyan per the dual-accent rule.
- **Onboarding completion screen** — stat trio swapped to
  "137 Agents / HMAC Signed / OTS Bitcoin anchor" + a paragraph
  explaining `/r/<id>` receipts. Payments footer acknowledges Card +
  EFT + ZAR + USD.
- **Performance** — 4 below-fold landing sections (LiveVerifierDemo,
  StackKiller, FounderSeats, CommandEgg) dynamic-imported with
  skeleton fallbacks. SSR stays on for everything that needs it.

### Fixed

- **CRITICAL: RSS feed enumerated unlisted receipts** — `/r/feed.xml`
  was returning `inArray(["public", "unlisted"])`. Same share-by-link
  contract violation the pre-merge security review caught on the
  other public endpoints. Fix: `eq("public")` only.
- **CRITICAL: `/api/agent-runs/latest-public` could leak unlisted** —
  added `eq("public")` filter.
- **404 sweep** — `/sign-up → /signup` typo, `/dashboard/agents/new →
/dashboard/agent-builder` typo, plus 5 `next.config.ts` redirects
  for routes referenced in marketing but never built (`/platform`,
  `/trust`, `/customers`, `/dashboard/blog-gen`, `/dashboard/nexus`).
- **Mobile overflow on `/spec`** — wrapped the "Spec at a glance"
  table in `overflow-x-auto`.
- **Stale agent-count drift** — 130-agent and 30-featured-agent
  mentions swept to 137 across landing, marketing pages, JSON-LD,
  manifest, onboarding, dashboard billing, developer docs.
- **Stale pricing drift** — R349/Starter $19 mentions on `/now`,
  `/playbooks`, `/playbooks/growth-pulse` updated to R997/Pro $49.

### Security

- **Coinbase Commerce webhook hardened** after security-reviewer pass:
  - HMAC signature header pre-validated for exactly 64-char hex
    (pre-auth DoS guard — rejects a 1MB attacker payload before
    Buffer allocation)
  - Amount + currency match against `PLANS[plan]` (closes the "pay
    $0.01 for enterprise" tampering attack)
  - Charge refetch via merchant API key (defense-in-depth on a
    hypothetically-leaked webhook secret)
  - Pre-signature rate limit (60/min)
  - `Object.prototype.hasOwnProperty.call` for plan whitelist (vs
    `in` operator that walks the prototype chain — closes
    `__proto__` / `constructor` injection)
  - Idempotent on event id (chain-reorg duplicates)
- **`/api/agent-runs/recent-public` returns signature fingerprints,
  not raw signatures** — never exposes the HMAC the consumer should
  fetch from `/r/[id]`.

### Pending manual ops (block customer activation, not deploy)

- `STRIPE_PRICE_*` env vars in Vercel
- Stripe webhook endpoint URL + `STRIPE_WEBHOOK_SECRET`
- Clerk webhook endpoint URL + `CLERK_WEBHOOK_SECRET`
- Any unapplied Drizzle migrations in Neon SQL Editor
  > > > > > > > origin/main

## [2.1.0] — 2026-04-03

### Added

- **Founders Program** — First 10 users get lifetime enterprise access (10,000 runs/month) for free
- **25 Playbooks** — 13 general + 4 Real Estate + 4 Legal + 4 Recruiting
- **Output Guarantees** — Lead Blitz, Competitor Takedown, and Content Machine now guarantee specific results or re-run free
- **Consensus Engine** — Multi-model verification: generate with Model A, critique with Model B, revise (lib/consensus.ts)
- **Smart AI Layer** — Chain-of-thought reasoning, model escalation, category-aware anti-slop prompts
- **Webhook Trigger API** — External endpoint for Zapier/Make/n8n automation (api/\_agents/trigger)
- **Agent Performance API** — Per-agent execution metrics with trend detection
- **Admin Dashboard** — MRR/ARR calculator, user growth, agent usage, valuation estimate
- **Usage Metering API** — Per-user consumption tracking with plan-aware limits
- **API Catalog** — Auto-generated platform capability manifest at /api/api-catalog
- **Health Ping** — Lightweight uptime check at /api/health/ping
- **MCP Server** — 6 tools to operate the platform from Claude Code
- **Sentry Integration** — Error tracking with session replay on errors
- **E2E Tests** — Playwright test suite for landing page, public pages, API endpoints, mobile
- **Google Gemma 4** — Added to model registry, failover chain, smart router, and consensus engine
- **Llama 4 Maverick** — 128-expert MoE for video understanding
- **Chatterbox TTS** — Zero-shot voice cloning (MIT license)
- **Qwen 3 ASR** — Multilingual speech-to-text
- **Landing Page Pain Section** — Problem-first narrative with dollar costs
- **Floating Model Constellation** — 8 model badges with hover physics in hero
- **Zero-Shot Onboarding** — Paste URL → auto-analyze company → configure dashboard

### Fixed

- **CRITICAL: Static Agent Registry** — All 129 agents now work on Vercel (replaced webpackIgnore dynamic imports)
- **CRITICAL: Leads Agent** — Rewrote to use Tavily web research + createAgentRoute (was returning "Invalid action")
- **CRITICAL: Email Sequence** — Fixed double req.json() call that made all playbook emails empty
- **CRITICAL: Audit Logs IDOR** — Added userId WHERE clause (previously leaked all users' data)
- **CRITICAL: Organizations IDOR** — Replaced SELECT \* + JS filter with inArray() query
- **Stripe → Yoco** — Replaced all user-facing Stripe references with Yoco (10 files)
- **Old Branding** — Removed all "Umbra" references from export filenames
- **AI Slop** — Eliminated "paradigm", "world-class", "cutting-edge" from all pages
- **Hydration Mismatch** — Fixed new Date() in useState on god-eye page
- **Unescaped Entities** — Fixed quotes in support-router JSX
- **Model Names** — Fixed nemotron-ultra-253b → nemotron-ultra-253b-v1 in 11 files
- **CRON Auth** — Added CRON_SECRET validation to content-publisher (5/5 now secured)
- **Nav/Page Title Mismatches** — Fixed 5 inconsistencies (Competitors→Market Intel, etc.)
- **Admin API Path** — Fixed /api/admin/analytics → /api/\_misc/admin/analytics fetch

### Changed

- **Navigation** — Simplified from 16 → 9 visible items (progressive disclosure)
- **Free Tier Limits** — Updated to match pricing: free=50, array=500, node=2000, enterprise=10000
- **Smart Router** — Category-aware system prompts, chain-of-thought for complex tasks, model escalation
- **Agent Factory** — Added tenantId and orgId to AgentContext for all 129 handlers
- **Coordinator** — Expanded from 9 → 23 available agents, added playbook mode

### Removed

- **31 Dead Components** — 3,800 lines of unused code (ChatLayout, HeroWebGL, etc.)
- **Fake Demo Data** — Replaced hardcoded stats on 6 pages with real API fetching
- **.env.example from .gitignore** — Now properly tracked in version control

### Security

- Multi-tenant isolation (tenant-resolver.ts, tenant-scope.ts)
- SSRF protection (private IP blocklist in validation.ts)
- SQL injection fix (parameterized queries in onboarding-drip)
- PII scanning on all agent output
- Jailbreak detection on all agent input
- 3-tier action approval (Autonomous/Confirm/Restricted)
- Anti-distillation canary in system prompts

### Infrastructure

- Upstash Redis rate limiter (graceful fallback to in-memory)
- Static import registry for Vercel serverless compatibility
- Direct route re-exports for health, usage, catalog, admin, founders
- ESLint config: excluded scripts/, server/, mcp-server/
- .env.example documents 80+ environment variables

---

## [2.0.0] — 2026-03-28

Initial release of Sovereign Matrix v2.

- 124 AI agents
- NVIDIA NIM integration (65+ free models)
- Next.js 15 App Router
- Clerk authentication
- Neon PostgreSQL with Drizzle ORM
- PayFast + PayStack payments
- Circuit breaker pattern
- Anti-slop content engine
