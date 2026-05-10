# SOC 2 Controls Map — Sovereign Matrix

This document maps the SOC 2 Common Criteria (CC1–CC9) to the
implementation in this codebase. It is the evidence pack for a Type 1
attestation. Each control lists: what's required, where it lives in
code, and how to verify it.

## CC1 — Control Environment

| Control               | Implementation                              | Verification                                   |
| --------------------- | ------------------------------------------- | ---------------------------------------------- |
| Code of conduct       | `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md` | Files present at repo root                     |
| Org structure / roles | `src/lib/rbac.ts` (admin, member, viewer)   | Unit tests in `src/__tests__/lib/rbac.test.ts` |
| Background checks     | (Operator policy — out of scope for code)   | HR documentation                               |

## CC2 — Communication and Information

| Control                    | Implementation                                           |
| -------------------------- | -------------------------------------------------------- |
| Incident reporting channel | `/security` page + `SECURITY.md` (security@…)            |
| Status page                | `/status` (live), updated within 30 min of incident      |
| Customer support routing   | `/contact` form → posts to `audit_logs` table            |
| Privacy notice             | `/privacy` page + `/sub-processors` for upstream vendors |

## CC3 — Risk Assessment

| Control             | Implementation                                                       |
| ------------------- | -------------------------------------------------------------------- |
| Threat model        | `docs/audits/security-review-2026-05.md` and prior round audits      |
| Vulnerability scans | `npm audit --audit-level=high` in CI (`.github/workflows/ci.yml`)    |
| Dependency review   | Dependabot + `security-reviewer` agent on every PR touching API/auth |

## CC4 — Monitoring Activities

| Control               | Implementation                                                              |
| --------------------- | --------------------------------------------------------------------------- |
| Continuous monitoring | Sentry (`sentry.{server,client,edge}.config.ts` + `src/instrumentation.ts`) |
| Synthetic monitoring  | Smoke tests in `tests/smoke/` (Playwright), runs on every push              |
| Log retention         | Vercel runtime logs (90 d) + `audit_logs` table (unbounded)                 |
| Anomaly detection     | `src/lib/agent-circuit-breaker.ts` opens circuits on 5+ failures/min        |

## CC5 — Control Activities

| Control                 | Implementation                                                             |
| ----------------------- | -------------------------------------------------------------------------- |
| Segregation of duties   | RBAC via Clerk + `src/lib/rbac.ts`; admin actions require `requireAdmin()` |
| Change management       | Branch protection on `main`; PRs require lint + typecheck + tests green    |
| Pre-deploy verification | `/deploy-check` skill (CLAUDE.md gate) before any merge to `main`          |

## CC6 — Logical and Physical Access

| Control                         | Implementation                                                             |
| ------------------------------- | -------------------------------------------------------------------------- |
| MFA on all admin accounts       | Enforced via Clerk org settings                                            |
| API authentication              | `src/lib/auth-guard.ts` (`requireAuth`) on every authenticated route       |
| API authorization               | `src/lib/paywall.ts` (`checkAgentAccess`) + `src/lib/rbac.ts`              |
| Encryption at rest              | Neon Postgres (AES-256), API key columns encrypted via `src/lib/crypto.ts` |
| Encryption in transit           | Vercel-enforced HTTPS; HSTS header (`next.config.ts:headers()`)            |
| Session management              | Clerk JWT, 24h expiry, server-validated on each request                    |
| Webhook signature verification  | Stripe / Clerk / HubSpot / Cal.com / Yoco / Telegram / Twilio              |
| Replay protection               | `src/lib/idempotency.ts` against `audit_logs.eventId`                      |
| Rate limiting                   | `src/lib/rate-limit.ts` (Upstash) on auth + agent routes                   |
| Right of access (data subject)  | `GET /api/me/export` — 30 user-keyed tables, audit-logged                  |
| Right to erasure (data subject) | `POST /api/me/delete` — strict confirm body + cascade                      |

## CC7 — System Operations

| Control                | Implementation                                                      |
| ---------------------- | ------------------------------------------------------------------- |
| Backup                 | Neon point-in-time recovery (7 d on Pro)                            |
| Disaster recovery      | DB restore runbook in `docs/runbooks/dr.md`; RPO 1h, RTO 4h         |
| Capacity / autoscaling | Vercel auto + Neon serverless scale-to-zero                         |
| Performance monitoring | Sentry + SLO doc (`docs/slo.md`)                                    |
| Patch management       | Dependabot weekly; CI fails build on `npm audit --audit-level=high` |

## CC8 — Change Management

| Control                  | Implementation                                                  |
| ------------------------ | --------------------------------------------------------------- |
| SDLC                     | GitHub PR-based; `main` is protected                            |
| Test coverage            | 1200+ vitest cases; coverage on `src/lib/**` + `src/app/api/**` |
| Pre-deploy gate          | Lint + typecheck + tests + build all green                      |
| Post-deploy verification | Smoke tests on Vercel preview + prod URLs                       |

## CC9 — Risk Mitigation

| Control             | Implementation                                                   |
| ------------------- | ---------------------------------------------------------------- |
| Vendor management   | `/sub-processors` page lists every data-handling vendor          |
| Insurance           | (Operator policy)                                                |
| Business continuity | Multi-region failover via Vercel; Neon read-replica configurable |

## Trust Services Criteria — beyond CC

| Criterion                | Evidence                                                                                                                                       |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Security**             | All of CC6 above; `output-verifier` defaults ON for all 127 agent routes; jailbreak detection + content safety pre-flight                      |
| **Availability**         | `docs/slo.md`; Sentry alerts; status page; circuit breakers                                                                                    |
| **Confidentiality**      | API keys encrypted at rest; no PII in logs (regex-redacted on output via `output-verifier.ts`); Sentry sends scrubbed events                   |
| **Processing Integrity** | Verifiable agent receipts (`/r/[id]`) — every output is HMAC-signed and tamper-evident; idempotent webhooks; transaction-wrapped credit grants |
| **Privacy**              | GDPR Art. 15/17/20 + POPIA s.23/24 endpoints (`/api/me/export`, `/api/me/delete`); `audit_logs` records every data-touching action             |

## Audit-time evidence collection

| Auditor asks for…                       | Provide…                                                        |
| --------------------------------------- | --------------------------------------------------------------- |
| Sample of access reviews                | Clerk org admin → Members → CSV export                          |
| Sample of webhook signature checks      | `git log` on `src/app/api/_webhooks/*/route.ts`                 |
| Sample of agent runs with safety log    | `SELECT * FROM agent_runs ORDER BY created_at DESC LIMIT 50;`   |
| Sample of right-to-access fulfillments  | `SELECT * FROM audit_logs WHERE action='data.export' LIMIT 50;` |
| Sample of right-to-erasure fulfillments | `SELECT * FROM audit_logs WHERE action='data.delete' LIMIT 50;` |
| Incident records                        | `docs/post-mortems/`                                            |
| Changes to production                   | `git log main` + linked PRs                                     |

## What this codebase doesn't yet have (gaps for Type 2)

These are **honest** gaps. Type 1 attestation is achievable today;
Type 2 (continuous evidence over 6+ months) needs:

- [ ] Quarterly access reviews — automate Clerk org → CSV → archive
- [ ] Annual penetration test — engage external firm
- [ ] Vendor SOC 2 reports collected for every sub-processor on `/sub-processors`
- [ ] Documented incident response drill (annual game-day)
- [ ] Encryption key rotation policy + log
- [ ] Background-check policy for engineering hires
