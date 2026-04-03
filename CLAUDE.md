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
