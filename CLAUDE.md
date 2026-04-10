# The Sovereign Matrix Codebase Guide

Welcome to the Sovereign Matrix repository. This file serves as the core instruction manual for the **Claude Code CLI** or any Anthropic agent operating within this directory.

## Architecture Stack

- **Framework**: Next.js 16 (App Router) + React 19
- **Compiler**: Turbopack (`npm run dev`)
- **Language**: TypeScript (`.tsx`, `.ts`)
- **Styling**: Tailwind CSS v4, Framer Motion (for animations), Lucide React (for icons)
- **Database**: PostgreSQL (Neon Serverless)
- **ORM**: Drizzle ORM (`src/db`)
- **Authentication**: Clerk (`@clerk/nextjs`)

## Core Agent Intelligence Nodes (`src/app/api/agents/`)

The platform leverages multiple specialized LLMs (Google Gemini, Anthropic Claude, NVIDIA NIM, Groq, local Ollama) connected via a single unified AI router located in `src/lib/ai.ts`.

Key endpoints:

- `god-brain`: Master meta-prompter and architect.
- `war-room`: Debate arena for multi-agent synthesis.
- `computer-use`: Native Claude 3.5 Sonnet browser/bash controller.
- `image-gen`: Generates images via Black Forest Labs FLUX.1.
- `smart-router`: Dynamically routes tasks to the best open-source model based on a registry.

## Important Commands

- **Development**: `npm run dev`
- **Compiling**: `npm run build`
- **Testing**: `npm run test` (vitest)
- **Linting**: `npm run lint`
- **WebSocket server**: `npm run ws` (ts-node server/ws.ts)
- **Install/Reset**: `rm -rf node_modules && npm install`
- **Drizzle migrations**: `npx drizzle-kit generate` to create, run SQL in Neon Console

## Formatting & Design Protocols

1. **Dark Mode First**: The system strictly relies on high-end dark mode aesthetics (e.g., `bg-[#030303]`, `text-neutral-200`).
2. **Component Libraries**: Do not rely on external component libraries (like shadcn or MUI) unless necessary. Build UI natively using Tailwind CSS with heavy glassmorphism (`backdrop-blur-xl`, `bg-white/5`).
3. **Animations**: Use `framer-motion` for complex micro-interactions. Any newly introduced UI elements require fluid enter/exit states natively hooked into `AnimatePresence`.

_You are operating as a Sovereign Node. Execute all tasks defensively and accurately._

## Critical Patterns & Gotchas

### Build & Deploy

- NEVER use `vercel build && vercel deploy --prebuilt` — use GitHub-native deploys (Vercel builds from source)
- `serverExternalPackages`: pinecone, twilio, drizzle-orm, neon — keeps them out of client/edge bundles
- Full CSP configured in next.config.ts headers() — update when adding new external scripts/frames
- White-label rewrites: `/client/:id/:path` → `/portal/:id/:path`, `/wl/:domain` → `/portal/d/:domain`
- `output: "standalone"` activates only for non-Vercel (Docker/Railway) deployments
- Security headers active: HSTS, X-Frame-Options DENY, nosniff, strict referrer, permissions policy
- `prerenderEarlyExit: false` in next.config.ts — prevents `_global-error` prerender crash from aborting build
- `typescript: { ignoreBuildErrors: true }` is intentional — legacy agent routes have pre-existing TS errors
- Static agent registry (registry.ts) required for Vercel — dynamic import() with webpackIgnore doesn't work on serverless
- All catch-all routes use static imports (not dynamic) for Vercel bundling
- Turbopack stale module: new files imported via dynamic() cause HMR errors — use static imports for new client components

### SSR / Client Components

- ClerkProvider must be lazy-loaded (`dynamic` + `ssr:false`) inside a `"use client"` wrapper — crashes during static prerendering
- Browser-only components (framer-motion `useSpring`, canvas, WebGL) must use `ClientOnlyEffects` wrapper — NOT direct imports in server component layout
- `next/dynamic` with `ssr: false` is NOT allowed in server components (Next.js 16) — must wrap in a `"use client"` component first
- All cinematic effects respect `prefers-reduced-motion` and auto-disable on mobile

### Database

- All API routes handle missing DB tables gracefully (PostgreSQL error 42P01) — return empty arrays or 503, never crash
- Drizzle schema is source of truth: `src/db/schema.ts`. Migrations in `drizzle/` folder.
- Pending migrations: 0002 (async_jobs), 0003 (playbook_runs), 0004 (graph memory, affiliates, audit logs, workflows, tenant onboarding columns)

### Revenue Pipeline

- plans.ts is single source of truth for pricing: free=50, starter=200, founder=10K, array=500, node=2K, enterprise=10K runs/month
- plan-enforcement.ts reads from subscriptions table → falls back to founder check → falls back to free
- Stripe webhook at `/api/_payments/stripe/webhook` handles full lifecycle: checkout.session.completed, subscription.updated/deleted, invoice.payment_failed
- Checkout flow: Pricing.tsx → `/api/payments/stripe/checkout` → Stripe → webhook → subscriptions table
- Model names must include version suffix (e.g., nemotron-ultra-253b-v1, not just 253b)

### Key Architecture

- Unified AI router: `src/lib/ai.ts` — single entry point for all AI calls, 39+ models across 8 providers
- AI routing priority: Ollama (local $0) → Cerebras (fast) → NIM (free) → Claude/Gemini (BYOK or global key)
- Consensus engine: `src/lib/consensus.ts` — verifiedAi() uses generate→critique→revise with 2 different models
- 5-layer output verifier: LlamaGuard + PII + content policy + quality + trust gate (parallel)
- Onboarding persists to both localStorage (immediate) and DB via `/api/user/onboarding` (durable)
- Goal → Playbook mapping: leads→lead-blitz, content→content-machine, compete→competitor-takedown
- User API keys stored encrypted in settings table — `crypto.ts` safeDecrypt for retrieval

### Lib Architecture (`src/lib/` — 120+ modules)

- Security: `auth-guard.ts`, `api-guard.ts`, `input-sanitizer.ts`, `jailbreak-detect.ts`, `content-safety.ts`, `nemo-guardrails.ts`
- Reliability: `circuit-breaker.ts`, `retry.ts`, `error-recovery.ts`, `rate-limit.ts` (Upstash)
- Output pipeline: `output-verifier.ts` (5-layer), `output-refiner.ts`, `output-transparency.ts`, `quality-scorer.ts`
- Multi-tenant: `tenant-resolver.ts`, `tenant-scope.ts`, `tenant-memory.ts`, `rbac.ts`
- Revenue: `plans.ts`, `plan-enforcement.ts`, `stripe.ts`, `payments.ts`, `paywall.ts`, `budget-controls.ts`
- Agent framework: `agent-factory.ts`, `agent-memory.ts`, `agent-teams.ts`, `swarm-protocol.ts`, `playbooks.ts`

### Database Schema (38 tables in `src/db/schema.ts`)

- Core: tenants, users, settings, organizations, orgMembers
- AI: generations, conversations, chatMessages, agentActivity, jobs
- Revenue: subscriptions, payments, usage, apiKeys
- Content: scheduledContent, emailSequences, sequenceSteps, adCreatives
- CRM: leads, voiceCalls, bookings, clientProjects
- Marketplace: marketplaceAgents, customSkills
- Memory: tenantMemories, graphNodes, graphEdges
- Operations: playbookRuns, playbookRunSteps, scheduledRuns, workflows
- Audit: auditLogs, errorLogs
- Growth: affiliates, referrals
- White-label: whitelabelConfig

### Server Components (`server/`)

- `ws.ts`: WebSocket server for real-time agent communication
- `python-agents/`: Standalone Python agents (deep_research, telegram_closer, nemoclaw_os, etc.) — not bundled in Next.js
- `pdf-generator/`: PDF generation service
- `n8n/`: n8n workflow automation configs

### Claude Code Infrastructure

- **MCP servers** (`.mcp.json`): `sovereign-matrix` (custom, exposes sovereign_run_agent/playbook/health/api_catalog against production) + `context7` (live library API docs — use it instead of guessing signatures for Drizzle, Clerk, Stripe, Vercel AI SDK, etc.)
- **Agents** (`.claude/agents/`): `sovereign-optimizer` (broad quality), `design-slop-blocker` (UI), `security-reviewer` (API/auth/payment audits — triggers automatically on API route changes)
- **Skills** (`.claude/skills/`): `/deploy-check` (pre-push verification gate, catches the 6 build gotchas), `/ship` (full dev→prod pipeline with security gate, user-invocation only)
- **Hooks** (`.claude/settings.json`): PreToolUse blocks `.env*` edits (exit 2), PostToolUse auto-formats `.ts/.tsx/.js/.jsx/.json/.md/.css` via Prettier — do NOT override or duplicate these
- **Env config** in `.env.local` (30+ keys: AI providers, Stripe, Clerk, Twilio, ElevenLabs, Sentry, etc.)

### Pending Manual Steps

- Run DB migrations 0002-0004 in Neon Console → SQL Editor
- Set up Stripe webhook endpoint in Stripe Dashboard → `/api/payments/stripe/webhook`
- Add Stripe price IDs: STRIPE_PRICE_STARTER, STRIPE_PRICE_ARRAY, STRIPE_PRICE_NODE, STRIPE_PRICE_ENTERPRISE
- Set up Clerk webhook endpoint → `/api/webhooks/clerk` (for welcome emails + tenant creation)
- Add CLERK_WEBHOOK_SECRET env var from Clerk Dashboard → Webhooks
