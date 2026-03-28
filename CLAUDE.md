# The Sovereign Matrix Codebase Guide

Welcome to the Sovereign Matrix repository. This file serves as the core instruction manual for the **Claude Code CLI** or any Anthropic agent operating within this directory.

## Architecture Stack

| Layer          | Technology                                          |
| -------------- | --------------------------------------------------- |
| Framework      | Next.js 16 (App Router) + React 19                  |
| Language       | TypeScript (`.tsx`, `.ts`)                           |
| Styling        | Tailwind CSS v4, Framer Motion, Lucide React         |
| Database       | PostgreSQL (Neon Serverless) via Drizzle ORM         |
| Auth           | Clerk (`@clerk/nextjs`)                              |
| Payments       | Stripe, PayFast, Paystack                            |
| Real-time      | Pusher (WebSocket events), custom WS server          |
| AI Providers   | Google Gemini, Anthropic Claude, NVIDIA NIM, Groq, Ollama (local) |
| Search         | Tavily (web search), Pinecone (vector)               |
| Email          | Resend                                               |
| Voice/SMS      | Twilio, ElevenLabs                                   |
| 3D/WebGL       | Three.js, React Three Fiber, COBE (globe)            |
| Analytics      | Vercel Analytics + Speed Insights                    |
| Testing        | Vitest                                               |
| Deployment     | Vercel (primary), Docker (self-hosted option)        |

## Important Commands

| Command                         | Purpose                           |
| ------------------------------- | --------------------------------- |
| `npm run dev`                   | Start dev server (Turbopack)      |
| `npm run build`                 | Production build                  |
| `npm run lint`                  | Run ESLint                        |
| `npm run test`                  | Run Vitest test suite             |
| `npm run ws`                    | Start WebSocket server            |
| `rm -rf node_modules && npm i`  | Full dependency reset             |
| `npx drizzle-kit push`         | Push schema changes to Neon DB    |
| `npx drizzle-kit generate`     | Generate migration SQL            |

## Project Structure

```
sovereign-v2/
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── layout.tsx           # Root layout (Clerk, Analytics, cinematic effects)
│   │   ├── page.tsx             # Landing page
│   │   ├── dashboard/           # Authenticated dashboard (50+ pages)
│   │   │   ├── layout.tsx       # Sidebar nav, command palette, activity console
│   │   │   ├── page.tsx         # Main dashboard
│   │   │   ├── settings/        # User settings, API keys, webhooks, billing, team
│   │   │   ├── war-room/        # Multi-agent debate arena
│   │   │   ├── canvas/          # Visual agent workflow builder
│   │   │   ├── content-factory/ # AI content generation hub
│   │   │   ├── seo-dominator/   # SEO analysis tooling
│   │   │   ├── ghost-protocol/  # Autonomous agent fleet
│   │   │   └── ...              # 40+ additional feature pages
│   │   ├── api/
│   │   │   ├── _agents/         # 123 agent API routes (prefixed with _)
│   │   │   ├── _cron/           # Scheduled cron jobs
│   │   │   ├── _payments/       # Payment gateway handlers
│   │   │   ├── _webhooks/       # Inbound webhook receivers (Twilio, Telegram, CRM)
│   │   │   ├── v1/[...path]/    # Public REST API (catch-all proxy)
│   │   │   ├── payments/        # Payment route proxy
│   │   │   ├── webhooks/        # Webhook route proxy
│   │   │   ├── referral/        # Referral system
│   │   │   └── mcp/             # Model Context Protocol endpoint
│   │   ├── portal/              # Client-facing portal (white-label)
│   │   ├── client-portal/       # White-label client dashboard
│   │   ├── locations/           # Programmatic SEO location pages
│   │   └── (public pages)       # about, pricing, docs, blog, login, etc.
│   │
│   ├── components/
│   │   ├── ui/                  # Core UI components (Button, Card, Badge, etc.)
│   │   ├── chat/                # Chat interface (MessageList, InputBar, ChatProvider)
│   │   ├── cinematic/           # Visual effects (CustomCursor, ScrollVelocity, HeroOrb)
│   │   ├── dashboard/           # Dashboard-specific components
│   │   ├── canvas/              # Visual workflow builder components
│   │   ├── 3d/                  # Three.js/R3F components (HeroScene, GlobalStrikeMap)
│   │   ├── artifacts/           # Artifact rendering panel
│   │   ├── onboarding/          # Guided onboarding flow
│   │   └── providers/           # Context providers (Telemetry)
│   │
│   ├── lib/                     # Shared utilities and services
│   │   ├── ai.ts                # **Unified AI router** — single entry for all LLM calls
│   │   ├── llm-router.ts        # Smart model routing (task classification)
│   │   ├── nvidia.ts            # NVIDIA NIM integration
│   │   ├── ollama.ts            # Local Ollama integration
│   │   ├── agent-factory.ts     # Agent instantiation factory
│   │   ├── agent-teams.ts       # Multi-agent team orchestration
│   │   ├── agent-memory.ts      # Persistent agent memory
│   │   ├── swarm.ts             # Agent swarm coordination
│   │   ├── db.ts                # Database connection helper
│   │   ├── stripe.ts            # Stripe integration
│   │   ├── payments.ts          # Payment orchestration
│   │   ├── pusher.ts            # Real-time event bus
│   │   ├── email.ts             # Email service (Resend)
│   │   ├── voice-service.ts     # Voice call service (Twilio)
│   │   ├── pinecone.ts          # Vector database
│   │   ├── cache.ts             # Caching layer
│   │   ├── rate-limit.ts        # Rate limiting
│   │   ├── rbac.ts              # Role-based access control
│   │   ├── auth-guard.ts        # Auth middleware helpers
│   │   ├── api-guard.ts         # API key validation
│   │   ├── content-safety.ts    # Content moderation
│   │   ├── jailbreak-detect.ts  # Prompt injection detection
│   │   ├── input-sanitizer.ts   # Input sanitization
│   │   ├── nemo-guardrails.ts   # NVIDIA NeMo Guardrails
│   │   ├── validation.ts        # Schema validation
│   │   ├── logger.ts            # Structured logging
│   │   ├── constants.ts         # App-wide constants
│   │   ├── env-check.ts         # Env var validation on startup
│   │   ├── hooks/               # React hooks (useMouse, useCountUp, etc.)
│   │   └── agents/              # Agent support (memory-router, governor)
│   │
│   ├── agents/                  # Agent persona definitions
│   │   ├── orchestrator.ts      # Master orchestrator
│   │   ├── war-room.ts          # Multi-agent debate
│   │   ├── closer.ts            # Sales closer agent
│   │   ├── prospector.ts        # Lead prospector
│   │   ├── nurture.ts           # Lead nurture agent
│   │   ├── coder.ts             # Code generation agent
│   │   ├── designer.ts          # Design agent
│   │   ├── content-factory.ts   # Content creation agent
│   │   ├── seo-dominator.ts     # SEO optimization agent
│   │   └── ghost-mode.ts        # Autonomous operation agent
│   │
│   ├── config/
│   │   ├── models.ts            # Model registry (all LLM providers & capabilities)
│   │   └── theme.ts             # Theme configuration
│   │
│   ├── db/
│   │   ├── index.ts             # Drizzle client (Neon HTTP driver)
│   │   └── schema.ts            # Full database schema (20+ tables)
│   │
│   ├── types/
│   │   ├── index.ts             # Shared TypeScript types
│   │   └── web-speech.d.ts      # Web Speech API declarations
│   │
│   └── __tests__/               # Test suite
│       ├── api.test.ts
│       ├── llm-router.test.ts
│       ├── security.test.ts
│       ├── agent-memory.test.ts
│       ├── agent-teams.test.ts
│       ├── mcp-server.test.ts
│       ├── nemo-guardrails.test.ts
│       └── tool-search.test.ts
│
├── server/                      # Standalone servers
│   ├── ws.ts                    # WebSocket server
│   ├── python-agents/           # Python-based agent services
│   └── pdf-generator/           # PDF generation service
│
├── scripts/                     # Operational scripts
├── drizzle/                     # Migration files
├── docs/                        # Additional documentation
├── public/                      # Static assets
├── next.config.ts               # Next.js configuration
├── drizzle.config.ts            # Drizzle Kit configuration
├── vitest.config.ts             # Test configuration
├── vercel.json                  # Vercel deployment config
├── Dockerfile                   # Docker build
└── docker-compose.yml           # Docker Compose setup
```

## Core Concepts

### Unified AI Router (`src/lib/ai.ts`)

All LLM calls go through a single `ai()` function. Routing priority:

1. **Ollama** (local, $0) — if user has configured a local endpoint
2. **NVIDIA NIM** (free open-source models) — if model is `nim` or NIM key exists
3. **Gemini** (Google free tier) — default fallback
4. **Claude** (Anthropic) — when explicitly selected or BYOK key provided
5. **Groq** — ultra-fast inference for supported models

User API keys are stored per-user in the `settings` table and override global keys.

### Smart Model Router (`src/lib/llm-router.ts`)

Classifies prompts by task type (`code`, `creative`, `reasoning`, `vision`, `safety`, `multilingual`, `long_context`, `general`) and routes to the optimal model from the registry in `src/config/models.ts`. Includes a 60s response cache.

### Agent Architecture (`src/app/api/_agents/`)

123 specialized agent endpoints, each a Next.js Route Handler. Key agents:

| Agent             | Purpose                                        |
| ----------------- | ---------------------------------------------- |
| `god-brain`       | Master meta-prompter and architect              |
| `war-room`        | Multi-agent debate arena for synthesis          |
| `orchestrator`    | Task decomposition and agent coordination       |
| `computer-use`    | Claude browser/bash controller                  |
| `image-gen`       | Image generation (FLUX.1)                       |
| `voice-chat`      | Real-time voice conversation                    |
| `code-agent`      | Code generation and review                      |
| `smart-router`    | Dynamic model selection per task                |
| `ghost-fleet`     | Autonomous background agent swarm               |
| `workflow-engine` | Multi-step workflow execution                   |

Agent personas are defined in `src/agents/` and provide system prompts and behavior configuration.

### API Route Convention

Internal API routes use underscore prefix (`_agents/`, `_cron/`, `_payments/`, `_webhooks/`). Public-facing routes use catch-all proxies (`api/v1/[...path]/`, `api/payments/[...path]/`, `api/webhooks/[...path]/`) that validate API keys via `src/lib/api-guard.ts`.

### Database Schema (`src/db/schema.ts`)

20+ tables organized by feature phase:

- **Core**: `tenants`, `users`, `settings`, `organizations`, `orgMembers`
- **Agent State**: `activeSwarms`, `globalTelemetry`, `agentActivity`, `scheduledRuns`
- **Revenue**: `bookings`, `leads`, `adCreatives`, `payments`, `subscriptions`
- **Content**: `scheduledContent`, `emailSequences`, `sequenceSteps`, `generations`
- **Platform**: `customSkills`, `marketplaceAgents`, `whitelabelConfig`, `clientProjects`
- **Voice**: `voiceCalls`
- **Chat**: `conversations`, `chatMessages`
- **Auth**: `apiKeys`
- **Usage**: `usage`

Database runs on **Neon Serverless PostgreSQL** via `drizzle-orm/neon-http`. Migrations live in `drizzle/`.

### Authentication

Clerk handles all auth. The root layout wraps the app in `SafeClerkProvider`. The middleware at `src/middleware.ts` handles route protection for `/dashboard/*` routes and API gateway concerns.

### Real-time Events

Pusher is used for real-time updates. The `JarvisSocket` component in the dashboard layout listens for live events. The standalone WebSocket server in `server/ws.ts` provides additional real-time capabilities.

## Environment Variables

### Critical (required)

| Variable                              | Purpose                       |
| ------------------------------------- | ----------------------------- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`   | Clerk frontend auth           |
| `CLERK_SECRET_KEY`                    | Clerk backend auth            |
| `NVIDIA_NIM_API_KEY`                  | NVIDIA NIM model access       |
| `DATABASE_URL`                        | Neon PostgreSQL connection     |

### Optional (feature-specific)

| Variable                              | Purpose                       |
| ------------------------------------- | ----------------------------- |
| `GOOGLE_GENERATIVE_AI_API_KEY`        | Gemini API                    |
| `ANTHROPIC_API_KEY`                   | Claude API                    |
| `GROQ_API_KEY`                        | Groq inference                |
| `TAVILY_API_KEY`                      | Web search                    |
| `RESEND_API_KEY`                      | Email sending                 |
| `STRIPE_SECRET_KEY`                   | Stripe payments               |
| `PINECONE_API_KEY`                    | Vector database               |
| `PUSHER_APP_ID` / `PUSHER_KEY` / `PUSHER_SECRET` | Real-time events  |
| `TELEGRAM_BOT_TOKEN`                  | Telegram bot integration      |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | Voice/SMS               |
| `ELEVENLABS_API_KEY`                  | Voice synthesis               |
| `UPSTASH_REDIS_REST_URL`             | Redis cache                   |

## Formatting & Design Protocols

1. **Dark Mode First**: The system strictly uses dark mode aesthetics (`bg-[#030303]`, `text-neutral-200`). Never introduce light-theme defaults.
2. **No External Component Libraries**: Build UI natively using Tailwind CSS. Use heavy glassmorphism (`backdrop-blur-xl`, `bg-white/5`). Do not add shadcn, MUI, or similar libraries.
3. **Animations**: Use `framer-motion` for all micro-interactions. New UI elements must have fluid enter/exit states via `AnimatePresence`.
4. **Icons**: Use `lucide-react` exclusively for icons.
5. **3D Elements**: Use `@react-three/fiber` + `@react-three/drei` for WebGL components. Keep 3D components in `src/components/3d/`.

## Code Conventions

- **Path aliases**: Use `@/` for imports from `src/` (configured in `tsconfig.json`)
- **API routes**: Export async functions named `GET`, `POST`, etc. from `route.ts` files
- **Logging**: Use `createLogger("module-name")` from `@/lib/logger` — never raw `console.log`
- **Error handling**: Wrap API routes with proper try/catch. Use `NextResponse.json()` for responses
- **Type safety**: Types in `src/types/index.ts`. Model configs in `src/config/models.ts`
- **Server external packages**: Node-only packages (`twilio`, `drizzle-orm`, `@pinecone-database/pinecone`, `@neondatabase/serverless`) are listed in `next.config.ts` `serverExternalPackages`

## Testing

Tests use **Vitest** with Node environment. Test files live in `src/__tests__/` and follow the pattern `*.test.ts`. Run with `npm run test`. Coverage targets `src/lib/`.

## Security

The platform includes multiple security layers:

- **Edge middleware**: Rate limiting, security headers (HSTS, CSP, X-Frame-Options)
- **Input sanitization**: `src/lib/input-sanitizer.ts`
- **Jailbreak detection**: `src/lib/jailbreak-detect.ts`
- **Content safety**: `src/lib/content-safety.ts`
- **NeMo Guardrails**: `src/lib/nemo-guardrails.ts`
- **API key validation**: `src/lib/api-guard.ts` with DB-backed keys
- **RBAC**: `src/lib/rbac.ts` for role-based access

## Deployment

- **Primary**: Vercel (serverless functions, edge middleware)
- **Self-hosted**: Docker via `Dockerfile` + `docker-compose.yml`
- **Database**: Neon PostgreSQL (serverless, auto-scaling)
- **Environment**: Node.js >= 18, <= 22

*You are operating as a Sovereign Node. Execute all tasks defensively and accurately.*
