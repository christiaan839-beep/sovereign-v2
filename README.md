# Sovereign Matrix

> Multi-tenant AI workforce platform. 137 specialised agents. 8-provider unified router. Plan-aware $/day budget caps. Constitutional-AI-inspired 5-layer output safety pipeline. 1,123 tests passing.

[![Tests](https://img.shields.io/badge/tests-1123%20passing-brightgreen)](./src/__tests__)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)
[![Live](https://img.shields.io/badge/live-sovereignmatrix.agency-black)](https://sovereignmatrix.agency)
[![Package](https://img.shields.io/badge/npm-%40sovereign%2Fai--router-cb3837)](./packages/ai-router)

## What it is

A production AI agent platform that lets SMBs replace traditional agency
retainers with subscription pricing. Customers describe a business outcome
(_"50 qualified meetings with mid-market SaaS founders in Austin"_); the
platform composes a stack of specialised agents — research, draft, qualify,
call, book — every output filtered through a 5-layer safety pipeline before
it ships.

## Architecture in 30 seconds

```
                     ┌──────────────────────┐
   Browser   ───►   │  Next.js 16 App      │
                     │  RSC + Client islands │
                     └──────────┬───────────┘
                                ▼
   ┌──────────  Clerk auth + middleware  ──────────┐
   │                                                │
   ▼                                                ▼
┌──────────────┐                       ┌──────────────────┐
│ /api/agents  │ ───► agent-factory ──►│ 5-layer safety   │
│  (137 slugs) │     • plan quota      │   pipeline       │
└──────────────┘     • $/day cap       └──────────────────┘
                     • rate limit                │
                     ▼                           ▼
              ┌──────────────────┐    ┌──────────────────┐
              │  Unified router  │    │ Audit + spend    │
              │  Ollama → NIM    │    │ tracking         │
              │  → Cerebras      │    │ (Postgres)       │
              │  → Claude/GPT    │    └──────────────────┘
              │  → Gemini        │
              └──────────────────┘
```

## Key engineering decisions

Each one a real decision with a documented trade-off — open the file for the rationale.

- **Multi-provider routing** — `src/lib/ai.ts`. Quality-priority + cost-aware. Free providers absorb ~80% of inference; Claude reserved for verifier roles.
- **Postgres-backed daily $ cap** — `src/lib/budget-controls.ts`. Cold-start safe. The previous in-memory `Map` reset on every Vercel cold start and enforced nothing in practice.
- **Stripe payment-intent verification** — `src/app/api/credits/route.ts`. Idempotent redemption keyed on intent ID. Closes a credit-minting bypass.
- **5-layer output safety pipeline** — `src/lib/agent-factory.ts`. Jailbreak → content → handler → PII → quality → critic. Parallelised; total overhead under 200ms.
- **Migration parity CI gate** — `scripts/check-migrations.mjs`. Verifies every declared `pgTable` exists in Neon before merging. Stops the _"I forgot to run the migration"_ class of incident.
- **Readiness probe with 503 semantics** — `src/app/api/health/ready/route.ts`. Wire into Vercel deploy hooks to fail-deploy on broken integrations.
- **Competitor registry → SEO compounder** — `src/lib/competitor-registry.ts`. Every comparison page is one config entry. 16 indexed `/vs/<slug>` pages live.

## Tech stack

Next.js 16 (App Router, RSC) · React 19 · TypeScript · Drizzle ORM ·
PostgreSQL (Neon serverless) · Clerk · Stripe + PayFast/Yoco/PayStack ·
Anthropic Claude · OpenAI · Google Gemini · NVIDIA NIM · Cerebras ·
Groq · DeepSeek · local Ollama · Vercel · Sentry · Vitest · Playwright ·
GitHub Actions

## Production readiness

- 1,123 tests passing (1,116 main + 7 in the `@sovereign/ai-router` package)
- Sentry releases + source-map upload wired to Vercel commit SHA
- 5 production runbooks (DB down · migration drift · Clerk JWKS · Stripe rotation · smoke red)
- Pre-push git hook (lint + tests + soft typecheck + migration parity)
- Golden-path Playwright smoke + readiness probe + setup checklist UI
- Multi-tenant isolation, RBAC, audit logging, idempotent webhooks
- Hard daily $ spend cap (DB-backed, cold-start safe)

## Open-source extraction

The router that powers this platform is also published as a standalone
MIT package — zero deps, drops into any TypeScript project:

→ [`packages/ai-router`](./packages/ai-router) — `@sovereign/ai-router`

```ts
import { createRouter } from "@sovereign/ai-router";

const router = createRouter({
  providers: [
    { name: "anthropic", apiKey: process.env.ANTHROPIC_API_KEY },
    { name: "cerebras", apiKey: process.env.CEREBRAS_API_KEY },
  ],
  budget: { dailyCapCents: 500, onCapReached: "fallback-to-free" },
});

await router.complete({ prompt: "...", priority: "balanced" });
```

## How this was built — note on AI usage

Per Anthropic's candidate AI guidance: I built this platform in
collaboration with Claude as a pair-programmer. I directed every
architectural decision, prioritised every shipment, debugged every
production issue, and own every line that ships. The codebase reflects
my system thinking — every file ships because I chose for it to ship
that way.

I'd be glad to defend any decision live, unassisted. Open the
**Key engineering decisions** files above; the comments document the
trade-offs behind each choice.

## Run locally

Requires Node 18+, a Neon Postgres database, and a Clerk account.

```bash
git clone https://github.com/christiaan839-beep/sovereign-v2.git
cd sovereign-v2
npm install
cp .env.example .env.local   # fill in DATABASE_URL + Clerk keys + at least one AI provider
npm run dev
```

## Live

- Site: https://sovereignmatrix.agency
- Comparison library: `/vs/lindy` `/vs/apollo` `/vs/jasper` `/vs/autogpt`
- Marketplace: `/marketplace`
- Anthropic partnership thesis: `/anthropic`

## Maintainer

Christiaan de Wet · christiaan@sovereignmatrix.agency · [LinkedIn](https://linkedin.com)

Open to: Forward Deployed Engineer · Applied AI · Solutions Engineer ·
Agent Infrastructure · Full-stack contracts. Cape Town, remote-friendly
EU/US/SA timezones.

## License

MIT — see [LICENSE](./LICENSE) for the platform; `packages/ai-router/` ships under its own MIT license.
