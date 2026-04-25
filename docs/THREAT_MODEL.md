# Sovereign Matrix — Threat Model

**Version:** 1.0 · **Last reviewed:** 2026-04-25 · **Owner:** security@sovereignmatrix.agency

This document is the public-facing threat model that enterprise procurement
teams routinely ask for during vendor security review. Every claim has a
file path or commit hash so the artifacts are independently verifiable on
GitHub. The scope mirrors the deployed surface — Next.js 16 app on Vercel,
Postgres on Neon, Clerk auth, NVIDIA NIM + Anthropic + Google Gemini for
LLM inference.

We use the STRIDE taxonomy (Spoofing / Tampering / Repudiation / Info
Disclosure / DoS / Elevation of Privilege) because it maps cleanly onto
the surfaces that customers care about. Each section ends with **how this
is enforced today** + **residual risk** so you can read it without taking
us on faith.

---

## Trust boundaries

```
┌──────────────────┐                      ┌──────────────────┐
│  End-user (UA)   │ ──HTTPS/TLS 1.3────► │   Vercel Edge    │
└──────────────────┘                      │  (CDN / WAF)     │
                                          └────────┬─────────┘
                                                   │
                                                   ▼
                                          ┌────────────────────┐
                                          │  Next.js Functions │
                                          │  (Node 22 runtime) │
                                          └─┬────┬────┬────┬──┘
                                            │    │    │    │
                ┌───────────────────────────┘    │    │    └─────────┐
                ▼                                ▼    ▼              ▼
       ┌───────────────┐               ┌───────────────┐   ┌──────────────────┐
       │  Clerk SSO    │               │  Postgres     │   │  LLM providers   │
       │  (Auth0-tier) │               │  (Neon, US)   │   │  (NIM/Claude/    │
       └───────────────┘               └───────────────┘   │   Gemini/Groq)   │
                                                            └──────────────────┘
```

Inside Vercel Functions: Node 22 with `serverExternalPackages` for the
DB driver + Pinecone + Twilio. CSP, HSTS, COOP, Permissions-Policy
applied via `next.config.ts`. Outbound to LLM providers is whitelisted
in `connect-src https: wss:`.

---

## STRIDE

### S — Spoofing identity

**Threat:** an attacker authenticates as another user.

**Surfaces:** Clerk session cookies, API tokens (`sk_*`), webhook senders
(Stripe, Yoco, Slack).

**Controls:**
- Clerk JWT-backed sessions with short TTL + automatic rotation
  (`@clerk/nextjs`).
- Platform API tokens stored as SHA-256 hashes only — raw token never
  persisted (`src/app/api/_tokens/route.ts:50`). Format `sk_{plan}_{32-char}`
  matches GitHub PAT entropy.
- API tokens revocable via DELETE; revocation cached out within 5 min
  via the LRU TTL in `/api/v1/[...path]/route.ts`.
- Webhook signature verification on every inbound (Stripe HMAC-SHA256;
  Yoco signature; Slack signing secret) before any state mutation.

**Residual:** until 2FA is mandatory for all users, a compromised
password + verified email still grants access. We mitigate with
device-fingerprint anomaly detection in Clerk's session events.

### T — Tampering with data

**Threat:** an attacker (or an insider) modifies persisted data — the
audit trail, an agent's response, a billing event — to hide their
actions.

**Surfaces:** Postgres rows, in-memory caches, audit log.

**Controls:**
- **Audit log hash chain (`src/lib/audit-log.ts`).** Every audit row's
  `row_hash = sha256(prev_hash | userId | action | resource | details |
  createdAt)`. Any in-place edit produces a verifier mismatch. Three
  unit tests (`src/lib/__tests__/audit-log.test.ts`) literally mutate
  captured rows in three different ways and prove the verifier flags
  the exact broken row id.
- **Continuous monitoring.** `/api/cron/verify-audit-chain` runs every
  6 h via Vercel Cron, returns 500 + ERROR log on a chain break.
- **PII output guard.** Every agent's structured output passes through
  `scrubPiiDeep` (regex + Luhn) so a tampered prompt that exfiltrates
  SSN/CC/phone/email still gets masked at the boundary.
- **Cache TTL bounds.** API key validation cache holds full
  `ApiKeyRecord` for 5 min — a revoked key is gone from every Vercel
  instance within that window.

**Residual:** Postgres-level row deletion (vs. modification) isn't
detected by the chain — we rely on database-level
backup-and-point-in-time-recovery (Neon's PITR) for that. SOC-2 Type II
assessment in progress; auditor will validate the backup posture.

### R — Repudiation

**Threat:** a user disputes an action they actually took.

**Controls:**
- Every state-changing action goes on the hash-chained audit log:
  agent execution, API key mint/revoke/rotate, settings update,
  data export/delete, admin moderation (approve/reject submission),
  billing webhooks. Adding new audit verbs is one-line in
  `AuditAction` (`src/lib/audit-log.ts:8`).
- Audit row carries `userId`, `ipAddress`, ISO timestamp, `details`
  payload, and the hash chain. The `details` field is part of the
  hash, so a creator disputing "what reason was given for my
  rejection?" is settled by the immutable record, not the DB row.

**Residual:** the user's IP is captured from `x-forwarded-for` (Vercel-
managed); a proxy chain in front of Vercel could deceive this. Operators
who care about chain-of-custody can plug in their own ingress and pass
authenticated headers.

### I — Information disclosure

**Threat:** a user (or attacker) sees data they shouldn't — another
tenant's leads, an admin's audit log, a third-party's PII.

**Surfaces:** API responses, error messages, AI agent outputs, log files,
exported files.

**Controls:**
- **Multi-tenant isolation.** Every DB query in `src/db/queries.ts`
  scopes by `tenantId` via `requireTenantId()` / `belongsToTenant()`
  (`src/lib/tenant-scope.ts`).
- **Per-agent API key scopes.** `agent:execute:<slug>` lets an enterprise
  cap a CI key to a single agent. `allowed_ips` (CIDR) caps a key to a
  network.
- **PII output guard** masks SSN/CC/phone/email even when the LLM ignores
  the prompt-level rule. Per-agent `piiGuardMode` ("flag" for resume-
  normalizer + business-card-reader where contact info is the intended
  output).
- **Admin endpoints 404 for non-admins** (`requireAdmin()` →
  `notFound()`). Non-admins can't even confirm an admin endpoint exists.
- **Error responses use structured codes** (`src/lib/error-codes.ts`)
  rather than leaking internal paths or stack traces.
- **CSP** with `frame-ancestors 'none'` + `object-src 'none'` blocks
  iframe-based exfil and embedded plugins.

**Residual:** customer-supplied LLM prompts can include their own PII;
we scrub on output but the LLM provider sees the full input. Enterprises
that need on-prem inference run NemoClaw (no data leaves perimeter).

### D — Denial of service

**Threat:** a single bad actor exhausts platform resources.

**Controls:**
- **Per-key rate limit** with sliding window (`src/lib/rate-limit.ts`),
  Upstash-Redis-backed when configured, in-memory fallback. Rule
  matcher honors per-route overrides.
- **Function timeout.** Vercel functions cap at 60 s; v1 proxy has its
  own 50 s `AbortSignal.timeout` so a hung internal agent can't consume
  the entire caller budget.
- **Circuit breakers.** Per-provider (`anthropic-claude`, `openai`,
  `gemini-pro`, etc.) so a degraded upstream auto-trips, freeing
  throughput for healthy paths.
- **CSP `upgrade-insecure-requests`** prevents protocol downgrade
  attacks that would otherwise force a re-handshake.

**Residual:** we don't yet operate distributed-DoS-grade scrubbing
(Cloudflare-tier). Vercel's edge absorbs L4 and basic L7. Customers
with elevated DoS risk should pair with Cloudflare in front of their
custom domain.

### E — Elevation of privilege

**Threat:** a normal user (or compromised key) gains admin power, or
an admin's actions exceed their intended scope.

**Controls:**
- **Two-tier admin allowlist.** `ADMIN_USER_IDS` env var → `requireAdmin()`
  (`src/lib/admin-auth.ts`). Allowlist is fail-closed (a typo in env var
  means nobody is admin — better than a typo silently granting access).
- **Admin actions still go on the audit chain** with explicit verbs
  (`admin.submission_approve`, `admin.submission_reject`). No "admin
  free-action" — every admin act is recorded.
- **Per-agent + per-IP scope on API keys.** Even an enterprise admin
  can't bypass scope evaluation — that's a pure-function check
  (`evaluateScope()` in `src/lib/api-key-scopes.ts`) called before
  every v1 request.
- **No service-to-service shared secret with elevated privileges.**
  Internal v1 routing uses `X-Sovereign-Internal` marker on a single-hop
  same-origin fetch; it can't escalate cross-tenant.

**Residual:** Clerk's organization-level role model is RBAC-native;
we override it for admin actions with the env-var allowlist. If Clerk
roles are misconfigured (e.g. wrong "Owner" assignment in a customer
org), users in that org can act with elevated scope **inside** the org.
We document this in onboarding.

---

## What's NOT in scope

- **Out-of-scope but related:** Clerk-side authentication issues (they
  have their own bug bounty); Stripe/Yoco-side payment processing
  (those vendors carry PCI DSS).
- **Shared-responsibility:** customers control their own LLM provider
  API keys via BYOK. A leaked customer key compromises only that
  customer's quota, not their data — keys are encrypted at rest with
  AES-256 (`src/lib/crypto.ts`).
- **Operational, not architectural:** we don't claim to detect a
  Vercel-side intrusion (their security boundary). For deployments
  where that's a concern, NemoClaw on-prem mode applies.

## How to verify these claims

Every file path in this doc is a real file in the public GitHub repo:
github.com/christiaan839-beep/sovereign-v2

For a one-shot end-to-end check: clone, run `node scripts/weekly-health.mjs`.
The script outputs **43 invariants** including artifact presence and
wiring-content matches. A green run is the same evidence we use
internally to decide a PR is mergeable.

To audit the audit chain: run the integration tests with `npx vitest run
src/lib/__tests__/audit-log.test.ts --reporter=verbose`. The suite
literally mutates captured rows in three distinct tampering scenarios
and asserts the verifier catches each.

## Reporting issues

Found something not in this model? **security@sovereignmatrix.agency**.
Full vulnerability disclosure terms: `/.well-known/security.txt`.
Published case-study ledger: `/trust/defenders`.

---

*Reviewed quarterly. Next review: 2026-Q3.*
