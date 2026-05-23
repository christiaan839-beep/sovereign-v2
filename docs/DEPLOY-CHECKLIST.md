# Sovereign Matrix — Deploy Checklist

Wave 154. Every env var, every migration, every infra step the operator
needs to flip the closed-loop platform fully live. Items are grouped
by **severity**:

- **🔴 Required** — platform can't function without this
- **🟡 Optional but recommended** — degraded mode without it
- **🟢 Self-host / paid-tier** — flip when ready

---

## Phase 1 — Required ahead of first deploy

| Env var                 | Purpose                                                    | Source                              | What breaks without it                          |
| ----------------------- | ---------------------------------------------------------- | ----------------------------------- | ----------------------------------------------- |
| `DATABASE_URL`          | Neon Postgres connection (must start with `postgresql://`) | Neon dashboard                      | Every DB-backed agent returns 503               |
| `CLERK_PUBLISHABLE_KEY` | Clerk SDK                                                  | Clerk dashboard                     | Auth completely fails                           |
| `CLERK_SECRET_KEY`      | Clerk server                                               | Clerk dashboard                     | Auth completely fails                           |
| `CLERK_WEBHOOK_SECRET`  | Welcome emails + tenant creation                           | Clerk → Webhooks                    | Welcome flow + tenant creation silently skipped |
| `AGENT_RUN_HMAC_SECRET` | Receipt HMAC signing (HEX 32+ bytes)                       | Generate via `openssl rand -hex 32` | Receipts unsigned → trust gate refuses output   |

### Database migrations

Apply in order via Neon SQL Editor:

```
drizzle/0000_initial.sql  …  drizzle/0026_agent_sessions.sql
```

Wave 149+ tables (`model_bandit_arms`, `eval_baseline`, lazily created
on first hit) — no migration needed; the libs `CREATE TABLE IF NOT
EXISTS` on first use.

---

## Phase 2 — AI provider keys (need ≥1, route gracefully degrades)

| Env var                                            | Provider                                                                                             | Cost                |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------- |
| `NVIDIA_NIM_API_KEY`                               | NIM-hosted Nemotron / DeepSeek / Llama / Qwen — **the default cheap path**                           | Free w/ NIM account |
| `ANTHROPIC_API_KEY`                                | Claude — used by `claudeToolUse` flagships (competitor-scan, site-assassin, deep-think, super-agent) | $$ per call         |
| `GOOGLE_GENERATIVE_AI_API_KEY` or `GEMINI_API_KEY` | Gemini 2.5 — used by audit, url-context, closer, deep-think (extended thinking)                      | $ per call          |
| `GROQ_API_KEY`                                     | Groq inference                                                                                       | $ per call          |
| `CEREBRAS_API_KEY`                                 | Cerebras WSE-3 — fast text                                                                           | $ per call          |

Without any AI key → smartAi returns 503; agents that can't fall back
return `{ error: "..._API_KEY not configured" }`.

---

## Phase 3 — Receipt cryptography (Required for production)

| Env var                         | What it does                             | How to generate                                                                                                |
| ------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `AGENT_RUN_SIGNING_KEY`         | Ed25519 secret (base64, 64 bytes)        | See `packages/verifiable-receipts/conformance/generate-keypair.mjs`                                            |
| `AGENT_RUN_PUBLIC_KEY`          | Ed25519 public (base64, 32 bytes)        | Same script                                                                                                    |
| `AGENT_RUN_MLDSA65_PRIVATE_KEY` | Post-quantum secret (base64, 4032 bytes) | `import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js"; const { secretKey, publicKey } = ml_dsa65.keygen()` |
| `AGENT_RUN_MLDSA65_PUBLIC_KEY`  | Post-quantum public (base64, 1952 bytes) | Publish at `/.well-known/sovereign-receipts/mldsa65.b64`                                                       |

The conformance public key in `packages/verifiable-receipts/conformance/public-key.pem` is COMMITTED — used by the cryptographic test fixtures and is intentionally non-secret.

---

## Phase 4 — Payments (Required if monetising)

| Env var                   | Purpose                        |
| ------------------------- | ------------------------------ |
| `STRIPE_SECRET_KEY`       | Stripe API                     |
| `STRIPE_WEBHOOK_SECRET`   | Webhook signature verification |
| `STRIPE_PRICE_STARTER`    | $X plan price id               |
| `STRIPE_PRICE_FOUNDER`    | $X plan price id               |
| `STRIPE_PRICE_ARRAY`      | $X plan price id               |
| `STRIPE_PRICE_NODE`       | $X plan price id               |
| `STRIPE_PRICE_ENTERPRISE` | $X plan price id               |

Configure webhook endpoint at `/api/payments/stripe/webhook` in Stripe
Dashboard → Webhooks → Add endpoint.

---

## Phase 5 — Closed-loop cron (Wave 144 + 149)

| Env var                                   | Purpose                                                    | Required?                             |
| ----------------------------------------- | ---------------------------------------------------------- | ------------------------------------- |
| `CRON_SECRET`                             | Gates `/api/cron/nightly` when not called from Vercel Cron | Recommended if running outside Vercel |
| `SLACK_WEBHOOK_URL`                       | Slack alert dispatch on eval regression                    | Optional                              |
| `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` | Telegram alerts (also reused by voice-closer)              | Optional                              |
| `DISCORD_WEBHOOK_URL`                     | Discord alerts                                             | Optional                              |

The cron schedule lives in `vercel.json` at `15 4 * * *` (04:15 UTC daily).
**Vercel auto-trusts the `x-vercel-cron: 1` header — no secret needed
when deployed on Vercel.**

---

## Phase 6 — Self-host paths (Wave 133 + 137 + 152)

Flip these env vars when GPU / GCP infra is provisioned. Until then,
smartAi falls back to NIM-managed automatically.

| Env var                          | What it does                                                     |
| -------------------------------- | ---------------------------------------------------------------- |
| `OSS_INFERENCE_ENDPOINT`         | Self-hosted vLLM / NIM Microservice / Triton URL ending in `/v1` |
| `OSS_INFERENCE_API_KEY`          | Bearer token if the endpoint needs one                           |
| `OSS_INFERENCE_DEFAULT_MODEL`    | Model slug your endpoint serves (e.g. `meta/llama-4-maverick`)   |
| `OSS_RETRIEVER_ENDPOINT`         | Self-hosted NeMo Retriever (embed + rerank)                      |
| `OSS_RIVA_ENDPOINT`              | Self-hosted NVIDIA Riva for sub-200ms voice                      |
| `GCP_VERTEX_SEARCH_PROJECT`      | GCP project id for Vertex Search augmentation                    |
| `GCP_VERTEX_SEARCH_ENGINE_ID`    | Discovery Engine app id                                          |
| `GCP_VERTEX_SEARCH_LOCATION`     | Default `"global"`                                               |
| `GCP_VERTEX_SEARCH_ACCESS_TOKEN` | Short-lived OAuth (refresh via gcloud / Workload Identity)       |
| `GCP_BIGQUERY_DATASET`           | BigQuery dataset for receipt export                              |
| `GCP_BIGQUERY_TABLE`             | BigQuery table                                                   |
| `GCP_GCS_BUCKET`                 | GCS bucket for the NDJSON staging blob                           |
| `GCP_SERVICE_ACCOUNT_JSON`       | Base64-encoded service account                                   |

See `docs/gcp-integration.md` for the 4-tier GCP adoption map and
cost ceilings.

---

## Phase 7 — Hardware-key MFA (audit-2026-05 — SOC 2 CC6.1)

| Env var             | Purpose                                                                               |
| ------------------- | ------------------------------------------------------------------------------------- |
| `WEBAUTHN_RP_ID`    | Your domain (no scheme) — `sovereignmatrix.agency` or `localhost`                     |
| `WEBAUTHN_RP_NAME`  | Display name on the OS authenticator                                                  |
| `WEBAUTHN_ORIGIN`   | Full origin including scheme                                                          |
| `WEBAUTHN_REQUIRED` | Set to `"true"` to require recent (≤15min) hardware-key assertion for `/api/_admin/*` |

Without these, `/api/webauthn/*` returns 503 and admin guards fall open.

---

## Phase 8 — White-label + voice (optional)

| Env var                                                     | Purpose                                                                          |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_PHONE` | Voice closer agent (Pipecat + Riva)                                              |
| `ELEVENLABS_VOICE_ID`                                       | TTS voice                                                                        |
| `RESEND_API_KEY` + `RESEND_FROM_EMAIL`                      | Transactional email                                                              |
| `BROWSERBASE_API_KEY` + `BROWSERBASE_PROJECT_ID`            | Tier-3 browser automation                                                        |
| `E2B_API_KEY`                                               | Tier-3 cloud code sandbox (the wave-126 `run_code` is the local Tier-1 fallback) |

---

## Phase 9 — Operator workflow (post-deploy)

Once deployed, the operator's day-to-day is **almost entirely
zero-touch**. Here's what to do once on day one:

1. **Visit `/dashboard/admin`** — six admin deep-link cards live there
2. **`/dashboard/admin/war-room`** — confirm the SSE tick feed shows live runs (Wave 152)
3. **`/dashboard/admin/infrastructure`** — confirm OSS / NIM / Retriever / BigQuery / Riva status is green
4. **`POST /api/admin/bandit/autoseed`** — explicitly seed the bandit (or wait until 04:15 UTC for the cron)
5. **`/trust/crypto`** — share the public URL with investors / auditors
6. **`scripts/run-eval.mjs --save eval-baseline.json`** — set the eval regression baseline
7. **Subscribe Slack / Telegram / Discord** — paste webhooks into env, redeploy

After this, the platform self-improves overnight. The eval harness runs
at 04:15 UTC, the bandit auto-seeds, the Merkle root publishes, and
alerts fire on regression.

---

## Quick sanity check

After deploying, hit these public endpoints and confirm they return:

| URL                                           | Expected                                                           |
| --------------------------------------------- | ------------------------------------------------------------------ |
| `GET /api/status/metrics`                     | `{ verdict: "ok", windows: { ... } }`                              |
| `GET /api/status/metrics/extended?window=24h` | `{ totalRuns, slowestAgents, busiestAgents, models, costSavings }` |
| `GET /api/trust/snapshot`                     | `{ merkle, cohort, verifier, conformance }` (5-min cache)          |
| `GET /trust/crypto`                           | HTML page rendering the snapshot                                   |
| `GET /trust`                                  | HTML page with SOC 2 posture + framework coverage                  |
| `GET /metrics`                                | HTML page with live performance numbers                            |

All five should respond in < 1 second on a warm deployment.

---

## Things that intentionally don't need configuration

- **Knowledge graph writes** — wired into agent-factory; tables lazy-create on first run
- **Activity bus / war room** — in-process, no infra
- **Memory federation + consolidation** — opt-in per-call; no deploy work
- **Cohort proofs** — deterministic on signed receipts; no setup
- **Auto-bandit seeding** — runs nightly with no env var; first run seeds from observed history
- **Eval baseline** — auto-saves on first cron run; subsequent runs diff against it

---

## If something breaks

Diagnostic endpoints (admin-gated):

| URL                                      | What it surfaces                  |
| ---------------------------------------- | --------------------------------- |
| `/api/admin/eval`                        | Current eval report (heuristic)   |
| `/api/admin/eval?judge=llm`              | LLM-graded eval                   |
| `/api/admin/sessions`                    | Stuck agent sessions              |
| `/api/admin/memories`                    | Memory pool inspection            |
| `/api/admin/knowledge-graph?userId=X`    | Per-user graph summary            |
| `/api/admin/bandit?agent=X`              | Per-agent arm posteriors          |
| `/api/admin/infrastructure`              | Self-host vs managed status       |
| `/api/admin/merkle-root?date=YYYY-MM-DD` | Day-specific Merkle root          |
| `/api/admin/cohort-proof`                | Operator-only secret + commitment |

The above are gated by the email allowlist in each route. Update
those allowlists when team grows.

---

If the deploy is healthy and the cron has fired once, the platform
self-operates. You're done.
