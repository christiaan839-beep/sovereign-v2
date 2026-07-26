# Codebase audit — keep / cut / wire

Comprehensive audit of the Sovereign Matrix v2 codebase as of branch
`claude/complete-project-74XPN` @ `f5665b4`. Goal: identify what's
real, what's dead, what's "infra ahead of consumers" (built but not
wired), and what can be safely cut.

---

## Surface area at a glance

| Metric                                                     | Count              |
| ---------------------------------------------------------- | ------------------ |
| TypeScript / TSX files in `src/`                           | 967                |
| Lines of code in `src/`                                    | ~167,300           |
| Agent route directories under `src/app/api/_agents/`       | 140                |
| Agent registry entries in `src/app/api/agents/registry.ts` | 140                |
| Top-level API directories under `src/app/api/`             | ~50                |
| Library modules in `src/lib/`                              | 148                |
| React components under `src/components/`                   | 119                |
| Database tables in `src/db/schema.ts`                      | 38                 |
| Database migrations in `drizzle/`                          | 21 (0001–0020)     |
| Public-facing pages under `src/app/`                       | ~70 top-level dirs |
| Tests in `src/__tests__/` and co-located                   | 1,241 passing      |

**Headline:** the codebase is large, but it's not bloated. Most of
the surface area is real, used code. The dead-code surface is small —
~5–10% — and concentrated in one cluster (the "advanced AI pipeline"
modules built early in the project that never got wired into the
agent factory).

---

## Agent routes (`src/app/api/_agents/`) — 140 files

**Health: excellent.** Every directory on disk has a matching
registry entry. Zero orphans. Zero broken imports.

**Categorization:**

| Category                       | Count | Examples                                                                           |
| ------------------------------ | ----- | ---------------------------------------------------------------------------------- |
| Vertical packets (cornerstone) | 4     | agency-packet, sourcing-sprint, growth-pulse, listing-pulse                        |
| Lead generation                | ~12   | leads, abm-artillery, ghost-fleet, outbound, prospect-research                     |
| Content generation             | ~14   | blog-gen, ads, email-sequence, organic-content, programmatic-seo, content-machine  |
| Voice / media                  | ~8    | multilingual-voice, asr, voice, music-gen, image-gen, flux-image, cosmos-video     |
| Code / dev                     | ~7    | code-agent, code-reviewer, code-sandbox, computer-use, page-builder                |
| Research / RAG                 | ~6    | deep-search, grounded-search, omni-search, rag-pipeline, research                  |
| Reasoning / strategy           | ~10   | deep-think, claude-think, reasoning-chain, god-brain, war-room                     |
| Safety / guardrails            | ~6    | content-safety, pii-guard, pii-redactor, gliner-pii, compliance-monitor, jailbreak |
| Industry-specific              | ~8    | healthcare-docs, agri-intel, prior-auth, contract-analyzer                         |
| Operations                     | ~12   | scheduler, coordinator, claw-queue, swarm, trigger, pipeline, workflows            |
| Specific NIM models            | ~10   | deepseek-r1, nemotron3-super, nemotron-omni, doc-intel, florence-ocr               |
| Other                          | ~43   | analytics, audit, benchmark, billing, booking, etc.                                |

**Recommendation:** keep all 140. The agent surface is the platform's
actual value proposition. Pruning here is premature optimization — the
catch-all routing means there's no startup or build cost per agent
that isn't called.

---

## Library modules (`src/lib/`) — 148 files

**Three tiers:**

### Tier A — Core infrastructure (~40 modules) · KEEP

Active in the production code path on every request. Examples:

- `agent-factory.ts` — wraps every agent route
- `auth-guard.ts`, `api-guard.ts`, `rbac.ts` — auth on every protected route
- `ai.ts` — unified AI router used by all agent generators
- `plans.ts`, `plan-enforcement.ts`, `paywall.ts`, `payments.ts`, `stripe.ts` — revenue path
- `tenant-resolver.ts`, `tenant-memory.ts` — multi-tenancy
- `circuit-breaker.ts`, `retry.ts`, `rate-limit.ts` — reliability
- `logger.ts`, `crypto.ts`, `nvidia.ts`, `model-prices.ts` — supporting
- `packet-store.ts` — saved packets
- `featured-agents.ts` — registry of curated marketplace slugs
- `playbooks.ts` — playbook engine
- `competitor-registry.ts`, `agent-registry.ts` — content sources
- `safe-clerk-provider.tsx`, `client-portal.tsx` — UI infrastructure

**Action:** none. Keep.

### Tier B — Infra ahead of consumers (~30 modules) · WIRE OR REMOVE THE MARKETING CLAIM

These are working, well-written modules that the platform claims to
use but **nothing actually imports them today**. Either wire them in
(real engineering) or stop claiming the feature on landing.

**Important correction (post-initial audit):** the **5-layer safety
pipeline** claim _is_ shipped — it's wired directly inside
`src/lib/agent-factory.ts` (jailbreak detection at line ~265, content
safety at ~307, PII scan at ~465, quality scoring + retry at ~483,
optional critic via `useCritic` config). Earlier rows in this table
attributed the 5-layer claim to `output-verifier.ts` — that's wrong;
`output-verifier.ts` is a separate "mythos-ready output safety" module
that's genuinely unwired but it does NOT back the 5-layer claim.

**Genuinely unwired marketing claims** (verified post-correction):
PEER Loop · Adversarial Synthesis · Citation Tracking · Knowledge
Graph context · Evolution Engine · Cross-session semantic memory ·
Agent-to-agent economy / swarm protocol · Cost ledger.

| Module                                                           | Marketing claim it backs                                       | Actually wired?                                                                           |
| ---------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `output-verifier.ts`                                             | "Mythos-ready output safety" (separate from the 5-layer claim) | **NO** — never imported (the 5-layer claim is wired in agent-factory.ts itself, not here) |
| `output-refiner.ts`                                              | Output polishing pipeline                                      | **NO**                                                                                    |
| `output-transparency.ts`                                         | "Cite every claim"                                             | **NO**                                                                                    |
| `peer-loop.ts`                                                   | "PEER loop — peers review each other"                          | **NO**                                                                                    |
| `adversarial-synthesis.ts`                                       | "Adversarial multi-agent synthesis"                            | **NO**                                                                                    |
| `citation-engine.ts`                                             | "Citation tracking on every claim"                             | **NO**                                                                                    |
| `swarm-protocol.ts`                                              | "Agent-to-agent economy"                                       | **NO**                                                                                    |
| `context-weaver.ts`                                              | "Knowledge graph context"                                      | **NO**                                                                                    |
| `context-compression.ts`                                         | "Compressed context for long convos"                           | **NO**                                                                                    |
| `semantic-memory.ts`                                             | "Cross-session semantic memory"                                | **NO**                                                                                    |
| `vector-memory.ts`                                               | RAG pipeline                                                   | **YES** — dynamic import in smart-router only                                             |
| `evolution-engine.ts`                                            | "Self-improving agents"                                        | **NO**                                                                                    |
| `self-improve.ts`                                                | "Self-improvement loop"                                        | **NO**                                                                                    |
| `dream.ts`                                                       | "Dream-state planning"                                         | **NO**                                                                                    |
| `model-attribution.ts`                                           | "Show which model wrote this"                                  | **YES** — dynamic in `ai.ts`                                                              |
| `cost-ledger.ts`                                                 | "Per-tenant cost tracking"                                     | **NO**                                                                                    |
| `critic.ts`                                                      | Critic gate in agent factory                                   | **YES** — `useCritic` opt-in                                                              |
| `safety-check.ts`                                                | "Multi-stage safety pipeline"                                  | **NO**                                                                                    |
| `mcp-integrations.ts`, `mcp-tool-generator.ts`                   | "MCP tool ecosystem"                                           | **NO**                                                                                    |
| `solution-templates.ts`                                          | Pre-built playbook templates                                   | **NO**                                                                                    |
| `whatsapp-agent.ts`, `voice-service.ts`, `webhook-dispatcher.ts` | Communication channels                                         | **NO**                                                                                    |
| `factory.ts` (vs `agent-factory.ts`)                             | Older agent factory?                                           | **NO** — likely superseded                                                                |
| `email-sequences.ts`                                             | Email drip backend                                             | **NO** — possibly superseded by route-level logic                                         |
| `crm.ts`                                                         | CRM sync                                                       | **NO** — superseded by `_webhooks/crm/route.ts`                                           |
| `lead-scorer.ts`                                                 | "Lead intent scoring"                                          | **NO**                                                                                    |
| `brand-voice.ts` (lib, not agent)                                | Brand-voice memory                                             | **NO** — agent route exists                                                               |
| `competitor.ts` (lib)                                            | Competitor analysis helpers                                    | **NO** — agent route exists                                                               |
| `slack.ts`                                                       | Slack notifier                                                 | **NO**                                                                                    |
| `pinecone.ts`                                                    | Pinecone vector store                                          | **NO** — `vector-memory.ts` may use Pinecone, but this lib isn't loaded                   |
| `vllm-config.ts`                                                 | vLLM local model config                                        | **NO**                                                                                    |
| `scheduled-tasks.ts`, `scheduler.ts` (lib, not agent)            | Cron internals                                                 | **NO** — superseded by `_cron/` routes                                                    |
| `browser-engine.ts`                                              | Browser-use engine                                             | **NO** — superseded by `computer-use` agent                                               |
| `validation.ts`                                                  | Generic input validation                                       | **NO** — Zod used inline now                                                              |
| `agent-schemas.ts`                                               | Pre-typed agent schemas                                        | **NO**                                                                                    |
| `tenant-scope.ts`                                                | Tenant isolation helper                                        | **NO** — superseded by `tenant-resolver.ts`                                               |
| `error-recovery.ts`                                              | Generic error recovery                                         | **NO**                                                                                    |
| `approval-gate.ts`                                               | Action-tier approval gate                                      | **NO** — superseded by `actionTier` in agent-factory                                      |
| `input-sanitizer.ts`                                             | Input sanitization                                             | **NO** — only test imports it; agents use Zod                                             |
| `budget.ts` (vs `budget-controls.ts`)                            | Older budget enforcement                                       | **NO** — superseded                                                                       |

**Action — three paths:**

1. **Best (3–6 weeks of focused work):** wire `output-verifier`,
   `peer-loop`, `citation-engine` into `agent-factory.ts` as opt-in
   `useVerifier: true` / `usePeerLoop: true` flags. Make the
   "5-layer pipeline" claim _actually true_ for at least the high-
   stakes agents. This is the path to Bar C.

2. **Pragmatic (2 days):** mark every unwired module with a clear
   `// STATUS: ahead of consumers — see docs/audits/codebase-audit.md`
   comment. Update landing copy to match what's actually shipping.
   Don't delete — these are real artifacts that future work will
   wire in.

3. **Aggressive (1 day):** delete the entire Tier B cluster. Recover
   ~5,000 lines. Replace landing claims with claims that match
   shipped reality. Lose the work-already-done.

**Recommendation:** path 2 first (this week). Then path 1 over the
next 90 days as customer feedback comes in. Don't pick path 3 — the
work is good; the only sin is the claim outpacing the wiring.

### Tier C — Truly dead (~5 modules) · DELETE

After exhaustive grep + dynamic-import scan:

- `factory.ts` — superseded by `agent-factory.ts`. Different signature, no path forward.
- `tenant-scope.ts` — superseded by `tenant-resolver.ts`.
- `email-sequences.ts` — superseded by `/api/_agents/email-sequence/route.ts`.
- `validation.ts` — generic Zod-shape helpers; no callers. Replaced by inline Zod schemas everywhere.
- `crm.ts` (the lib, not the webhook) — superseded by `/api/_webhooks/crm/route.ts`.

**Action:** delete in a separate "audit:dead-code-cull" PR after
verifying the build is green without them.

---

## Top-level API routes (`src/app/api/*`) — ~50 directories

### Critical — KEEP and harden

| Route                                              | What it does                                                                                              | Status                                                         |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `/api/agents/[...path]` (catch-all)                | Routes every authenticated agent call to its `_agents/` impl                                              | Production-critical                                            |
| `/api/playbooks/run`                               | Multi-step playbook runner                                                                                | Production-critical                                            |
| `/api/health/ready`                                | Readiness probe — gates Vercel deploys                                                                    | Production-critical                                            |
| `/api/health`                                      | Liveness                                                                                                  | Production-critical                                            |
| `/api/_payments/stripe/webhook`                    | Subscription lifecycle                                                                                    | Revenue-critical                                               |
| `/api/_webhooks/clerk`                             | User lifecycle                                                                                            | Revenue-critical                                               |
| `/api/_webhooks/crm`                               | HubSpot deal-closed automation                                                                            | Revenue-critical                                               |
| `/api/_webhooks/calcom`                            | Cal.com booking sync                                                                                      | Revenue-critical                                               |
| `/api/credits`                                     | Credit grant + Stripe verification                                                                        | Revenue-critical                                               |
| `/api/payments/yoco/checkout`, `/payfast/checkout` | ZAR rails                                                                                                 | Revenue-critical                                               |
| `/api/v1/[...path]`                                | Public API gateway                                                                                        | Developer-facing                                               |
| `/api/free/run`                                    | IP-rate-limited free-tool proxy                                                                           | Funnel-critical                                                |
| `/api/og`                                          | Dynamic OG images                                                                                         | Just shipped — keep                                            |
| `/api/packets` + `/api/packets/[id]`               | Saved-packet CRUD                                                                                         | Just shipped — keep                                            |
| `/api/case-studies`                                | Public case study list                                                                                    | Marketing-critical                                             |
| `/api/leads`                                       | Public lead capture                                                                                       | Funnel-critical                                                |
| `/api/keys`                                        | API key management for developer-tier                                                                     | Keep                                                           |
| `/api/admin/*`                                     | Admin tools                                                                                               | Operator-critical                                              |
| `/api/ai`, `/api/nim`                              | AI streaming                                                                                              | Production-critical                                            |
| `/api/research`                                    | Streaming research                                                                                        | Production-critical                                            |
| `/api/cron/*`                                      | Scheduled jobs (daily-digest, cleanup, job-runner, playbook-scheduler, weekly-report)                     | Operator-critical                                              |
| `/api/_cron/*`                                     | Internal cron wrappers (content-publisher, ghost-fleet, onboarding-drip, tiktok-autopilot, weekly-report) | Operator-critical                                              |
| `/api/mcp`                                         | Model Context Protocol endpoint                                                                           | Developer-facing — keep, the MCP play is a real differentiator |
| `/api/_misc/*`                                     | Catch-all for niche routes (api keys, admin, scheduled runs)                                              | Keep, low risk                                                 |

### Useful — KEEP, monitor for usage

| Route                                                                     | What it does                                                         |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `/api/jobs`                                                               | Async job queue API                                                  |
| `/api/scheduled-workflows`                                                | Recurring workflow CRUD                                              |
| `/api/sequences`                                                          | Email sequence CRUD                                                  |
| `/api/workflows`                                                          | Workflow CRUD                                                        |
| `/api/usage`                                                              | Usage / quota lookup                                                 |
| `/api/user/plan`                                                          | Current plan info                                                    |
| `/api/marketplace`                                                        | Marketplace listing API                                              |
| `/api/_payments/stripe/*`                                                 | Billing (portal/invoices/webhook; `/api/billing` retired wave 122.1) |
| `/api/data-export`                                                        | POPIA / GDPR export skeleton                                         |
| `/api/portal/metrics`                                                     | Whitelabel client portal metrics                                     |
| `/api/voice`                                                              | TTS for landing                                                      |
| `/api/founders`, `/api/waitlist`, `/api/referrals`, `/api/referral/apply` | Marketing flows                                                      |

### Aliases / re-exports — KEEP (low cost) or COLLAPSE

| Route                                       | Status                                                                                        |
| ------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `/api/projects` → re-exports `/api/clients` | Intentional alias (commented). Keep — collapsing breaks any frontend hitting `/api/projects`. |
| `/api/api-catalog` → ~self-documenting      | Keep                                                                                          |
| `/api/demo` → re-exports `/api/_misc/demo`  | Verify and consolidate if unused                                                              |
| `/api/[...catchall]` (mega catch-all)       | The "anything else" fallback. Verify it doesn't shadow legitimate routes; otherwise keep.     |

### Empty / suspect — INVESTIGATE

| Route                                                                                | Status                                                                                                      |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `/api/_settings/`, `/api/settings/`, `/api/_health/mcp/`, `/api/_health/nim-models/` | Some only have nested dirs, no `route.ts` at the top. Inspect each for whether nested routes are reachable. |

---

## Database tables — 38

All 38 are referenced from production code paths (auth, billing,
agents, packets, etc.). **No orphan tables.** Migration parity check
in CI verifies this on every commit.

**Pending:** migrations 0002–0020 need to be applied in Neon. See
`docs/runbooks/launch-checklist.md` Phase 1.

---

## Components (`src/components/`) — 119 files

Spot-check (full audit deferred):

- **`src/components/landing/`** (~10 files) — all referenced from
  `src/app/page.tsx`. Active.
- **`src/components/cinematic/`** (~12 files) — visual effects.
  `ScrollRevealHero`, `StackKiller`, `MemoryMoatVisual` referenced
  from landing. Some unused — needs spot-check.
- **`src/components/ui/`** (~30 files) — shared atoms.
  `EliteEffects`, `SovereignLogo`, `ScrollAnimations`, `TiltCard`,
  `ClientOnlyEffects` all imported. Most active.
- **`src/components/dashboard/`** (~20 files) — `NotificationBell`,
  `CheckoutSuccess`, `Sidebar` etc. Active.
- **`src/components/pricing/`**, `seo/`, `safety/` — small, focused.

**Action:** no immediate cuts. Component-level audit can wait until
the next scoped sprint.

---

## Pages (`src/app/`) — ~70 top-level

### Marketing — KEEP

`/` (landing), `/pricing`, `/playbooks` (index), `/playbooks/<vertical>` (4),
`/anthropic`, `/now`, `/case-studies`, `/about`, `/blog`, `/changelog`,
`/contact`, `/docs`, `/marketplace`, `/showcase`, `/free/<tool>` (3),
`/vs/<competitor>` (16+).

### Vertical sector pages — KEEP

`/for-agencies`, `/for-recruiting`, `/for-realestate`, `/for-healthcare`,
`/for-legal`, `/for-fintech`, `/for-ecommerce`, `/for-education`,
`/for-cybersecurity`, `/for-government`, `/for-agriculture`,
`/for-manufacturing`. Each is real SEO surface.

### Auth / dashboard — KEEP

`/login`, `/signup`, `/dashboard/*` (~70 sub-pages).

**Note on dashboard sub-pages:** ~70 sub-routes is excessive.
Many (`audit-destroy`, `morpheus-shield`, `cyber-audit`, `god-eye`,
`ghost-protocol`, etc.) are vertical-themed feature pages that may
or may not back real workflows. **Audit each at the next sprint —
deletion target is probably 15–25 of them.** Not in this audit's
scope.

### Special — KEEP

`/portal/[clientId]/*` and `/wl/[domain]/*` — whitelabel surfaces.
Production-critical for agency reseller flow.

---

## Honest cut proposal

### Tier 1 — execute now (this PR or the next one)

- **Delete 5 superseded lib modules** (Tier C):
  `factory.ts`, `tenant-scope.ts`, `email-sequences.ts`,
  `validation.ts`, `crm.ts`. ~600 lines saved. Build still green.
- **Mark Tier B unwired modules** with a `STATUS: ahead-of-consumers`
  header comment so future contributors don't accidentally re-implement.
- **Fix the wording** on the landing — "5-layer output verifier" should
  read as a roadmap commitment until `output-verifier.ts` is wired.

### Tier 2 — execute after first 10 paying customers

- **Wire output-verifier into agent-factory** as `useVerifier: true`
  opt-in. Test on the four vertical packets first.
- **Wire peer-loop into the deep-think agent** for high-stakes
  reasoning runs.
- **Wire citation-engine into research agents** so citations land in
  the saved packet.
- **Audit dashboard sub-pages.** Keep the ~30 that real customers use,
  delete the rest.

### Tier 3 — execute when substantial customer feedback exists

- **Component-level audit** (119 files) — likely 20–30 dead.
- **Decide on the unwired Tier B cluster** (`evolution-engine`,
  `dream`, `swarm-protocol`, `solution-templates`, etc.) — keep or
  cut based on whether the related claim made it to v3 product
  positioning.
- **API route consolidation** — collapse aliases that no longer have
  callers.

---

## What this audit explicitly does NOT recommend

- **Wholesale deletion of "unused" lib modules.** They are good code.
  Most exist because the founder built infrastructure faster than the
  consumer routes could be wired. The right move is to wire them, not
  delete them.
- **Pruning agent routes.** All 140 are registered. The catch-all
  routing means there's no per-agent build cost. Prune only when
  customer telemetry shows specific agents are unused.
- **Deleting "stub" dashboard pages without verifying.** Some look
  thin but back real flows. Audit individually before cutting.

---

## Bottom line

The codebase is **bigger than it needs to be by ~5–10%**, but the
real issue isn't dead code — it's **infrastructure ahead of
consumers**. The 5,000 lines of unwired safety / verification /
agent-economy modules represent ~3 weeks of focused integration work
that turns marketing claims into shipped reality. That's the highest-
leverage cleanup, not deletion.

For Bar A launch, the audit recommends **zero blocking cuts**. For
Bar B, the wiring of `output-verifier` is the only one that materially
changes what visitors experience. Everything else is internal hygiene
that can wait.
