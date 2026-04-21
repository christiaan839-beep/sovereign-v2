# Production Hardening Sprint — Phases 1-3

**Branch:** `claude/wizardly-benz` · **Target:** `main`
**Title:** `feat: production hardening sprint — phases 1-3`

## TL;DR

| Metric | Before | After |
|---|---|---|
| Tests passing | 1225 | **1280** (+55) |
| TypeScript errors | 4 pre-existing | **0** (fully clean) |
| Breaking changes | — | **0** |
| Env vars added | — | **12** (Stripe×4, Langfuse×3, LiteLLM×2, Qdrant×2, DEGRADATION_MODE) |
| New models | — | **6** (Mistral Small 4, Phi-4 Reasoning, Video VL, Rerank 4B, Qwen 3.5, Kimi K2.5) |
| Orphan deps removed | — | `three-globe` (24 MB) |
| New migrations | — | `0018_credit_system.sql`, `0019_safety_events.sql` |
| New test files | — | 5 (safety-pipeline, rate-limits, stripe-dedup, model-routing + reliability from phase 0) |
| Playbook max duration | 60s (Vercel limit) | **unbounded** (QStash-chained steps) |
| Vector memory | installed, unused | **live for Growth+** (with keyword fallback for Starter) |

## Phase checklist with commit links

### Phase 1 — P0 Critical Wiring

- [x] **1.1** Zod env schema + boot-time assertion + `.env.example` + README Operations section → `cb598d94`
- [x] **1.2** DB migration 0018 credits + service + RLS + updated_at trigger → `03d96cab`
- [x] **1.3** Unified NemoGuard pipeline (input + output checks) with SHA-256 hashed `safety_events` audit + 10 tests + Sovereign-tier skip gate → `accb5acf`
- [x] **1.4** `/api/health/deep` with parallel 2s checks + critical-vs-advisory HTTP 503 + README UptimeRobot setup → `77a92fa0`, `9603ac08`
- [x] **1.5** Per-endpoint route-aware rate limiting middleware (6 buckets) + 14 tests → `77470240`

### Phase 2 — P1 Architecture

- [x] **2.1** Chained-queue playbook execution — enqueue step 0, runStepAndContinue enqueues step N+1. Breaks 60s Vercel ceiling. Telegram notify moved to updateRunStatus → `7d6af29e`
- [x] **2.2** Semantic (vector) memory wired into agent pipeline; tier-gated (Growth+ gets embedding, Starter keyword only — clean upgrade reason) → `1ad0eac9`
- [x] **2.3** Verified Stripe two-state dedup (received → completed, stale-window recovery) + 8 state-machine unit tests. Clerk has no webhooks → N/A → `36d7dbf7`

### Phase 3 — P2 Polish & Models

- [x] **3.1** 6 new NIM models across SOVEREIGNTY_SAFE / CHINESE_WEIGHT lists + sovereignty-aware `selectBestModel()` routing + 23 routing tests → `5f9b4d8a`
- [x] **3.2** Dedicated "Reliability Tests" CI job running 87 deterministic tests on every PR → `53bae0f1`
- [x] **3.3** Eliminated all 4 pre-existing TypeScript errors (mcp-server + semantic-memory) — fully clean typecheck → `b3b3dbbc`
- [x] **3.4** Audited Three.js — removed `three-globe` + 2 orphan components (kept `three`/`@react-three/fiber` for the live HolographicAgent) → `d6d520fb`

Final lint cleanup: `e5da926b`

## What's Now Elite

1. **Fault-isolated playbooks** — every step lives in its own function invocation with its own 60s budget
2. **Output safety** — NemoGuard scans both inputs AND outputs; blocks logged to audit table with hashed prompts only
3. **Tier-gated semantic memory** — Growth+ agents compound (vector recall of past interactions injected into system prompt)
4. **Boot-time env validation** — deploys fail fast with a readable error instead of mid-request mystery undefined
5. **Route-aware rate limits** — can never accidentally ship a new route without a limit (middleware handles it)
6. **Zero TS errors for the first time** — including pre-existing debt from before this sprint
7. **SOC 2 audit trail** — `credit_transactions` + `safety_events` + `stripe_events` are all append-only, queryable, RLS-enforced

## What's Still Weak

1. **No Sentry DSN set in prod** (code is wired; just needs the env var in Vercel/Railway)
2. **No UptimeRobot monitor live** (docs added; manual 15-min setup remaining)
3. **`semantic-memory` embedding calls** depend on NVIDIA NIM — when NIM is down, Growth+ users see stale cache (acceptable; not a regression from before)
4. **Credit system schema is deployed but no API surfaces consume it yet** — Stripe webhook needs to call `topUp()` on successful payment, agent factory needs to call `placeHold()/captureHold()` around each run. Next sprint.
5. **QStash signing keys not rotated** — using initial tokens; document rotation SOP.
6. **Some pre-existing lint errors** in dashboard pages (14 across 10 files, all in code I didn't touch this sprint)

## Migration Runbook

Apply these in order before cutting over production traffic:

### 1. Env vars (Vercel / Railway dashboard)

```
# Required (platform won't start without these — asserted at boot)
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
DATABASE_URL=

# Recommended (one of these should be set)
NVIDIA_NIM_API_KEY=
CEREBRAS_API_KEY=
GEMINI_API_KEY=

# Observability (enables error tracking + product analytics)
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_AUTH_TOKEN=
SENTRY_ORG=
SENTRY_PROJECT=

# Rate limits + cache (required for multi-region)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Billing (required for Stripe checkout)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER=
STRIPE_PRICE_GROWTH=
STRIPE_PRICE_NODE=
STRIPE_PRICE_SOVEREIGN=

# Optional (enable advanced features)
LITELLM_URL=
LITELLM_API_KEY=
LANGFUSE_HOST=
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
QDRANT_URL=
QDRANT_API_KEY=
DATA_SOVEREIGNTY_MODE=  # "true" to strip Chinese-weight models
DEGRADATION_MODE=       # "normal" | "reduced" | "minimal" kill switch
```

### 2. Database migrations

In Neon Console → SQL Editor, apply in order:
1. `drizzle/0018_credit_system.sql`
2. `drizzle/0019_safety_events.sql`

Both are idempotent — safe to run multiple times (all `CREATE TABLE IF NOT EXISTS`, RLS policies are `DROP ... IF EXISTS` first).

### 3. Smoke test

```bash
# Health must return 200 healthy
curl https://sovereignmatrix.agency/api/health/deep | jq

# Env validation banner should appear in Vercel logs on cold start
# Look for "Sovereign Matrix — capability status" followed by ✓/–

# Test a playbook — must return jobId + status:"running" within ~200ms
curl -X POST https://sovereignmatrix.agency/api/playbooks/run \
  -H "Content-Type: application/json" \
  -d '{"playbook_id":"lead-blitz","inputs":{"niche":"SaaS"}}'

# Rate limit test — hit /api/auth/* 11x, 11th should 429 with Retry-After
for i in {1..11}; do curl -I https://sovereignmatrix.agency/api/auth/callback; done
```

### 4. External monitoring

- UptimeRobot → new HTTPS monitor → `https://sovereignmatrix.agency/api/health/deep`
- Interval: 5 min, alert after 2 consecutive fails
- Expected payload: `{"status":"healthy", ... }`

### 5. Rollback plan

Each phase is its own commit — safe to revert individual commits. The
full sprint is 15 commits; reverting cleanly via `git revert cf7dd8d1..HEAD`
returns to the pre-sprint baseline. DB migrations are additive (no DROPs
of existing tables), so rollback of code doesn't require rolling back the
schema.

## Next Sprint — P0

1. Wire credits service into the agent-factory (placeHold around each run, captureHold on success, releaseHold on failure)
2. Wire Stripe webhook → topUp() on successful checkout
3. Ship UptimeRobot monitor + Sentry DSN in prod
4. SOC 2 Type 1 audit kickoff — all the pieces are now here (safety_events, credit_transactions, stripe_events audit trails)
5. Marketplace beta — `/api/v1` developer surface with Unkey for API key management
