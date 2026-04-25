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

## Session Learnings (April 8-9 2026)

### Architecture Decisions
- Evolution engine (evolution-engine.ts) — prompts, routing, and agent chains self-improve over time
- Trust levels (trust-levels.ts) — 4 configurable autonomy levels: supervised → guided → autonomous → full auto
- Output verifier (output-verifier.ts) — LlamaGuard + PII + content policy + quality + trust gate, 5 checks in parallel
- Context compression (context-compression.ts) — 5-level strategy: dedup → summarize → prioritize → trim → truncate
- Agent performance (agent-performance.ts) — learns best model per task type, feeds back into smart router
- Competitive moat (competitive-moat.ts) — cross-agent learning, chain intelligence, pricing calculator

### Key Files Added
- src/lib/evolution-engine.ts — Self-improving prompts, routing, and strategy discovery
- src/lib/trust-levels.ts — 4-level autonomy with anomaly detection
- src/lib/execution-audit.ts — Immutable action logging
- src/lib/output-verifier.ts — 5-parallel-check verification pipeline
- src/lib/context-compression.ts — 5-level context management
- src/lib/agent-performance.ts — Model recommendation engine
- src/lib/competitive-moat.ts — Cross-agent learning + pricing math
- src/components/ui/Badge.tsx — Shared badge (6 colors, 3 sizes)
- src/components/ui/Skeleton.tsx — Loading placeholder (3 variants)
- src/hooks/useInterval.ts — Safe timer with auto-cleanup
- src/hooks/useLazyLoad.ts — Intersection Observer lazy loading
- src/components/cinematic/BentoGrid.tsx — Linear/Vercel-style feature grid
- src/components/cinematic/LiveModelHealth.tsx — Real API latency pings
- src/components/cinematic/LiveAgentStats.tsx — Real execution metrics
- src/components/cinematic/StackKiller.tsx — 8-tool cost displacement
- src/components/cinematic/LiveAgentTerminal.tsx — Streaming scan demo
- src/components/dashboard/NotificationBell.tsx — Real-time alerts
- src/app/api/voice/speak/route.ts — NVIDIA Magpie TTS (public, rate-limited)
- src/app/api/waitlist/route.ts — Email capture with Resend welcome email

### Important Patterns
- Turbopack stale module: new files imported via dynamic() cause HMR errors. Fix: use static imports for new client components
- Cherry-pick workflow: work on claude/wizardly-benz, cherry-pick to main for Vercel
- 55+ consecutive READY deploys with zero failures
- UltraPlan pattern: 3 parallel agents (bug hunter, quality analyzer, improvement ranker) for comprehensive audits
- Anti-distillation canary in system-prompts.ts poisons extraction attempts
- Glasswing sandbox escape narrative is the strongest trust argument

### Models
- 39+ models across 8 providers (NVIDIA NIM, Gemini, Claude, Groq, Cerebras, Ollama, DeepSeek, Alibaba)
- Added: Gemini 3.1 Pro, Nemotron Cascade 2, Llama 4 Maverick, Claude Mythos (registry only)
- Consensus engine updated: Gemma-4 → Gemini-3.1-Pro
- Smart router vision slot: Llama 4 Maverick (400B MoE)
- All "65+" references fixed to "39+" (24 files updated)
- "Sovereign Array" renamed to "Growth" (5 files)

### Pages Built
- 11 competitive /vs/ pages (hubspot, clay, zapier, crewai, n8n, lindy, sintra, manus, relevance-ai, make, claude-agents)
- 6 sector pages (healthcare, legal, realestate, recruiting, cybersecurity, education)
- 3 use case pages (lead-gen, content-engine, second-brain)
- Dashboard: analytics, email-builder, reports + NotificationBell wired to header
- Landing: BentoGrid, flat pricing, production-ready, trust stats, competitive strip
- /launch, /contact, /integrations, /developers/docs, /pricing/compare, /roadmap

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

### Elite Visual Effects (April 7 session continued)
- New effects library: src/components/ui/EliteEffects.tsx with 7 reusable components
- FloatingParticles: Canvas particle system with zero-gravity physics + mouse repulsion (auto-disables on mobile)
- TiltCard: 3D perspective tilt on hover with spring physics (falls back to plain div on mobile)
- TextShimmer: Animated gradient shimmer text (white→emerald→cyan→violet cycle)
- useHideyNav: Navigation hides on scroll-down, reappears on scroll-up (Google Antigravity pattern)
- SectionReveal: Scroll-triggered entrance animations with directional variants
- All effects respect prefers-reduced-motion media query
- Canvas devicePixelRatio scaling uses setTransform() to prevent cumulative scale bug
- Hero fade/scale removed entirely — was causing "black dead zone" between hero and content
- Hero compacted: 10 elements → 7 elements, min-h-[85vh] on mobile

### Autonomous Polish Sprint (April 7 session — while user was away)
- "How It Works" section: fixed duplicate title, added concrete examples, TiltCard wrapping, connector arrows, CTA
- Playbook browse: "Popular" badges on top 3 playbooks, guarantee text on cards, emerald glow on featured
- Security Command Center: replaced fake metrics with real data from /api/agents/dashboard-stats (honest "—" when no data)
- SEO metadata: created layout.tsx for 8 public pages (chat, privacy, terms, security, demo, playground, status, changelog)
- For-Agencies: ROI calculator aligned to USD $499 enterprise plan (was R9,997 ZAR hardcoded)
- Agent Analytics: added playbook runs rollup (total/succeeded/failed/avgDuration from /api/playbooks/runs)

### Deployment & Production Fixes (April 7 session continued)
- CRITICAL: Antigravity hero redesign removed useScroll from imports but it was still called → runtime crash on all routes
- Fix: restored useScroll/useTransform imports, removed dead HeroParticles/HeroOrb/InteractiveHeroStrike imports
- Vercel Deployment Protection (SSO) was enabled → blocks all public access with 401
- `vercel deploy --prebuilt` creates READY deployments but file resolution breaks: filePathMap references .next/server/chunks/* files not included in .vercel/output
- FIX: Use GitHub-native deploys (let Vercel build from source) instead of prebuilt. GitHub auto-deploys were being cancelled by concurrent prebuilt deploys
- NEVER use `vercel build && vercel deploy --prebuilt` unless Vercel CLI handles file bundling correctly
- Deployment Protection must be set to "Only Preview Deployments" in Vercel Dashboard → Settings → Deployment Protection

### Pending (Manual Steps Required)
- **CRITICAL**: Disable Vercel Deployment Protection for production (Vercel Dashboard → Settings → Deployment Protection → "Only Preview Deployments")
- Run DB migration: drizzle/0003_playbook_runs.sql (Neon Console → SQL Editor)
- Run DB migration: drizzle/0002_async_jobs.sql (Neon Console → SQL Editor)
- Run DB migration: drizzle/0025_sam_submission_fields.sql (extends marketplace_agents with SAM v1.0 fields; required for /api/creators/submit persistence + trust-tiered approval policy to read prior approvals)
- Run DB migration: drizzle/0033_audit_log_hash_chain.sql (adds prev_hash + row_hash to audit_logs; non-breaking for pre-existing rows)
- Run DB migration: drizzle/0034_api_key_scoping.sql (adds scopes/allowed_agents/allowed_ips JSONB to api_keys; non-breaking — NULL = legacy full-access)
- Add CEREBRAS_API_KEY env var (free at inference.cerebras.ai)
- Connect Stripe/Yoco price IDs in env vars for paid tier checkout
- Optional: set SOVEREIGN_APPROVAL_POLICY env var to "trust-tiered" once operator review routinely clears <24h (default "curated" queues every submission)
- Optional: set SOVEREIGN_FREE_ONLY=true to strip paid providers from the failover chain (free-tier guarantee for cost-sensitive deployments)
- CRON_SECRET env var must be set so /api/cron/verify-audit-chain (every 6h) authenticates against Vercel Cron

## Session Learnings (April 24-25 2026)

### Reliability + Security Hardening Sprint
Four defense-in-depth layers added; all pure-function, fail-open where the user's response is at stake, and additive (no breaking changes to existing contracts). 50+ unit tests across these surfaces.

#### Layer 1 — PII output guard (src/lib/pii-guard.ts)
- Regex + Luhn scanner: SSN, credit card, E.164/US phone, email
- `scrubPiiDeep` walks JSON tree (maxDepth=10 by default)
- Wired into agent-factory + vision-agent-factory via `piiGuardMode`:
  - `"mask"` (DEFAULT) — scrubs SSN/CC/phone/email in place
  - `"flag"` — log findings, don't modify (resume-normalizer, business-card-reader, coi-verifier)
  - `"skip"` — bypass (synthetic data generators only)
- Fail-open: scan errors NEVER block the user response (defense-in-depth, not primary defense)
- US phone regex: `/(?:\(\d{3}\)\s*|\b\d{3}[-.\s])\d{3}[-.\s]\d{4}\b/g` — leading `\b` was removed to allow `(###) ###-####` after a word

#### Layer 2 — Audit log hash chain (drizzle/0033, src/lib/audit-log.ts)
- SHA-256 chain: `row_hash = h(prev_hash | userId | action | resource | details | createdAt)`
- Any in-place edit breaks the chain — `verifyAuditChain()` walks rows forward and returns `{valid, brokenAt, expectedPrev, foundPrev}`
- GET `/api/admin/audit/verify-chain` (admin-gated, 404s for non-admins) for on-demand check
- `/api/cron/verify-audit-chain` runs every 6h via Vercel Cron — returns 500 + ERROR log on a broken chain
- Pre-migration rows skip the chain (NULL row_hash) — non-breaking for existing fleets
- Genesis sentinel = literal string "GENESIS" for the first row
- 8 audit-log tests including 3 distinct tampering scenarios (details mutation / forged prev_hash / forged row_hash)

#### Layer 3 — API-key scoping (drizzle/0034, src/lib/api-key-scopes.ts)
- JSONB columns on api_keys: `scopes`, `allowed_agents`, `allowed_ips`
- `evaluateScope()` is pure-function and unit-testable
- NULL scopes = legacy full-access (back-compat); `[]` = revoked-in-place
- Per-agent scopes (`agent:execute:<slug>`) > generic > admin escape
- IPv4 CIDR matching for IP allowlists; `ip_required` reason when `allowed_ips` is set but no client IP
- Wired into /api/v1/[...path] gateway:
  - `/api/v1/agents/<slug>` → `agent:execute` on `<slug>`
  - `/api/v1/playbooks/*` + `/api/v1/workflows/*` → `agent:execute`
  - `/api/v1/health/*` + `/api/v1/status/*` → `data:read`
  - Any other GET → `data:read`; non-GET → `agent:execute`
- `validateApiKey()` cache now stores the FULL ApiKeyRecord (5-min TTL bounds revocation latency)
- `classifyV1Request()` extracted to api-key-scopes for unit testing (9 tests)

#### Layer 4 — Free-first router (src/lib/provider-costs.ts + ai.ts gate)
- `SOVEREIGN_FREE_ONLY=true` mirrors `DATA_SOVEREIGNTY_MODE` pattern from nvidia.ts
- Strips paid steps from failover chain → NIM → Groq → honest error ("Set SOVEREIGN_FREE_ONLY=false to use paid fallbacks")
- `PROVIDER_COSTS` map catalogues every provider as `free|paid|metered`
- Frontier providers (openai, xai, mistral-direct, cohere, openrouter, together, databricks, replicate) = paid
- Free tier (ollama, nim, nvidia-nim, cerebras) = free; groq = metered

### Testing
- 192 test files / 2448 tests / tsc clean / lint <25
- 36 tests in security-hardening.test.ts (PII guard / API-key scopes / free-first router / classifier)
- 8 tests in audit-log.test.ts (fail-open + 3 tampering scenarios + legacy row skip)
- weekly-health.mjs invariant 28/28 green after every commit

### Patterns Worth Preserving
- **Fail-open everywhere user-facing**: PII scrubber errors, audit log writes, scope evaluator failures must NEVER block the user response. Errors get logged for ops; the request still completes. The audit log hash chain is the safety net, not the gate.
- **Pure-function evaluators**: `evaluateScope`, `scanPii`, `classifyV1Request` etc. all have NO Request/DB/NextResponse dependency. Wire-up code lives in route files; logic lives in libs. Easy to test in isolation.
- **Vitest hoisting + vi.hoisted()**: When a `vi.mock` factory needs to close over shared state, that state MUST be inside `vi.hoisted(() => ({...}))` — otherwise you get `Cannot access 'X' before initialization`. Used in audit-log.test.ts.
- **Cache the full record, not just the lookup result**: validateApiKey() caches the full ApiKeyRecord (plan + userId + scopes + allowedAgents + allowedIps) so downstream scope checks don't need a second DB hit.
- **JSDoc + cron syntax footgun**: Putting `*/N` (every-N-units cron expression) inside a `/**...*/` comment closes the comment early. Use prose like "every 6 hours" instead.

### Files Added
- src/lib/pii-guard.ts — Regex + Luhn PII scanner (240 LOC)
- src/lib/api-key-scopes.ts — Scope evaluator + classifyV1Request (~230 LOC)
- src/lib/provider-costs.ts — Free/paid/metered catalog + FREE_ONLY_MODE
- src/lib/__tests__/security-hardening.test.ts — 36 unit tests
- src/lib/__tests__/audit-log.test.ts — 8 tests including tampering scenarios
- src/app/api/admin/audit/verify-chain/route.ts — On-demand admin verification
- src/app/api/cron/verify-audit-chain/route.ts — Continuous monitoring cron (every 6h)
- drizzle/0033_audit_log_hash_chain.sql — prev_hash + row_hash columns
- drizzle/0034_api_key_scoping.sql — scopes + allowed_agents + allowed_ips columns

### Files Modified
- src/lib/audit-log.ts — From 38 LOC to ~150 LOC with hash chain
- src/lib/agent-factory.ts — piiGuardMode config, result made let-mutable for scrubber
- src/lib/vision-agent-factory.ts — Forwards piiGuardMode
- src/lib/ai.ts — FREE_ONLY_MODE gate in failover chain
- src/db/schema.ts — apiKeys: scopes/allowedAgents/allowedIps jsonb columns
- src/app/api/v1/[...path]/route.ts — evaluateScope + classifyV1Request integration
- src/app/api/_agents/{resume-normalizer,business-card-reader,coi-verifier}/route.ts — opt into piiGuardMode: "flag"
- vercel.json — registers /api/cron/verify-audit-chain (every 6h)

### Continued: April 25 (afternoon)

#### Audit-log coverage expansion
- POST/DELETE /api/_tokens (mint + revoke) → audit api_key.create / api_key.delete with keyPrefix + plan + IP
- POST /api/_tokens/rotate → records BOTH events (api_key.create + api_key.delete) so rotation isn't a single opaque action in the SOC-2 timeline
- POST /api/admin/creator-submissions/[id]/approve → admin.submission_approve (NEW AuditAction enum variant)
- POST /api/admin/creator-submissions/[id]/reject → admin.submission_reject; rejection reason is part of the chained `details` so disputes are settled by the immutable record

#### CI integration
- .github/workflows/ci.yml gains an `anti-drift` job that runs `node scripts/weekly-health.mjs` on every PR. Script exits 1 on regression → CI blocks merge if any of the 47 invariants break.

#### /security page modernized
- Cite specific files (src/lib/pii-guard.ts) instead of generic claims
- New "Verifiable hardening — April 2026" callout with file paths + test counts per layer
- New "Cost Sovereignty" card (SOVEREIGN_FREE_ONLY mode)

#### Public threat model
- docs/THREAT_MODEL.md — STRIDE-based, every claim cites a file or test command. Used as the procurement-ready security artifact for enterprise sales.

#### useReducedMotion shared hook
- src/hooks/useReducedMotion.ts — useSyncExternalStore-based, replaces the duplicated useState+useEffect+matchMedia pattern across 10+ components. Migrated EliteEffects, ConstellationPreview, IndustrySignature so far.

#### IBAN + SWIFT/BIC PII detection
- IBAN (ISO 13616) with full mod-97 checksum validation. Chunk-by-chunk modular arithmetic to fit within JS Number precision.
- SWIFT/BIC (ISO 9362) with strict 8/11-char structural regex.
- New dedup ranking: ssn > iban > credit_card > swift_bic > phone > email
- 4 unit tests covering valid IBAN, invalid mod-97, BIC 8+11 forms, end-to-end scrub.

#### setState-in-effect fixes (React 19's react-hooks/set-state-in-effect)
- /dashboard/jobs: split fetcher from loading-state mgmt. Pure async fetcher, callers manage loading via .finally().
- /dashboard/page (QuickRunBanner): localStorage read moved to lazy useState initializer (no flicker, no effect).
- /components/ui/EliteEffects: useIsMobile + usePrefersReducedMotion → useSyncExternalStore.
- /components/dashboard/NotificationBell: localStorage read → lazy useState initializer.
- ConstellationPreview + IndustrySignature: migrated to shared useReducedMotion hook.

#### Anti-drift expansion
- weekly-health.mjs: 28 → 47 invariants (was 28 at start of session)
- 15 new "security" dimension checks (artifact presence + wiring content)
- 4 new "trust-asset" checks (/security page, /trust/defenders, security.txt, threat model)
- CI now runs the anti-drift gate on every PR

### Result of April 24-25 cumulative
- Tests: 2433 → 2452 (+19)
- Lint errors: 17 → 10 (-7)
- Weekly-health invariants: 28 → 47 (+19)
- Security commits: 13 in this session, all green
