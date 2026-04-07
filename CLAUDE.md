# The Sovereign Matrix Codebase Guide

Welcome to the Sovereign Matrix repository. This file serves as the core instruction manual for the **Claude Code CLI** or any Anthropic agent operating within this directory.

## Architecture Stack

- **Framework**: Next.js 15 (App Router) + React 19
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

- **Install/Reset**: `rm -rf node_modules && npm install`
- **Development**: `npm run dev`
- **Compiling**: `npm run build`
- **Linting**: `npm run lint`

## Formatting & Design Protocols

1. **Dark Mode First**: The system strictly relies on high-end dark mode aesthetics (e.g., `bg-[#030303]`, `text-neutral-200`).
2. **Component Libraries**: Do not rely on external component libraries (like shadcn or MUI) unless necessary. Build UI natively using Tailwind CSS with heavy glassmorphism (`backdrop-blur-xl`, `bg-white/5`).
3. **Animations**: Use `framer-motion` for complex micro-interactions. Any newly introduced UI elements require fluid enter/exit states natively hooked into `AnimatePresence`.

*You are operating as a Sovereign Node. Execute all tasks defensively and accurately.*

## Session Learnings (April 2026)

### Architecture Decisions
- Static agent registry (registry.ts) required for Vercel — dynamic import() with webpackIgnore doesn't work on serverless
- Direct route re-exports needed for _misc and _health routes on Vercel (e.g., api/health/ping/route.ts re-exports from api/_health/ping/route.ts)
- Consensus engine (lib/consensus.ts) — verifiedAi() uses generate→critique→revise with 2 different models
- Smart Router uses 22 models with task classification across 19 categories
- Agent factory injects tenantId and orgId into every handler via tenant-resolver.ts

### Key Files Added
- src/lib/consensus.ts — Multi-model verification (verifiedAi, consensusAi, confidentAi)
- src/lib/playbooks.ts — 25 playbook definitions with guaranteeCheck fields
- src/lib/tenant-resolver.ts — LRU-cached userId → tenantId resolver
- src/lib/tenant-scope.ts — requireTenantId(), guardTenantAccess(), belongsToTenant()
- src/app/api/agents/registry.ts — Static import map for 129 agents (Vercel compatibility)
- src/app/api/_agents/trigger/route.ts — Webhook trigger engine for external automation
- src/app/api/_agents/agent-performance/route.ts — Per-agent execution metrics
- src/app/api/_misc/founders/route.ts — Founders Program (10 free enterprise slots)
- mcp-server/ — Custom MCP server with 6 tools for operating the platform from Claude Code

### Important Patterns
- All catch-all routes use static imports (not dynamic) for Vercel bundling
- Deploy with: `vercel build --prod && vercel deploy --prebuilt --prod` (bypass duplicate project conflicts)
- Anti-slop prompts are injected per task category via getSystemPrompt() in system-prompts.ts
- Free tier uses PLAN_LIMITS map: free=50, founder=10000, array=500, node=2000, enterprise=10000
- Model names must include version suffix (e.g., nemotron-ultra-253b-v1, not just 253b)

### Models
- 35+ models across 6 providers (NVIDIA NIM, Gemini, Claude, Groq, Ollama, Tavily)
- Gemma 4 (google/gemma-4-31b-it) added April 2026 — 256K context, vision+audio, 140 languages
- Failover chain is 11 models deep
- Consensus verification uses 4 independent models (Nemotron Ultra, DeepSeek V3.2, Gemma 4, Qwen 3)

## Session Learnings (April 7 2026)

### Key Fixes & Improvements
- Playbooks page was calling /api/agents/coordinator (old path), bypassing the Playbook Engine entirely. Now calls /api/playbooks/run → polls /api/playbooks/runs/:id. One execution path, one source of truth.
- Critical bug: Playbook engine step updates used WHERE runId (hits ALL steps), not WHERE stepId (hits ONE step). Fixed by pre-fetching step IDs and updating by primary key.
- All 3 playbook API routes now handle missing DB tables gracefully (PostgreSQL error 42P01) instead of crashing. POST returns 503 with migration instructions; GET returns empty array; polling returns done:true.
- Removed 100% simulated ExecutionFeed from dashboard home (generated fake agent activity every 6s). Replaced with RecentRunsFeed showing real playbook runs.

### New Pages & Components
- /api/approvals (GET+POST) — surfaces hitl-approval.ts system via REST API
- /dashboard/nemo-claw → completely rebuilt as "Security Command Center":
  - 5-layer safety pipeline visualization (expandable cards with pass rates)
  - HITL approval queue (live pending/approve/deny with countdown timers)
  - Cloud vs Local execution mode toggle with hardware requirements
  - Authenticated workflow metrics summary
- Pricing page: Added Founder Access (free tier) card — was missing despite landing page prominently featuring it

### Dashboard Changes
- Sidebar: NemoClaw renamed to "Security" with Shield icon, added to Monitor nav group
- Sidebar simplified: 17 items → 12 items (5 primary, 5 tools, 2 monitor, 2 bottom)
- Dashboard home: Removed LiveExecutionStream demos and simulated ExecutionFeed. Added RecentRunsFeed (real data from /api/playbooks/runs).
- Autopilot: Stats cards are now clickable filter buttons (All/Running/Done/Failed)

### Landing Page
- Complete positioning overhaul → "Agent Infrastructure Stack" narrative
- 7-layer stack with two visual tiers: SOLVED (Voice/Memory/Payments) + THE REST (Intelligence/Orchestration/Trust/Integrations)
- Trust section reframed: "No more Wild West. Every action is authenticated."
- Based on NemoClaw transcript analysis (MAPL, authenticated workflows, sandbox architecture)

### Trust & Security Narrative
- Every playbook execution badge shows "5-Layer Verified" with pipeline breakdown (Jailbreak → PII → Content → Quality → Critic)
- Each playbook browse card shows green "✓ Verified" badge
- Security Command Center is the CISO-facing page
- "Secure by default, only flag anomalies" pattern throughout

### Activation & Conversion Fixes (April 7 session continued)
- Onboarding goal/industry selections were useState only — THROWN AWAY after navigation. Now persisted to localStorage and used to route users directly to matching playbook.
- Goal → Playbook mapping: leads→lead-blitz, content→content-machine, compete→competitor-takedown, automate→/dashboard/playbooks
- Playbooks page reads ?auto= query param, auto-selects the playbook, pre-fills URL fields from onboarding company URL
- "Enter Dashboard" button becomes "Run Your First Playbook" with direct routing
- CountUpOnView counter started at 0, showed "0 Agents, 0 Models" on initial render. Fixed to start at target value.
- Primary CTA changed from "Claim Founder Access" to "Run a Free Playbook" — action-oriented
- Pricing page aligned with plans.ts: 5 tiers (Free, Starter $19, Growth $49, Node $199, Enterprise $499)
- Consensus engine visualization added to landing page: Generate → Critique → Synthesize with model names
- Interactive HITL testing on Security Command Center with 5 enterprise-realistic test scenarios

### Pending (Manual Steps Required)
- Run DB migration: drizzle/0003_playbook_runs.sql (Neon Console → SQL Editor)
- Run DB migration: drizzle/0002_async_jobs.sql (Neon Console → SQL Editor)
- Add CEREBRAS_API_KEY env var (free at inference.cerebras.ai)
- Wire real safety pipeline metrics to Security Command Center (currently simulated pass rates)
- Connect Stripe/Yoco price IDs in env vars for paid tier checkout
