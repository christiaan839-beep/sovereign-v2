# Succession Plan — How the Platform Continues Without Me

> **The bus-factor doc.** If the founder is unreachable tomorrow,
> this document is what a new maintainer reads to keep the platform
> running, the customers served, and the lights on.
>
> Updated: 2026-04-28 (Round 27 — Permanence Sprint).

---

## The 30-second handover

You are now responsible for Sovereign Matrix. The platform is a
multi-tenant agent operating system on Vercel + Neon Postgres. It
runs 223 production AI agents through 39+ models for paying
customers under flat-rate plans.

**The first 24 hours of stewardship**:

1. **Verify nothing is on fire** — run `node scripts/weekly-health.mjs`.
   Should exit 0 with all 141 invariants green. If not, something
   regressed; see "When something is on fire" below.
2. **Confirm you have access to the secrets** — see "Secrets &
   credentials" below.
3. **Read the Constitution** — `docs/PROJECT-CONSTITUTION.md`. The
   7 principles are the appellate court for every decision.
4. **Read this document end-to-end** — yes, all of it.
5. **Run a deploy to verify the path works** — see "Deploying" below.

The platform has been engineered to keep running with zero human
attention for weeks. The crons fix orphans, the audit chain
self-verifies, the anti-drift gate blocks regressions, the outbox
drainer catches transient failures. **Don't panic. The platform is
designed to survive your absence.**

---

## The architecture in one paragraph

Next.js 16 / React 19 frontend on Vercel. API routes in
`src/app/api/**/route.ts`. Agents live in `src/app/api/_agents/`
and are dispatched via the static registry in `registry.ts`. Every
agent goes through `createAgentRoute` (auth, rate limit, plan check,
5-layer safety pipeline, audit log, circuit breakers). Postgres
(Neon serverless) for everything durable. 41 migrations on disk.
Clerk for auth. Stripe for billing. Upstash Redis for rate limits.
Sentry for error tracking. Vercel Cron for periodic jobs. The full
shape is in `docs/ARCHITECTURE.md`.

---

## Secrets & credentials

You will need access to:

1. **GitHub** — push access to the repo. Deploy hook from `main` to Vercel.
2. **Vercel** — production project. Env vars, deployments, crons.
3. **Neon** — production Postgres. `DATABASE_URL` lives in Vercel env.
4. **Clerk** — production org. Auth, user roles, webhooks.
5. **Stripe** — production account. Webhook to `/api/_payments/stripe/webhook`.
6. **Sentry** — production project.
7. **Upstash** — Redis for rate limits.
8. **Resend** — transactional email.
9. **NVIDIA NIM** — primary model provider.
10. **Anthropic** — Claude API (safety critic + select agents).
11. **Google Gemini** — secondary provider.

Full env-var surface in `src/lib/env.ts`. The boot-required set
(below) is enforced by `assertProductionRequiredEnv()`.

If you don't have a credential: contact `christiaan@sovereignmatrix.agency`.
If unreachable: each provider has a "lost access" recovery flow
(typically requires confirming domain ownership). Domain WHOIS at
the registrar.

---

## Production envs (must be set, or the platform refuses to boot)

`assertProductionRequiredEnv()` boot-fails the platform if these are missing:

- **`ENCRYPTION_KEY`** — 64-char hex, AES-256-GCM. Encrypts OAuth + BYOK at rest.
  *Critical*: rotation requires `ENCRYPTION_KEY_PREVIOUS` simultaneously.
- **`CRON_SECRET`** — bearer for cron-only routes. ≥16 chars.
- **`DATABASE_URL`** — Neon Postgres pooler URL.
- **`CLERK_SECRET_KEY`** — Clerk server secret.
- **`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`** — Clerk frontend.

Strongly recommended:
- `SENTRY_DSN` — production crashes invisible without it.
- `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` — billing breaks without these.
- `STRIPE_PRICE_*` — checkout fails without these.
- ≥1 AI provider key — agents won't run without one.

---

## Pending migrations (the launch blocker)

Per `docs/HONEST-GAPS.md`, **not all migrations have been applied to prod**:

```bash
psql $DATABASE_URL < drizzle/0030_agent_bundles.sql
psql $DATABASE_URL < drizzle/0031_webhook_subscriptions.sql
# ... through 0041_hitl_and_execution_audit.sql
```

Until 0030–0041 are applied, every "saved ✓" UX is a lie at the
persistence layer. The platform fails-silent, so users can't tell.

---

## Deploying

GitHub-native deploys (NOT `vercel deploy --prebuilt` — file
resolution breaks).

1. PR → review → merge to `main` (or `claude/wizardly-benz`).
2. Vercel auto-deploys. Watch at `https://vercel.com/<org>/<project>`.
3. Run `node scripts/weekly-health.mjs` against prod after deploy.
4. If anti-drift fails, ROLLBACK immediately via Vercel UI.

**Never bypass the anti-drift gate.** The 141 invariants enforce
the project's identity (per the Constitution). A merge that
disables them silently is a violation.

---

## When something is on fire

### "The site is down"

1. Check `https://www.vercel-status.com/` and `https://neonstatus.com/`.
2. Check Sentry for production errors.
3. `curl https://sovereignmatrix.agency/api/health/ping` — 200 = up; 503 = DB unreachable.
4. If a recent deploy is the cause: ROLLBACK first, investigate later.

### "A customer says their playbook didn't run"

1. Look up the run in `playbook_dag_runs` by `userId`.
2. `status = 'running'` for >10 min: orphan-cleanup cron reaps it within 5 min.
3. `status = 'failed'`: check `failedAt` + `results[].error`.
4. Check `audit_logs` for the run lifecycle.

### "Bills are way higher than expected"

`cost-runaway.ts` defends against this. If hitting it anyway:

1. Per-tenant cost rollup in admin dashboard.
2. Identify the abusive tenant. Pause via Stripe.
3. Single-agent cause: check `executionAudit` for high-token rows.
4. Worst case: rotate provider API keys via the provider's dashboard.

### "Security alert"

1. **Audit chain broken** (`/api/cron/verify-audit-chain` returns
   500): use `verifyAuditChain()` to find the broken row. Investigate
   DB write access.
2. **Boot fail on `assertProductionRequiredEnv`**: required env removed; restore.
3. **PII leak by `pii-guard`**: tighten `piiGuardMode` to "mask".
4. **CSRF reject (403)**: bot or legit edge case (preview URL not allowlisted).

---

## Incident response

**Severity-1 (down)**: ack 15 min, mitigate before investigate, roll back if recent deploy. Post-mortem 48h. ADR if architectural.

**Severity-2 (degraded)**: ack 1h, mitigate 8h. Post-mortem 1 week.

**Severity-3 (annoying)**: ack 24h. File issue with reproducer.

The platform is designed for SEV-3 to be most common. SEV-1 has been
zero in project history; if you see one, it's a real event.

---

## Routine operations (the calendar)

| Cadence | What |
|---|---|
| Every minute | job-runner, sweep-expired-holds, dispatch-scheduled-playbooks, drain-usage-outbox |
| Every 5 min | playbook-scheduler, dag-orphan-cleanup, prune-hitl-approvals, health/ping |
| Every 6 hours | run-evals, verify-audit-chain |
| Daily 7am UTC | daily-digest |
| Daily 4am UTC | rollup-agent-stats |
| Weekly Mon 8am | weekly-report |
| Weekly Mon 9am | slo-weekly |
| Sunday 3am | cleanup |
| Hourly (R27) | self-heal anti-drift gate |
| On every PR | anti-drift, tests, typecheck, lint |
| Quarterly (manual) | DB backup verification |
| Quarterly (manual) | Pen test (Cobalt / Bishop Fox / NCC) |
| Annually | SOC 2 Type II audit |

---

## What lives where (code map)

```
src/
  app/api/_agents/         223 agent route files (THE PRODUCT)
  app/api/agents/          Public agent gateway
  app/api/cron/            Vercel-scheduled jobs
  app/api/_misc/           Catch-all routes
  app/dashboard/           Authenticated UI
  lib/
    plans.ts               Pricing tiers (canonical)
    platform-stats.ts      Numeric claims (single source)
    agent-factory.ts       The factory ALL agents pass through
    auth-guard.ts          requireAuth + requireSameOrigin
    audit-log.ts           SHA-256 hash chain
    output-verifier.ts     5-layer safety pipeline
    response-attestation.ts  HMAC-signed agent output
    crypto.ts              AES-256-GCM at-rest encryption
    safe-fetch.ts          SSRF-guarded outbound HTTP
    cron-auth.ts           verifyCron (timing-safe)
    cost-runaway.ts        Per-tenant cost ceiling
    advisory-lock.ts       pg_try_advisory_lock helper
    usage-outbox.ts        Counter-recovery drainer
    hitl-approval.ts       Durable HITL queue
    execution-audit.ts     Durable per-agent audit
    pii-guard.ts           Output PII scrubber
    api-key-scopes.ts      Per-key scope enforcement
    ssrf-guard.ts          Cloud-metadata blocker
  db/schema.ts             Drizzle table definitions (canonical)
docs/
  PROJECT-CONSTITUTION.md  7 immutable principles
  SUCCESSION.md            This document
  ARCHITECTURE.md          System architecture
  HONEST-GAPS.md           What's NOT solid
  WHATS-NOT-ELITE.md       Unfinished roadmap
  THREAT_MODEL.md          STRIDE security model
  SOC2-PRE-READINESS.md    Compliance map
  RUNBOOK.md               Ops runbook
  adr/                     Architecture Decision Records
drizzle/                   SQL migrations (41 files)
scripts/
  weekly-health.mjs        141 anti-drift invariants (CI gate)
  generate-changelog.mjs   Auto-generated CHANGELOG (R27)
```

---

## Backup verification (quarterly)

Neon has continuous backup. Verify quarterly:

1. Branch prod into `restore-test-YYYY-Q` in Neon.
2. Connect a dev instance to the restore branch.
3. Run `npm run dev`; verify auth, agent execution, playbook save.
4. Document gaps in `docs/runbooks/backup-verification-YYYY-Q.md`.
5. Delete the restore branch.

---

## Customer support

No full-time support team. `support@` goes to the founder. If
stewarding solo:

1. Refunds + billing → Stripe customer portal (already wired).
2. Bugs + feature requests → GitHub issues.
3. Critical bugs (data loss, billing error) → personal reply within 24h.

---

## Decision authority

- **Day-to-day technical** (model choice, library): maintainer's call.
- **Architectural** (data model, public contract): ADR in `docs/adr/`.
- **Constitutional** (amends a Principle): ADR + 14-day comment period.
- **Pricing / business**: lives in `plans.ts` + `/pricing` page;
  business authority owns the corporate entity.

---

## Final notes

- **Read the Constitution before changing anything.** Many decisions
  that look strange (no-DB fallback in every store, hash-chained
  audit log) are consistent applications of the 7 principles.
- **Run the anti-drift gate before every commit.** Fast, catches
  more than you expect.
- **`HONEST-GAPS.md` and `WHATS-NOT-ELITE.md` are not aspirational
  — they're real lists.** Trust them.
- **The code outlasts the founder.** That's the design. You're
  inheriting a project built to be inheritable.

Good luck. The platform is in your hands.
