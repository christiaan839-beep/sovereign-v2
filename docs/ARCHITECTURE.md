# Sovereign Matrix — System Architecture

**Last updated:** April 19, 2026
**Maintained by:** @christiaandewet
**Audience:** Anthropic Partner Network reviewers, future contributors,
and the founder six months from now who's forgotten how this works.

---

## The one-paragraph summary

Sovereign Matrix is a multi-tenant **agent operating system**. Users
invoke one of 223 production AI agents (lead gen, content, SEO, voice,
code review, research) — individually via the API/dashboard, chained
into 26 pre-built playbooks, or scheduled on cron. Every agent call
passes through a 5-layer safety pipeline (jailbreak → PII → policy →
quality → critic), routes via a smart-router to the best of 39+
available models (Claude Sonnet 4.6 for judgment, NVIDIA Nemotron for
throughput, Gemini for grounded search, DeepSeek/Qwen/Mistral/Groq as
failover), writes an immutable audit entry, and meters usage against
the caller's plan. Flat-rate monthly pricing on Stripe; no per-token
fees passed through to customers.

---

## The stack

```
┌─ Browser ─────────────────────────────────────────────────────────────┐
│  Next.js 16 / React 19 · Clerk Auth · Editorial CSS design system     │
│  Pages: /built-with-claude · /roi · /pricing · /dashboard/nexus ·     │
│         /dashboard/autopilot (with live React-Flow DAG)               │
└───────────────────────────────────────────────────────────────────────┘
                │
                ▼  HTTPS
┌─ Vercel Edge (src/proxy.ts) ─────────────────────────────────────────┐
│  clerkMiddleware  ·  security headers  ·  CORS preflight  ·           │
│  Upstash Redis distributed rate limit (100/min/user, 3 buckets for    │
│  free-tool: email 10/hr, IP 3/hr, IP ceiling 20/hr)                   │
└───────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─ Next.js App Router (Vercel serverless) ─────────────────────────────┐
│                                                                       │
│  /api/agents/[...slug]  →  AGENT_REGISTRY dispatch                    │
│    ↓                                                                  │
│    createAgentRoute({ handler })  — the factory                       │
│     - Auth: Clerk session OR (X-Sovereign-Internal-Secret +           │
│             X-Sovereign-User-Id) paired cron headers                  │
│     - 5-layer safety pipeline (LlamaGuard + PII + content + quality   │
│       + Claude critic)                                                │
│     - Plan enforcement (fail-closed on DB error, fail-open on         │
│       pre-migration 42P01)                                            │
│     - Circuit breakers: NIM, Gemini, Claude, Groq, Stripe, Resend     │
│     - Audit log write (immutable)                                     │
│                                                                       │
│  /api/cron/*  — scheduler (1min), job-runner (1min),                  │
│     playbook-scheduler (5min), weekly-report (Monday 08:00),          │
│     cleanup (Sunday 03:00), health/ping (4min)                        │
│    Protected by verifyCron() — timing-safe CRON_SECRET compare        │
│                                                                       │
│  /api/_payments/stripe/webhook  — 2-state idempotency                 │
│     (stripe_events: received → completed)                             │
│                                                                       │
│  /api/_integrations/slack/{authorize,callback}  — OAuth 2.0 flow      │
│     CSRF via state cookie, tokens encrypted at rest via safeEncrypt   │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
                │
      ┌─────────┼─────────┬──────────┬──────────┐
      ▼         ▼         ▼          ▼          ▼
┌─ Claude ──┐ ┌NIM─┐ ┌Gemini┐ ┌Stripe┐ ┌Resend┐ ┌Upstash┐ ┌Neon┐
│ Sonnet    │ │ 10 │ │ 3.1  │ │ subs │ │ mail │ │ ratel │ │PG  │
│ 4.6 /     │ │mdls│ │ Pro  │ │ +WH  │ │ +ted │ │ +anal │ │RLS │
│ Haiku 4.5 │ │+TTS│ │ Flash│ │ /yoco│ │mplate│ │yt     │ │+WAL│
│ (god-     │ │+ASR│ │ 2.0  │ │      │ │      │ │       │ │    │
│ brain,    │ │    │ │      │ │      │ │      │ │       │ │    │
│ nexus,    │ │    │ │      │ │      │ │      │ │       │ │    │
│ L5-safety)│ │    │ │      │ │      │ │      │ │       │ │    │
└───────────┘ └────┘ └──────┘ └──────┘ └──────┘ └───────┘ └────┘
```

---

## Data model

All tenant-scoped tables have Row-Level Security enabled (migration
`0005`). Policies compare to `app_current_user_id()` which reads a
session-local Postgres setting set by `withTenant()`.

| Table | Purpose | Tenant-scoped | Key indexes |
|---|---|---|---|
| `settings` | per-user API keys, BYOK | ✓ (by user_email) | idx on user_email |
| `leads` | prospect records | ✓ | user_email |
| `generations` | saved agent outputs | ✓ | user_email + created_at |
| `usage` | metering | ✓ (by user_id) | user_id + created_at |
| `subscriptions` | Stripe plan mapping | ✓ | user_id · stripe_customer_id |
| `playbook_runs` | multi-step workflow runs | ✓ | user_id + status + created_at |
| `playbook_run_steps` | per-step execution detail | ✓ (via run_id join) | run_id |
| `scheduled_runs` | cron-fired playbooks | ✓ | user_id |
| `agent_activity` | audit log / inbox | ✓ | user_id |
| `api_keys` | user-issued API credentials | ✓ | user_id |
| `email_sequences` | email drip definitions | ✓ (by user_email) | user_email |
| `oauth_connections` | Slack/Gmail/etc tokens | ✓ | user_id + provider + workspace_id |
| `stripe_events` | webhook dedup | ✗ (global) | primary key on event_id + status |
| `waitlist` | email capture (pre-signup) | ✗ (public) | email unique |
| `tenants` | org/team mapping | N/A | id · owner_id |

The **service role** (`sovereign_service` with `BYPASSRLS`) is used
only by cron jobs, the Stripe webhook, and migrations. User-facing
requests connect via `DATABASE_URL` which enforces RLS.

---

## Request lifecycle — a user runs an agent

1. Browser POST → `/api/agents/leads` with `{ action, params }`
2. **Vercel Edge** (`src/proxy.ts`): Clerk middleware checks session,
   Upstash Redis applies 100-req/min sliding window, security headers
   attached.
3. **`/api/agents/[...slug]/route.ts`**: looks up `AGENT_REGISTRY[slug]`,
   dynamically imports the agent module.
4. **`createAgentRoute.POST(req)`** (`src/lib/agent-factory.ts`):
   - Auth: `guardRoute()` resolves `userId` from Clerk, OR accepts
     cron-signed headers (timing-safe comparison)
   - `checkFreeUsage(userId)` — gate against plan limits
     (`getUserPlan` reads `subscriptions` + respects
     `currentPeriodEnd`)
   - 5-layer safety pipeline runs the input through LlamaGuard + PII
     scanner + content-policy + quality-scorer + Claude critic
   - `resolveTenantId` — caches userId → tenantId for downstream RLS
   - Agent `handler({ input, userId, email })` executes
   - Circuit-breaker-wrapped call out to NVIDIA/Claude/Gemini/Groq
   - Response validated against agent's output schema (future: Zod
     contract test)
   - `incrementUsage(userId)` records one row in `usage`
   - Audit log entry persisted
5. Response streams back through the edge proxy to the browser.
6. Browser hook `useAgentRun` maps the response status to UX:
   - 200 → data rendered
   - 401/403 → redirect to `/login?redirect_url=<returnTo>`
   - 429 → toast with upgrade CTA
   - 503 → toast "temporarily unavailable"
   - timeout → toast "Request timed out after Ns"

---

## Scheduler lifecycle — a playbook fires at 09:00 UTC

1. **Vercel Cron** fires `/api/cron/scheduler` every minute.
2. Route verifies `CRON_SECRET` via `verifyCron` (timing-safe).
3. Query: `SELECT * FROM scheduled_runs WHERE enabled=true AND
   (next_run_at IS NULL OR next_run_at <= now()) LIMIT 50`
4. For each candidate: apply the two-gate match
   (`cron-next.matches(expr, now)` AND `nextRunAt recent`):
   - Exact cron-match: fire
   - Stale `nextRunAt`, no match: fire anyway (catchup)
   - No cron-match, `nextRunAt` recent: skip (wait for cron minute)
5. `fireOneSchedule(row)`:
   - Construct `X-Sovereign-Internal-Secret` + `X-Sovereign-User-Id`
     headers
   - 45s fetch-timeout to `/api/agents/<agentType>`
   - Update `scheduled_runs`: `lastRunAt`, `nextRunAt` (from
     `cron-next.nextRun(expr, now)`), `runCount++`, `lastStatus`,
     `lastResult` (truncated 2KB)
6. Autopilot page polls `/api/playbooks/runs` every 4s and renders
   the execution status via `PlaybookGraph` (React Flow DAG).

---

## Stripe webhook lifecycle — a user subscribes

1. Stripe sends `checkout.session.completed` event.
2. Handler verifies signature via `stripe.webhooks.constructEvent`.
3. **Two-state idempotency gate**:
   - INSERT `stripe_events` with `status='received'`
   - On 23505 (dup): check existing status
     - `completed` → return 200 (real dup, skip)
     - `received` AND fresh (< 5min) → return 202 (concurrent retry,
       Stripe will back off and try again)
     - `received` AND stale (≥ 5min) → re-process (original crashed)
4. Handler switch processes the event type.
5. On success: UPDATE `stripe_events` to `status='completed'`.
6. On exception: UPDATE to `status='failed'` with `error_message`.
7. 200 to Stripe → retries stop.

---

## Where Claude runs

Claude is the **judgment layer**, not a generic chat wrapper.

| Surface | Claude model | What it does |
|---|---|---|
| `god-brain` | `claude-opus-4-7` + extended thinking | Strategic / legal / deep reasoning |
| `war-room` chairperson | `claude-sonnet-4-6` | Synthesizes 3-way debate into final position |
| `nexus` deep-mode | `claude-sonnet-4-6` | Verifies Gemini's consensus against raw transcripts |
| `output-verifier` (L5) | `claude-haiku-4-5` | Critic gate on every agent response |
| `code-reviewer` | `claude-sonnet-4-6` | Reviews PRs against security patterns |
| `consensus-engine` | `claude-sonnet-4-6` | One of 4 verification nodes |
| `trust-gate` | `claude-haiku-4-5` | HITL action-risk classifier |
| `self-heal` (opt-in) | `claude-haiku-4-5` for diagnosis, any model for retry | Proposes modified input when an agent fails |

Everything else (throughput work — text completion, summarization,
classification) routes to the cheapest-per-task open-source model via
`smart-router` in `src/lib/llm-router.ts`.

---

## Security posture

### Defense-in-depth layers (outside-in)

1. **Vercel edge security headers** — `X-Content-Type-Options`,
   `X-Frame-Options`, `Strict-Transport-Security`, etc.
2. **Clerk auth** — all `/dashboard/*` + most `/api/*` routes gated
   at the middleware layer; internal bypass requires paired
   shared-secret + user-id headers.
3. **Rate limits** — Upstash Redis sliding window per-user (100/min
   for authenticated API) plus dedicated 3-bucket limiter for the
   free-tool proxy.
4. **Input validation** — Zod schemas at the agent-factory boundary.
5. **Safety pipeline** — LlamaGuard jailbreak detection → PII scanner
   → content policy → quality score → Claude critic.
6. **Application-layer tenant filter** — every Drizzle query includes
   `WHERE user_id = ?`.
7. **Postgres Row-Level Security** — DB refuses to return another
   tenant's rows even if application-layer filter is forgotten.
8. **Crypto** — `crypto.randomUUID()` for IDs, `crypto.getRandomValues`
   for rate-limit cohorts + referral codes, `timingSafeEqual` for
   every secret comparison.
9. **Idempotency** — Stripe events dedup by primary key with 2-state
   status tracking.
10. **Error reporting** — Sentry with PII scrub at both the request
    header layer (sentry.server.config.ts `beforeSend`) and the log
    payload layer (`scrubSecrets()` in `src/lib/logger.ts`).

### Threat-model notes

- **API key exfiltration via error log:** mitigated by log-payload
  scrubber + Sentry header scrubber.
- **Webhook SSRF:** mitigated by `WEBHOOK_AGENT_ALLOWLIST` derived
  from the static registry.
- **Plan bypass via DB outage:** mitigated by fail-closed
  `plan-enforcement.ts` (`USAGE_UNAVAILABLE` sentinel).
- **BYOK leak via operator access:** partially mitigated by
  passphrase-based DEK derivation (server never sees plaintext of
  the passphrase-protected keys). Future: KMS-backed master key.
- **Payment event replay:** mitigated by 2-state idempotency.

---

## Observability

- **Structured logger** (`src/lib/logger.ts`): JSON in prod,
  human-readable in dev. `log.error(...)` automatically fires to
  Sentry via dynamic `@sentry/nextjs` import.
- **Sentry**: release-tagged to `VERCEL_GIT_COMMIT_SHA`, environment-
  tagged to `VERCEL_ENV`. `beforeSend` hook scrubs request PII.
- **Health check** at `/api/health/deep`: pings NVIDIA NIM, checks
  key-presence for Gemini/Claude/Groq/Stripe/Resend, SELECT 1 on
  the DB, reports `{ status, healthy, total, uptime_percent,
  checks }`.
- **Plausible** analytics on the public landing (privacy-friendly,
  no cookies).
- **Vercel Analytics + Speed Insights** (production only).

---

## Failure modes

### Graceful degradation

| When this fails | What still works |
|---|---|
| NIM API is down | Falls through to Gemini → Claude → Groq chain via circuit breaker + retry logic |
| Claude API is down | Throughput agents unaffected; judgment layer degrades to Gemini (lower quality) |
| Gemini API is down | NIM handles everything; deep mode degrades |
| Stripe is down | Free/Founder tier unaffected; paid-tier checkout returns 503 with retry hint |
| Resend is down | Welcome + weekly emails queue up (future: dead-letter table); rest of app unaffected |
| Upstash is down | Rate limiting falls back to in-memory Maps (per-instance, less accurate) |
| Neon (DB) is down | Agent execution FAILS CLOSED (plan-enforcement denies); landing page + `/built-with-claude` + `/roi` still render |

### Known blast radii

- Losing `CRON_SECRET` → scheduler stops firing (fail-closed) but
  other cron jobs protected separately by the same helper.
- Losing `ENCRYPTION_SECRET` → existing BYOK rows undecryptable;
  new passphrase-derived rows unaffected (v2 envelope is
  independent).
- Losing `DATABASE_URL_SERVICE` → cron/webhooks can't write
  cross-tenant, user-facing reads still work via RLS-enforced
  `DATABASE_URL`.

---

## Growth paths (architecture implications)

From `docs/NEXT_PROPOSALS.md`, the three most-likely-to-ship new
features have these implications:

- **Proposal R (weekly intelligence report)** — reuses existing
  `weekly-report` agent; add per-user cron schedule + Resend send.
  No new infra.
- **Proposal T (white-label agency portal)** — requires subdomain
  routing in `src/proxy.ts` + `tenants` table foreign keys on
  user-owned resources. All RLS policies pre-compatible.
- **Proposal H completion (Slack-using agent)** — wire `slackClient`
  into 2-3 agent handlers. OAuth flow already shipped (scaffolded).

---

## Decisions we made and why

- **Drizzle over Prisma**: better for serverless cold start, tighter
  SQL, no generated client file.
- **Clerk over NextAuth**: session management + MFA out of box;
  Partner-network-ready.
- **Neon over Supabase**: cheaper cold-start, cleaner Postgres-only
  surface (we don't need realtime/storage).
- **Upstash over self-hosted Redis**: no ops; HTTP REST works at
  the edge.
- **React Flow over Dagre**: already in dep tree from prior design
  experiments; linear playbook layout didn't need a graph algorithm
  yet.
- **Editorial design language (Instrument Serif + Inter Tight + JetBrains
  Mono)** over dark-matrix-neon: deliberately non-conformist for an
  AI-agent product; reads as considered restraint rather than template
  output.
- **Static AGENT_REGISTRY over file-system scan**: Vercel serverless
  requires webpack to see all imports statically to bundle them. Scan
  would only work for local dev.

---

## What this architecture does not yet solve

- **Cross-tenant analytics**: no aggregation layer yet; `usage` table
  is per-user.
- **Multi-region DB**: single Neon region; latency OK for US/EU but
  APAC is ~250ms.
- **File upload / storage**: agents can't currently ingest a PDF the
  user uploaded. Requires S3/R2 + signed-URL path.
- **Real-time (WebSocket) updates**: the dashboard polls. Fine at
  current scale; would need Upstash Pub/Sub or Vercel Realtime for
  1000+ concurrent active users.
- **Customer SSO**: Clerk has it; we haven't surfaced the org flow
  because there's no paid multi-seat tier yet.
