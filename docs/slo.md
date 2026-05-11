# Service Level Objectives — Sovereign Matrix

This document defines the public-facing reliability commitments. Every
metric below is the operator's contract with paying customers and is
checked by the synthetic monitoring rig (see `runbooks/synthetic-monitoring.md`).

## North-star availability

| Metric                                  | Target | Window | Source                                     |
| --------------------------------------- | ------ | ------ | ------------------------------------------ |
| Public marketing site (`/`)             | 99.95% | 30 d   | Vercel edge logs                           |
| Authenticated dashboard (`/dashboard`)  | 99.9%  | 30 d   | Vercel edge logs + Sentry                  |
| Stripe checkout flow                    | 99.95% | 30 d   | `/api/_payments/stripe/checkout` 2xx ratio |
| Agent invocation (any `/api/_agents/*`) | 99.5%  | 30 d   | route 5xx ratio (Sentry)                   |
| Signed agent receipt read (`/r/[id]`)   | 99.9%  | 30 d   | route 2xx ratio                            |

Availability counts a route as "down" when the 5-minute rolling 5xx ratio
exceeds 5% OR median latency exceeds 5× the p50 baseline.

## Latency SLOs (p95)

| Endpoint                              | p95 budget | Notes                                     |
| ------------------------------------- | ---------- | ----------------------------------------- |
| `/api/_payments/stripe/webhook`       | 800 ms     | Stripe drops the connection after 10s.    |
| `/api/_payments/stripe/checkout`      | 1.5 s      | Includes Stripe API round trip.           |
| `/api/_agents/*` (handler + verifier) | 6 s        | Includes 150–400ms LlamaGuard postflight. |
| `/r/[id]` (server-rendered receipt)   | 600 ms     | Single Postgres select, no LLM call.      |
| `/api/me/export`                      | 4 s        | 30 parallel DB selects.                   |
| `/api/me/delete`                      | 4 s        | 30 parallel cascading deletes.            |

## Error budgets

If the 30-day error budget for a route is consumed, **no non-essential
deploys** until budget recovers (the 5xx ratio drops back under target
for 7 days). "Non-essential" means anything that isn't itself fixing
reliability or a security/billing critical bug.

## Dependency map

A failure of any of these external dependencies causes the listed
internal degradation:

| External        | Sovereign impact                                                    | Graceful degradation                                                  |
| --------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Neon (Postgres) | All persisted reads/writes return errors                            | Per-route 503 on DB failures (not 500); audit-log calls non-blocking  |
| Clerk           | `/dashboard/*`, `/api/me/*` and any `requireAuth` route returns 503 | Public marketing pages remain up                                      |
| Stripe          | Checkout + portal + payment webhooks fail                           | App shows "billing temporarily unavailable" banner                    |
| NVIDIA NIM      | LlamaGuard layer of the safety verifier becomes a no-op             | Other 4 layers (regex PII, content policy, quality, critic) still run |
| Resend          | Email send returns `{ success: false }`                             | Falls back to Gmail SMTP if `GMAIL_USER` / `GMAIL_APP_PASSWORD` set   |
| Anthropic API   | Routes that pin Claude fail-over per AI router                      | Router falls back: Cerebras → Ollama → cached response                |
| Sentry          | No effect on user-facing requests                                   | Errors flow only to console/Vercel logs until reconnect               |

## Incident response

1. Sentry alert fires on a SLO breach.
2. On-call ack within 15 min (paging via Sentry → email + Slack).
3. Status page (`/status`) flipped to "investigating" within 30 min.
4. Public update on `/status` every 30 min until resolved.
5. Post-mortem within 5 business days, published as `docs/post-mortems/YYYY-MM-DD.md`.

## What "nothing fails" actually means

The platform is designed so that **no single dependency failure can
500 a user request**. The pattern is enforced in three layers:

1. **Fail-open safety checks** — output verifier returns "pass" if any
   layer is unreachable (see `src/lib/output-verifier.ts:155`).
2. **Best-effort persistence** — `auditLog`, `recordRun`, `saveMemory`
   wrap every DB call in try/catch and never throw to the caller.
3. **Per-route 503 guard** — Postgres error 42P01 (missing table) is
   treated as "feature not yet provisioned" and returns an empty/503
   instead of a 500. See CLAUDE.md → "Database" gotcha.
