# Sovereign Matrix

The repository for [sovereignmatrix.agency](https://sovereignmatrix.agency) —
a managed-service B2B lead-generation engine sold as a flat-fee subscription
with a refund-no-friction guarantee, backed by a Next.js 16 + Postgres
platform with 137+ AI agents, multi-provider routing, and a six-layer
output safety pipeline.

Engineering-first. If you're looking for marketing copy, see the live site.

---

## What this codebase actually is

| Layer         | Tech                                                                                          |
| ------------- | --------------------------------------------------------------------------------------------- |
| Framework     | Next.js 16 (App Router) + React 19 + TypeScript                                               |
| Compiler      | Turbopack (`npm run dev`)                                                                     |
| Styling       | Tailwind v4, Framer Motion, Lucide React — no third-party UI kit                              |
| Database      | Neon Postgres (serverless) via Drizzle ORM                                                    |
| Auth          | Clerk                                                                                         |
| Inference     | NVIDIA NIM (default, $0), Anthropic, Google, Groq, Cerebras, Mistral, Ollama, Portkey gateway |
| Observability | Sentry, Phoenix (Apache 2.0 OTLP/HTTP self-hosted), Vercel logs                               |
| Payments      | PayPal, Yoco, PayFast, Paystack, Stripe (dormant)                                             |
| Tests         | Vitest                                                                                        |
| CI            | GitHub Actions (`.github/workflows/ci.yml`)                                                   |

Three deployment profiles per tenant (`tenants.deployment_profile`):

- **`cloud`** — default. NIM API + paid fallbacks. Fastest to deploy.
- **`byo-gpu`** — inference pinned to customer's vLLM/SGLang container at
  `NIM_LOCAL_BASE_URL`. External paid providers refuse to fire.
- **`air-gapped`** — Ollama + on-prem NIM only. Zero outbound inference.

Plus a tenant kill-switch (`tenants.is_suspended`) that returns 423 Locked
to every authenticated agent endpoint without deleting state.

## Repository layout

```
src/
├── app/                       # Next.js routes
│   ├── api/
│   │   ├── _agents/           # 137+ agent endpoints (createAgentRoute factory)
│   │   ├── _admin/            # operator-only endpoints (Clerk userId allowlist)
│   │   ├── _payments/         # PayPal / Yoco / PayFast / Paystack / Stripe
│   │   ├── _webhooks/         # signed inbound: Cal.com, Twilio, Telegram, ...
│   │   ├── _cron/             # scheduled jobs (error-watcher, standards-check, ...)
│   │   ├── proof/stats/       # public delivery receipt
│   │   └── health/            # /api/health (never returns 5xx)
│   ├── admin/                 # operator console
│   │   ├── customers/         # weekly delivery dashboard
│   │   ├── tenants/           # deployment profile + kill-switch UI
│   │   ├── health/            # live /api/health dashboard
│   │   └── letters/new/       # Friday Letter publisher
│   ├── standards/             # /standards — public trust artifact
│   ├── proof/                 # /proof — public delivery numbers
│   ├── letters/               # /letters — Friday cadence archive
│   ├── status/                # /status — public uptime page
│   ├── welcome/[id]/          # 60-second customer onboarding
│   └── portal/[clientId]/     # white-label client portal
├── lib/                       # 120+ modules
│   ├── ai.ts                  # unified router across 9 providers
│   ├── nim-registry.ts        # 11 NVIDIA NIM models, single source of truth
│   ├── deployment-profile.ts  # cloud / byo-gpu / air-gapped allow-list
│   ├── tenant-suspension.ts   # kill-switch read path (30s cache)
│   ├── request-tenant.ts      # AsyncLocalStorage tenant context
│   ├── idempotency.ts         # 3-tier dedupe (Redis → Postgres → memory)
│   ├── output-verifier.ts     # 6-layer safety: LlamaGuard + PII + content + quality + trust + LlamaFirewall
│   ├── phoenix-tracer.ts      # OTLP/HTTP exporter for AI calls
│   ├── portkey-gateway.ts     # MIT gateway for paid-provider failover
│   └── ...
├── db/
│   └── schema.ts              # 38+ Drizzle tables, source of truth
├── components/
│   └── landing/               # hero, proof strip, delivery receipt, etc.
└── types/                     # AIOptions, AIModel, etc.

drizzle/                       # SQL migrations 0000 → 0024
docs/                          # RUNBOOK.md, RED-TEAM.md, PROPOSALS.md, ...
.github/workflows/             # CI gates: lint, build, test, security-regression
public/.well-known/            # security.txt (RFC 9116)
MIGRATIONS-RUNME.sql           # bundled runner for new Postgres environments
STANDARDS.md                   # the 10 internal commitments customers can hold us to
```

## Quick start

```bash
# Prereqs
nvm use 20         # Node 20.x
cp .env.example .env.local
# Fill in: DATABASE_URL, CLERK_SECRET_KEY, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
# (everything else is optional for local dev)

npm install
npm run dev        # http://localhost:3000
```

For a fresh Postgres database, paste `MIGRATIONS-RUNME.sql` into Neon
Console → SQL Editor. The verification SELECTs at the bottom confirm
every schema change landed.

## Common commands

| Command                             | What                                              |
| ----------------------------------- | ------------------------------------------------- |
| `npm run dev`                       | Turbopack dev server                              |
| `npm run build`                     | Production build (Vercel-shaped)                  |
| `npm run lint`                      | ESLint with project config                        |
| `npm test`                          | Full Vitest suite                                 |
| `npx vitest run src/lib/__tests__/` | Lib-only tests                                    |
| `npx tsc --noEmit`                  | TypeScript type-check                             |
| `npx drizzle-kit generate`          | Generate a new migration from schema diff         |
| `/deploy-check` (Claude Code)       | Pre-deploy gate; runs build + the 6 known gotchas |
| `/security-check` (Claude Code)     | Security regression suite + reviewer agent        |
| `/ship` (Claude Code)               | Full pipeline (user-invocation only)              |

## How requests flow through the platform

```
Client request
  → Next.js middleware (Clerk auth, rate limit)
  → Route handler
    → For agent routes: createAgentRoute factory wraps in
      • auth gate (or skipAuth for public)
      • rate limit (Upstash Redis-backed, per-tenant)
      • Zod schema validation
      • input sanitiser
      • jailbreak detector
      • plan enforcement (free / starter / array / node / enterprise / founder)
      • tenant suspension check  ← migration 0024
      • withTenant() AsyncLocalStorage context
      • → handler({input, request, email, userId, tenantId, orgId})
      • output verifier (6 parallel layers)
      • PII scan
      • quality score + retry-with-refinement-hint
      • cost-ledger write to usage table  ← migration 0023 adds tenant_id
      • Phoenix span emitted
      • Sentry capture on throw
    → Response

Cron jobs and webhooks bypass the agent factory but use the same
primitives (idempotency, signature verification, rate limit) directly.
```

## Security primitives (all reusable)

- **`@/lib/idempotency` — `alreadyProcessed(namespace, eventId)`** — three-tier
  dedupe (Redis → Postgres → in-memory). Use on every webhook.
- **`@/lib/rate-limit` — `rateLimit({interval, limit}).check(req)`** — Upstash
  with in-memory fallback. Per-IP by default.
- **`@/lib/admin-auth` — `requireAdmin()`** — Clerk userId allowlist via
  `ADMIN_USER_IDS` env var.
- **`@/lib/cron-auth` — `requireCronAuth(req)`** — `Authorization: Bearer
$CRON_SECRET` for `/api/_cron/*`.
- **`@/lib/jailbreak-detect`** — pre-flight prompt-injection scan before any AI call.
- **`@/lib/output-verifier`** — runs LlamaGuard + PII + content policy + quality
  - trust-gate + LlamaFirewall in parallel; blocks on any "fail".
- **`@/lib/with-timeout` — `fetchWithTimeout(url, opts)`** — every outbound call
  must have a timeout. No exceptions.

## Deploying

GitHub-native via Vercel: push to a branch, Vercel builds from source,
preview URL appears on the PR. **Never** use `vercel build && vercel deploy
--prebuilt` — it bypasses the build chain (see `CLAUDE.md` "Build & Deploy").

Required env vars in Vercel → Settings → Environment Variables:

```
# Required
DATABASE_URL
CLERK_SECRET_KEY
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

# Highly recommended
NVIDIA_NIM_API_KEY              # default LLM provider, $0 cost
RESEND_API_KEY                  # welcome emails
SENTRY_DSN                      # error tracking
UPSTASH_REDIS_REST_URL          # rate limit + idempotency
UPSTASH_REDIS_REST_TOKEN
CLERK_WEBHOOK_SECRET            # tenant creation on signup
ADMIN_USER_IDS                  # comma-separated Clerk user ids
CRON_SECRET                     # protects /api/_cron/*

# Payment (any subset)
PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET + PAYPAL_WEBHOOK_ID + PAYPAL_PLAN_*
YOCO_SECRET_KEY + YOCO_WEBHOOK_SECRET
PAYFAST_MERCHANT_ID + PAYFAST_MERCHANT_KEY + PAYFAST_PASSPHRASE
PAYSTACK_SECRET_KEY

# Optional providers
ANTHROPIC_API_KEY               # Claude fallback
GEMINI_API_KEY                  # Google fallback
GROQ_API_KEY                    # Groq inference
CEREBRAS_API_KEY                # ultra-fast routing
PORTKEY_API_KEY                 # multi-provider gateway

# Optional observability
PHOENIX_OTLP_ENDPOINT           # self-hosted Phoenix UI for AI traces
LLAMA_FIREWALL_ENDPOINT         # Layer 6 prompt-injection / code defence
SLACK_OPS_WEBHOOK_URL           # error-watcher cron pages here
```

## Documentation

| File                          | What                                                        |
| ----------------------------- | ----------------------------------------------------------- |
| `CLAUDE.md`                   | The instruction file Claude Code reads — gotchas + patterns |
| `STANDARDS.md`                | The 10 commitments. Surfaced publicly at `/standards`       |
| `docs/RUNBOOK.md`             | What to do when X breaks. SEV-1 / SEV-2 / SEV-3 procedures  |
| `docs/PAYPAL-LIVE-RUNBOOK.md` | PayPal go-live checklist + smoke tests                      |
| `docs/RED-TEAM.md`            | Promptfoo CI red-team gate (~100 attacks per PR)            |
| `docs/PROPOSALS.md`           | Discovered improvements — not yet shipped                   |
| `docs/SHIPPED.md`             | Changelog of substantive feature work                       |
| `docs/THESIS.md`              | Why the platform is shaped the way it is                    |
| `docs/MCP-INTEGRATIONS.md`    | Custom MCP server exposing platform agents                  |

## Contributing

This is a single-founder repo right now. The patterns here are mostly
load-bearing — when you change one, document why. New AI calls go through
`@/lib/ai`. New agents use `createAgentRoute`. New webhooks use
`alreadyProcessed`. New API routes use `rateLimit`. If a change can't fit
those, that's the conversation worth having before the PR.

For everything else, see `CLAUDE.md` and `docs/RUNBOOK.md`.

---

Sovereign Matrix — flat-fee, refund-no-friction.
[sovereignmatrix.agency](https://sovereignmatrix.agency)
