# TIER S Deployment Checklist

> The R27 + elite-tier sprint shipped infrastructure that depends on
> production state changes you must do manually. Until these are
> complete, the elite features are theoretical: the libs fail-open,
> the UI lies about persistence, and the public `/reliability` page
> shows `—` instead of real numbers.
>
> Total time: **~45 minutes**.

## ⚡ Step 0 — Self-service diagnostic (60 seconds)

Before anything else, hit the **diagnostic endpoint** to see exactly
what's broken in your specific deploy:

```bash
curl https://sovereignmatrix.agency/api/health/diagnose | jq .
```

This returns:
- Every boot-required env var with present/missing
- DB reachability with the verbatim SQL error
- Every expected table with found/missing
- Migration files that need to run
- Specific actionable hints

If you're staring at a "production is broken, where do I start?"
moment, this endpoint is the answer. It's the difference between
guessing and knowing.

### Example output when broken

```json
{
  "status": "broken",
  "summary": "Database unreachable.",
  "hints": [
    "Database unreachable (ep-xxx.us-east-2.aws.neon.tech). Common causes: (1) Neon branch paused — wake via dashboard or new connection. (2) DATABASE_URL points at wrong branch. (3) sslmode=require missing from URL.",
    "Run pending migrations: 0042_platform_health_and_cost_runaway.sql, 0043_agent_traces.sql, 0044_agent_spend_authorizations.sql"
  ],
  "database": {
    "reachable": false,
    "error": "Connection terminated unexpectedly",
    "host": "ep-xxx.us-east-2.aws.neon.tech"
  }
}
```

## 1 — Apply pending migrations (15 min)

13 migrations (0030–0042) are unapplied per `docs/HONEST-GAPS.md`.
A one-shot runner exists; run it once with prod `DATABASE_URL`:

```bash
DATABASE_URL='postgresql://USER:PASSWORD@HOST.neon.tech/sovereign?sslmode=require' \
  node scripts/apply-prod-migrations.mjs
```

The runner is idempotent (every migration uses `IF NOT EXISTS`), records
applied migrations in `_sovereign_applied_migrations`, and asks for
confirmation before writing. Pass `--yes` to skip the prompt for CI use.

**Verify success:**

```sql
SELECT filename, applied_at, duration_ms
FROM _sovereign_applied_migrations
ORDER BY applied_at DESC;
```

Expected: 13 rows for 0030 through 0042.

## 2 — Disable Vercel Deployment Protection (1 min)

Vercel Dashboard → Project Settings → Deployment Protection
→ "Only Preview Deployments"

While SSO is on for production, **every URL returns 401** to anyone
not signed into your Vercel team. The `/reliability` page, the
`/api/health/permanence` endpoint, and the public landing are all
blocked.

**Verify:** `curl -I https://sovereignmatrix.agency/api/health/ping`
should return `200`, not `401`.

## 3 — Required environment variables (10 min)

Vercel Dashboard → Project Settings → Environment Variables.

### Boot-required (platform refuses to start without these)

| Variable | Why | How |
|---|---|---|
| `DATABASE_URL` | Neon Postgres pooler URL | Already set if migrations work |
| `CLERK_SECRET_KEY` | Server auth | Clerk dashboard |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Client auth | Clerk dashboard |
| `ENCRYPTION_KEY` | AES-256-GCM at-rest encryption (BYOK + OAuth) | `openssl rand -hex 32` |
| `CRON_SECRET` | Bearer for cron-gated routes | `openssl rand -hex 32` |

### Strongly recommended

| Variable | Why |
|---|---|
| `SENTRY_DSN` | Production crashes invisible without it |
| `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` | Billing breaks without |
| `STRIPE_PRICE_*` | Checkout fails without IDs (one per tier) |
| ≥1 AI provider key | NIM/Anthropic/Gemini/Groq/Cerebras |

### Stripe price IDs (paid tiers depend on these)

For each plan in `src/lib/plans.ts` other than `free`, set the
corresponding price ID:

| Tier | Variable |
|---|---|
| Starter ($19) | `STRIPE_PRICE_STARTER` |
| Growth ($49) | `STRIPE_PRICE_ARRAY` |
| Node ($199) | `STRIPE_PRICE_NODE` |
| Enterprise ($499) | `STRIPE_PRICE_ENTERPRISE` |

Get the IDs from Stripe Dashboard → Products → click each → "Pricing".

## 4 — Verify the site is live + green (5 min)

```bash
# Health ping
curl https://sovereignmatrix.agency/api/health/ping
# Expected: { "status": "healthy", "db": "connected", ... }

# Public permanence surface
curl https://sovereignmatrix.agency/api/health/permanence
# Expected: full JSON with non-null healthSnapshot after first cron run

# Reliability page
open https://sovereignmatrix.agency/reliability
```

The `/reliability` page should show real numbers within ~1h of the
self-heal cron's first run (it fires `0 * * * *` UTC). Until then,
the headline shows `—` honestly per Constitution Principle 5.

## 5 — Optional: tighten security posture

| Variable | Effect |
|---|---|
| `SOVEREIGN_FREE_ONLY=true` | Strips paid providers from the failover chain (free-tier guarantee) |
| `SOVEREIGN_APPROVAL_POLICY=trust-tiered` | Marketplace approvals — only after operator review routinely clears <24h |
| `DATA_SOVEREIGNTY_MODE=eu` | Restricts model selection to EU-resident providers |

## 6 — Verify migrations actually persist data

After ≥1 hour (so the self-heal cron has fired):

```sql
SELECT count(*) FROM platform_health_snapshots;
-- Expected: ≥ 1
```

After ≥1 agent run from any logged-in user:

```sql
SELECT user_id, day, cost_cents, run_count, paused_at
FROM tenant_cost_ledger
WHERE day = CURRENT_DATE;
-- Expected: ≥ 1 row per active user
```

After ≥6 hours (audit-chain verify cron):

```sql
SELECT count(*) FROM audit_logs WHERE row_hash IS NOT NULL;
-- Expected: ≥ 1, growing over time
```

## What's NOT on this checklist

- **Domain DNS** — `sovereignmatrix.agency` already points at Vercel.
- **TLS cert** — auto-managed by Vercel.
- **Database backups** — Neon's continuous backup is on by default;
  see `docs/SUCCESSION.md` for the quarterly verification protocol.
- **Renovate dependency PRs** — already configured in `renovate.json`.

## Rollback plan

If anything breaks:

1. Vercel Dashboard → Deployments → click the previous green deploy → "Promote to Production".
2. The migrations runner is forward-only; rolling back schema requires manual `DROP TABLE` (the migrations don't include down-migrations).
3. The migrations are designed to be **additive**: rolling back the application layer alone (without DROP) leaves the new tables unused but harmless.
