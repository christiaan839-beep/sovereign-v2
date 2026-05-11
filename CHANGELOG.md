# Changelog

All notable changes to Sovereign Matrix are documented here.

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
