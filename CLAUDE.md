# The Sovereign Matrix Codebase Guide

Welcome to the Sovereign Matrix repository. This file is the core instruction manual for the **Claude Code CLI** or any Anthropic agent operating within this directory. Read it before making changes — every section encodes a real production gotcha or a convention enforced across the codebase.

## Architecture Stack

- **Framework**: Next.js 16.1.6 (App Router) + React 19.2.3
- **Compiler**: Turbopack (`npm run dev`)
- **Language**: TypeScript 5.9 (`.tsx`, `.ts`)
- **Styling**: Tailwind CSS v4, Framer Motion (animations), Lucide React (icons)
- **Database**: PostgreSQL via Neon Serverless (`@neondatabase/serverless`)
- **ORM**: Drizzle ORM (`src/db`) + drizzle-kit migrations
- **Authentication**: Clerk (`@clerk/nextjs` v7)
- **Payments**: Stripe (Yoco-branded in user-facing UI)
- **AI SDKs**: `@anthropic-ai/sdk`, `@google/generative-ai`, `@ai-sdk/google`, `@ai-sdk/google-vertex`, `groq-sdk`, plus the unified Vercel `ai` SDK
- **Vector / RAG**: Pinecone (`@pinecone-database/pinecone`) + in-DB embeddings (JSON 1024-dim float32)
- **Observability**: Sentry (`@sentry/nextjs` — client/edge/server configs at repo root)
- **Realtime**: WebSocket server (`server/ws.ts`) + Vercel SSE streams
- **Rate limiting**: Upstash Redis (`@upstash/ratelimit`, `@upstash/redis`)
- **Testing**: Vitest (unit) + Playwright (e2e in `e2e/`)

## Repository Layout

```
src/
  app/                  Next.js App Router (164 page.tsx files, 54 API folders)
    api/
      _agents/          135 internal agent routes (canonical home)
      agents/[...slug]/ Public catch-all → dispatches to _agents via registry.ts
      _payments/        Stripe checkout + webhook
      _webhooks/        Inbound webhooks (Clerk, HubSpot, Cal.com, Twilio, …)
      _content/, _email/, _cron/, _settings/, _integrations/, _misc/, _health/
      admin/, billing/, leads/, marketplace/, voice/, workflows/, …
    portal/             White-label client portal (rewritten from /client/:id)
    dashboard/, onboarding/, pricing/, login/, signup/, …
    for-{vertical}/     Vertical landing pages (legal, fintech, healthcare, …)
    error.tsx, global-error.tsx, not-found.tsx, layout.tsx
  agents/               High-level orchestrator agents (closer, prospector, war-room, …)
  components/           UI components: 3d, artifacts, canvas, chat, cinematic, dashboard,
                        landing, onboarding, providers, seo, ui + JarvisSocket.tsx
  config/               models.ts, theme.ts
  db/                   schema.ts (42 tables) + index
  hooks/                React hooks: useFocusTrap, useInterval, useLazyLoad,
                        useLiveAgentCount, useUsage
  lib/                  139 modules — security, AI routing, multi-tenancy, revenue, etc.
    agents/             governor.ts, memory-router.ts
    graph/              graph-writer, hybrid-retriever, relationship-extractor
    hooks/              motion-aware client hooks
    integrations/       connector-factory + connector
  sdk/                  Public TypeScript SDK (index.ts, types.ts, README.md)
  types/                index.ts (shared types) + web-speech.d.ts
  __tests__/            Vitest suites
  instrumentation.ts    Sentry instrumentation
  proxy.ts              Edge proxy

server/
  ws.ts                 WebSocket server (npm run ws)
  python-agents/        Standalone Python agents (deep_research, telegram_closer,
                        nemoclaw_os, …) — NOT bundled in Next.js
  pdf-generator/        PDF generation service
  n8n/                  n8n workflow automation configs

drizzle/                SQL migrations (0000-0004, 0016, 0017)
e2e/                    Playwright specs
mcp-server/             Custom MCP server (TypeScript, exposes sovereign_run_agent etc.)
chrome-extension/       Browser extension shell
mobile/                 Mobile shell
scripts/                CLI helpers (war_room_stream.py, import_n8n_workflows.sh, …)
.claude/                Agents, skills, settings (hooks, plugins)
.github/                GH Actions / templates
public/                 Static assets
```

## Core Agent Intelligence Nodes (`src/app/api/_agents/`)

The platform leverages multiple specialized LLMs (Google Gemini, Anthropic Claude, NVIDIA NIM, Cerebras, Groq, local Ollama) connected via a single unified AI router at `src/lib/ai.ts`.

**Routing pattern:**

- Public requests hit `src/app/api/agents/[...slug]/route.ts`
- That dispatcher imports `src/app/api/agents/registry.ts` (auto-generated, 137 entries)
- The registry resolves the slug to an internal `src/app/api/_agents/<slug>/route.ts` module
- Internal routes use the `createAgentRoute` factory for shared auth, rate-limit, plan-enforcement, audit logging, and tenant scoping

**Why this layout:** Vercel's serverless packer cannot trace dynamic `import()` with `webpackIgnore`. The static registry guarantees every agent is bundled. **All catch-all routes must use static imports** — never reintroduce `dynamic()` here.

Notable agents:

- `god-brain` — Master meta-prompter and architect
- `war-room` — Multi-agent debate arena for synthesis
- `computer-use` — Native Claude 3.5 Sonnet browser/bash controller
- `image-gen` / `flux-image` / `imagen` / `cosmos-video` / `video-gen` — Visual generation
- `smart-router` — Routes tasks to best open-source model based on registry
- `consensus` chain — Used internally by `verifiedAi()` (generate → critique → revise)
- `swarm`, `orchestrate`, `orchestrator`, `coordinator` — Multi-agent flows
- `nemoclaw`, `nemotron-omni`, `nemotron3-super`, `deepseek-r1` — NIM-hosted reasoning
- `voice`, `voice-closer`, `voice-chat`, `voice-synth`, `multilingual-voice` — Audio
- `closer`, `outbound`, `email-sequence`, `lead-scorer`, `seo-dominator` — Revenue ops
- `pii-guard`, `gliner-pii`, `content-safety`, `compliance-monitor`, `threat-hunt` — Safety

Total: **137 registered agents, 135 implementation directories** (the registry comment is the source of truth — regenerate via `scripts/generate-agent-registry.mjs` when adding agents; do NOT hand-edit `registry.ts`).

## Important Commands

| Task                         | Command                                                  |
| ---------------------------- | -------------------------------------------------------- |
| Development server           | `npm run dev`                                            |
| Production build             | `npm run build`                                          |
| Production start             | `npm run start`                                          |
| Unit tests                   | `npm run test` (vitest)                                  |
| Lint                         | `npm run lint`                                           |
| WebSocket server             | `npm run ws` (`ts-node server/ws.ts`)                    |
| E2E tests                    | `npx playwright test`                                    |
| Drizzle migration generation | `npx drizzle-kit generate`                               |
| Run migration in prod        | Paste SQL into Neon Console → SQL Editor                 |
| Reinstall                    | `rm -rf node_modules && npm install`                     |
| Build with extra memory      | `NODE_OPTIONS='--max-old-space-size=8192' npm run build` |

Node engine: `>=18.0.0 <=22.x`.

## Formatting & Design Protocols

1. **Dark Mode First** — System uses high-end dark aesthetics: `bg-[#030303]`, `text-neutral-200`, generous black/near-black backgrounds.
2. **No external component libraries** — No shadcn, MUI, Radix, etc. unless absolutely necessary. Build natively with Tailwind + heavy glassmorphism (`backdrop-blur-xl`, `bg-white/5`, `border-white/10`).
3. **Animations** — Use `framer-motion` for micro-interactions. New UI elements need fluid enter/exit states wired through `AnimatePresence`. Respect `prefers-reduced-motion`.
4. **Mobile-aware** — Cinematic effects (Three.js, WebGL canvas, springy physics) auto-disable on mobile. Use the `useIsMobile` and `useReducedMotion` hooks in `src/lib/hooks/`.
5. **No emojis in code** — Avoid emojis in source unless explicitly requested.

_You are operating as a Sovereign Node. Execute all tasks defensively and accurately._

## Critical Patterns & Gotchas

### Build & Deploy

- **NEVER** use `vercel build && vercel deploy --prebuilt` — use GitHub-native deploys (Vercel builds from source).
- `serverExternalPackages` in `next.config.ts`: `@pinecone-database/pinecone`, `twilio`, `drizzle-orm`, `@neondatabase/serverless`. Add new Node-only packages here when you import them.
- Full CSP configured in `next.config.ts → headers()` — update `script-src`/`frame-src`/`connect-src` when adding new external scripts, frames, or websockets.
- White-label rewrites: `/client/:id/:path*` → `/portal/:clientId/:path*`, `/wl/:domain/:path*` → `/portal/d/:domain/:path*`, `/wl/:domain` → `/portal/d/:domain`.
- `output: "standalone"` activates only when `process.env.VERCEL` is unset (i.e., Docker/Railway).
- Security headers active: HSTS (`max-age=63072000; includeSubDomains; preload`), X-Frame-Options DENY, X-Content-Type-Options nosniff, strict-origin-when-cross-origin referrer, permissions-policy `camera=(), microphone=(), geolocation=(self)`.
- `experimental.prerenderEarlyExit: false` — prevents `_global-error` prerender crash from aborting the build (Next.js 16 + React 19).
- `typescript: { ignoreBuildErrors: true }` is intentional — legacy agent routes have pre-existing TS errors.
- Static agent registry (`src/app/api/agents/registry.ts`) is required for Vercel — dynamic `import()` with `webpackIgnore` does not work on serverless.
- All catch-all routes use static imports (not dynamic) for Vercel bundling.
- Turbopack stale-module bug: new files imported via `dynamic()` cause HMR errors — use static imports for new client components.

### SSR / Client Components

- `ClerkProvider` must be lazy-loaded (`dynamic(..., { ssr: false })`) inside a `"use client"` wrapper — crashes during static prerendering otherwise.
- Browser-only components (`framer-motion`'s `useSpring`, canvas, WebGL) must use the `ClientOnlyEffects` wrapper — NOT direct imports in server components.
- `next/dynamic` with `ssr: false` is **not allowed in server components** in Next.js 16 — must wrap in a `"use client"` component first.
- All cinematic effects respect `prefers-reduced-motion` and auto-disable on mobile.

### Database

- All API routes handle missing-table errors gracefully (PostgreSQL error code `42P01`) — return empty arrays or 503, never crash.
- Drizzle schema is the source of truth: `src/db/schema.ts` (42 tables, listed below).
- Migrations live in `drizzle/` — generated via `npx drizzle-kit generate`, applied manually in Neon Console SQL Editor.
- Tables that exist locally but may be missing in some environments: `async_jobs`, `playbook_runs`, `playbook_run_steps`, `graph_nodes`, `graph_edges`, `affiliates`, `referrals`, `audit_logs`, `marketplace_agents` monetisation columns, `tenant_memories` semantic columns, `user_credits`. The `db-migrate` skill walks through generation + Neon application.

### Revenue Pipeline

- `src/lib/plans.ts` is the single source of truth for pricing: `free=50, starter=200, founder=10K, array=500, node=2K, enterprise=10K` runs/month.
- `src/lib/plan-enforcement.ts` reads from `subscriptions` table → falls back to founder list → falls back to free.
- Stripe webhook at `/api/_payments/stripe/webhook` handles full lifecycle: `checkout.session.completed`, `subscription.updated`, `subscription.deleted`, `invoice.payment_failed`. Idempotency via `stripe_events` table + `src/lib/idempotency.ts`.
- Checkout flow: `Pricing.tsx` → `/api/payments/stripe/checkout` → Stripe Checkout → webhook → `subscriptions` table → plan-enforcement reads it.
- Marketplace monetization (`drizzle/0016_marketplace_monetize.sql`): per-agent pricing in cents, Stripe Connect for creator payouts, 70/30 revenue split, verification pipeline (`pending → in_review → verified | rejected | suspended`).
- Credits & A2E economy (`drizzle/0017_semantic_memory.sql` second half): `user_credits` ledger powers metered, agent-to-agent transactions.
- Model names must include version suffix (e.g., `nemotron-ultra-253b-v1`, not `253b`).
- User-facing copy says "Yoco" not "Stripe" — but the underlying processor is Stripe. Keep the API/code names as `stripe.*`.

### Key Architecture

- **Unified AI router**: `src/lib/ai.ts` — single entry point for all AI calls, 39+ models across 8 providers, with circuit breakers (`src/lib/circuit-breaker.ts`) and retry (`src/lib/retry.ts`).
- **Routing priority**: Ollama (local, $0) → Cerebras (fastest) → NVIDIA NIM (free open-source) → Gemini (default) → Claude (BYOK or global key, only when explicitly selected).
- **AI options**: `AIOptions` in `src/types/index.ts` — supports `thinking` (Claude Extended Thinking), `useOpus` (Opus 4.6 max-reasoning), `useGeminiPro` (Gemini 2.5 Pro on AI Ultra), `taskType` (`content | analysis | code | sales`).
- **Consensus engine**: `src/lib/consensus.ts` — `verifiedAi()` uses generate → critique → revise with two different models.
- **5-layer output verifier**: LlamaGuard + PII (`gliner-pii`) + content policy + quality (`quality-scorer`) + trust gate, run in parallel via `src/lib/output-verifier.ts`.
- **Output refinement**: `src/lib/output-refiner.ts` cleans formatting, removes AI slop ("paradigm", "cutting-edge", "world-class"), ensures category-aware tone.
- **Onboarding** persists to both localStorage (immediate UX) and DB via `/api/user/onboarding` (durable).
- **Goal → Playbook mapping**: `leads → lead-blitz`, `content → content-machine`, `compete → competitor-takedown`. See `src/lib/playbooks.ts`.
- **User API keys** stored encrypted in `settings.api_keys` JSON — `src/lib/crypto.ts → safeDecrypt` handles legacy unencrypted values gracefully.
- **Semantic memory**: `tenant_memories` carries 1024-dim float32 embeddings as JSON text (works without pgvector). Importance score, memory type, source agent, and session id are indexed for retrieval. See `src/lib/semantic-memory.ts` and `src/lib/vector-memory.ts`.
- **Graph memory**: `graph_nodes` + `graph_edges` plus `src/lib/graph/` (graph-writer, hybrid-retriever, relationship-extractor) provide entity-relationship recall alongside vectors.

### Lib Architecture (`src/lib/` — 139 modules + 4 subfolders)

- **Security**: `auth-guard.ts`, `api-guard.ts`, `input-sanitizer.ts`, `jailbreak-detect.ts`, `content-safety.ts`, `nemo-guardrails.ts`, `safe-clerk.ts`, `safety-check.ts`, `rbac.ts`, `crypto.ts`, `encryption.ts`
- **Reliability**: `circuit-breaker.ts`, `retry.ts`, `error-recovery.ts`, `error-reporter.ts`, `rate-limit.ts` (Upstash), `cache.ts`, `idempotency.ts`
- **Output pipeline**: `output-verifier.ts` (5-layer), `output-refiner.ts`, `output-refiner-client.ts`, `output-refiner-types.ts`, `output-transparency.ts`, `quality-scorer.ts`, `ai-detect.ts`
- **Multi-tenant**: `tenant-resolver.ts`, `tenant-scope.ts`, `tenant-memory.ts`, `clients.ts`, `agent-auth.ts`
- **Revenue**: `plans.ts`, `plan-enforcement.ts`, `stripe.ts`, `payments.ts`, `paywall.ts`, `budget-controls.ts`, `budget.ts`, `free-tier.ts`, `referral-system.ts`
- **Agent framework**: `agent-factory.ts`, `factory.ts`, `agent-memory.ts`, `agent-teams.ts`, `agent-circuit-breaker.ts`, `agent-performance.ts`, `agent-reliability.ts`, `agent-replay.ts`, `agent-schemas.ts`, `swarm.ts`, `swarm-protocol.ts`, `peer-loop.ts`, `playbooks.ts`, `goal-executor.ts`, `intent-router.ts`, `evolution-engine.ts`, `self-improve.ts`
- **Memory & RAG**: `memory.ts`, `semantic-memory.ts`, `vector-memory.ts`, `pinecone.ts`, `context-compression.ts`, `context-weaver.ts`, `tool-search.ts`
- **Integrations**: `email-service.ts`, `email.ts`, `email-sequences.ts`, `onboarding-emails.ts`, `slack.ts`, `telegram.ts`, `whatsapp-agent.ts`, `voice-service.ts`, `elevenlabs.ts`, `webhooks.ts`, `webhook-dispatcher.ts`, `oauth-connections` (via schema), `nvidia.ts`, `ollama.ts`, `vllm-config.ts`, `mcp-integrations.ts`, `mcp-tool-generator.ts`, `anthropic-mcp.ts`, `claude-ecosystem.ts`, `colab-mcp.ts`
- **Workflow & scheduling**: `scheduler.ts`, `scheduled-tasks.ts`, `workflow-templates.ts`, `solution-templates.ts`, `cron-auth.ts`, `events.ts`, `notifications.ts`, `notify.ts`, `persist.ts`, `activity-persist.ts`
- **Search & enrichment**: `deep-search.ts`, `enrichment.ts`, `competitor.ts`, `competitive-moat.ts`, `lead-scorer.ts`, `crm.ts`, `citation-engine.ts`, `citation-tracker.ts`, `brand-voice.ts`, `content-engine.ts`
- **Approvals & policy**: `hitl-approval.ts`, `approval-gate.ts`, `policy-engine.ts`, `audit-log.ts`, `execution-audit.ts`, `trust-levels.ts`
- **Routing & registry**: `llm-router.ts`, `model-discovery.ts`, `model-tracker.ts`, `system-prompts.ts`, `cta-track.ts`, `analytics.ts`, `api-logger.ts`, `logger.ts`, `dream.ts`, `a2e.ts`, `action-tiers.ts`
- **Validation & env**: `validation.ts`, `env-check.ts`, `env.validated.ts`, `constants.ts`, `base-url.ts`
- **Subfolders**: `agents/` (governor, memory-router), `graph/` (writer, retriever, extractor), `hooks/` (motion-aware), `integrations/` (connector-factory, connector)

### Database Schema (42 tables in `src/db/schema.ts`)

- **Core**: `tenants`, `users`, `settings`, `organizations`, `org_members`, `oauth_connections`
- **AI**: `generations`, `conversations`, `chat_messages`, `agent_activity`, `jobs`, `active_swarms`, `global_telemetry`
- **Revenue**: `subscriptions`, `stripe_events`, `payments`, `usage`, `api_keys`
- **Content**: `scheduled_content`, `email_sequences`, `sequence_steps`, `ad_creatives`, `case_studies`
- **CRM**: `leads`, `voice_calls`, `bookings`, `client_projects`
- **Marketplace**: `marketplace_agents` (monetisation + verification cols added in 0016), `custom_skills`
- **Memory**: `tenant_memories` (semantic embeddings + importance + type cols added in 0017), `graph_nodes`, `graph_edges`
- **Operations**: `playbook_runs`, `playbook_run_steps`, `scheduled_runs`, `workflows`
- **Audit**: `audit_logs`, `error_logs`
- **Growth**: `affiliates`, `referrals`, `cta_clicks`
- **White-label**: `whitelabel_config`

### Migrations

| File                            | Purpose                                                                 |
| ------------------------------- | ----------------------------------------------------------------------- |
| `0000_organic_celestials.sql`   | Initial schema                                                          |
| `0001_aromatic_cloak.sql`       | Schema rev                                                              |
| `0002_async_jobs.sql`           | Async job queue                                                         |
| `0003_playbook_runs.sql`        | Playbook execution tracking                                             |
| `0004_remaining_tables.sql`     | Graph memory, affiliates, audit logs, workflows, tenant onboarding cols |
| `0016_marketplace_monetize.sql` | Marketplace pricing, Stripe Connect, verification pipeline              |
| `0017_semantic_memory.sql`      | Embeddings on `tenant_memories` + `user_credits` (A2E economy)          |

Use the `/db-migrate` skill to generate + review + apply.

### Server Components (`server/`)

- `ws.ts` — WebSocket server for real-time agent communication (`npm run ws`)
- `python-agents/` — Standalone Python agents (deep_research, telegram_closer, nemoclaw_os, …) — NOT bundled in Next.js
- `pdf-generator/` — PDF generation service
- `n8n/` — n8n workflow automation configs
- `Dockerfile` (server-side) — for self-hosted deployments

### Public SDK (`src/sdk/`)

The TypeScript SDK exposes the agent platform to external consumers (`index.ts`, `types.ts`). Treat it as public API: any change is breaking unless additive. README inside the directory documents usage.

### Claude Code Infrastructure

- **MCP servers** (`.mcp.json`):
  - `sovereign-matrix` — custom server (`mcp-server/dist/index.js`) exposing `sovereign_run_agent`, `sovereign_run_playbook`, `sovereign_health`, `sovereign_api_catalog` against production at `https://sovereignmatrix.agency`
  - `context7` — live library API docs (Drizzle, Clerk, Stripe, Vercel AI SDK, …) — use it instead of guessing signatures
  - `sentry` — Sentry MCP server for error/issue lookup
  - `playwright` — Browser automation
- **Agents** (`.claude/agents/`):
  - `sovereign-optimizer` — Broad quality / production-readiness sweeps
  - `design-slop-blocker` — UI review against AI slop patterns
  - `security-reviewer` — API/auth/payment audits, triggers automatically on API route changes
  - `ai-cost-auditor` — Flags expensive Claude/Gemini calls that could route to Ollama/Cerebras/NIM
- **Skills** (`.claude/skills/`):
  - `/deploy-check` — Pre-push verification gate (catches the 6 build gotchas)
  - `/security-check` — Regression tests + security-reviewer agent on diff
  - `/new-api-route` — Scaffolds an API route with auth + rate-limit + 42P01 handling + logging
  - `/db-migrate` — Drizzle generate → review → Neon Console workflow
  - `/ship` — Full dev → prod pipeline with security gate (user-invoked only)
- **Hooks** (`.claude/settings.json`):
  - PreToolUse blocks `.env*`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml` edits (exit 2 — must edit manually)
  - PostToolUse auto-formats `.ts`/`.tsx`/`.js`/`.jsx`/`.json`/`.md`/`.css` via Prettier
  - Do NOT override or duplicate these hooks
- **Plugins enabled**: `context7@claude-plugins-official`, `figma@claude-plugins-official`
- **Env config** in `.env.local` (see `.env.example` for the 30+ keys: AI providers, Stripe, Clerk, Twilio, ElevenLabs, Sentry, Upstash, Pinecone, Tavily, …)

### Webhooks & Cron

- All cron endpoints under `src/app/api/_cron/` and `src/app/api/cron/` validate `CRON_SECRET` (see `src/lib/cron-auth.ts`).
- Inbound webhooks under `src/app/api/_webhooks/` verify provider signatures: HubSpot v3 HMAC-SHA256, Cal.com HMAC, Twilio signature with XML-escaped TwiML, Stripe via `stripe.webhooks.constructEvent`, Clerk via `svix` headers.
- Webhook idempotency via `src/lib/idempotency.ts` + `stripe_events` table.

### Pending Manual Steps

- Run any unapplied migrations in **Neon Console → SQL Editor** (verify by querying `information_schema.tables`).
- Set up Stripe webhook endpoint in Stripe Dashboard → `/api/_payments/stripe/webhook`.
- Add Stripe price IDs: `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_ARRAY`, `STRIPE_PRICE_NODE`, `STRIPE_PRICE_ENTERPRISE`.
- Set up Clerk webhook endpoint → `/api/webhooks/clerk` (welcome emails + tenant creation).
- Add `CLERK_WEBHOOK_SECRET` env var from Clerk Dashboard → Webhooks.
- Configure Sentry DSN (client/edge/server configs already present at repo root).
- Set `CRON_SECRET` and configure Vercel cron (`vercel.json`) to hit `_cron/*` routes.

## Working Conventions for Claude

1. **Don't half-build.** A bug fix doesn't need surrounding cleanup; a one-shot doesn't need a helper. Three similar lines beat a premature abstraction. Finish what you start, including commits if asked.
2. **Don't add comments that explain WHAT** — names should do that. Only write a comment for non-obvious WHY (hidden constraint, subtle invariant, workaround). Never reference issue numbers, callers, or the current task.
3. **Edit existing files** rather than creating new ones. Never create `*.md` docs unless explicitly asked.
4. **Trust internal code and framework guarantees** — only validate at boundaries (user input, external APIs).
5. **Test the UI in a browser** for any frontend change. Type checking ≠ feature correctness.
6. **Follow the registry pattern** when adding agents — implementation in `_agents/<slug>/`, then re-run the registry generator. Don't hand-edit `registry.ts`.
7. **Run `/deploy-check` before any push to main**, `/security-check` whenever touching auth/payment/webhook code.
