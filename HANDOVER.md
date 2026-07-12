# HANDOVER.md — Bus-factor runbook

This file is what someone else opens on day one if Christiaan can no
longer ship to this codebase. Read it top to bottom, then you can
keep the platform alive without further context.

The cryptographic guarantees of the platform — Ed25519 / ML-DSA-65
receipt signatures, Bitcoin anchoring — survive without any human
intervention. They are mathematical, not operational. **What
requires a human is everything else.** This document is that
everything.

Last updated: 2026-05-17 (Wave 38). Update when surface or
credential ownership changes.

---

## 0. Emergency one-pager

If you have 60 seconds, this is what matters:

| Job                                 | First thing to read           |
| ----------------------------------- | ----------------------------- |
| Site is down                        | §6 (incident response)        |
| Stripe webhook is broken            | §5 (revenue path)             |
| Database is on fire                 | `docs/runbooks/db-down.md`    |
| A regulator is asking for proof     | §7 (signed-receipt forensics) |
| You need to pay AWS / Vercel / Neon | §4 (billing accounts)         |
| OSS package needs a patch release   | §9 (npm publish)              |
| A user wants their data deleted     | §8 (GDPR / POPIA DSAR)        |

If you have 5 minutes, read sections 1, 2, 6, and 11.

---

## 1. What this codebase is

`sovereign-v2` is a Next.js 16 / React 19 multi-tenant AI agent
platform that produces cryptographically signed receipts for every
AI run. The moat is **verifiability**: any auditor with the
published Ed25519 public key can independently re-derive the math
on a receipt without trusting this platform's infrastructure.

The repo also contains two open-source npm packages:

- `@sovereign-matrix/verifiable-receipts` — pure-TS toolkit
  implementing the receipt primitives (Apache-2.0). This is the
  reference implementation of the VAOS 2.0 / 3.0 specs in
  `docs/specs/`.
- `@sovereign-matrix/agent-sdk` — typed client for the platform
  (Apache-2.0).

Both packages live in `packages/`. If the SaaS dies, the OSS
packages survive on npm and any vendor can verify Sovereign-issued
receipts forever. **That is the durability promise.**

---

## 2. Branch + deployment surface

- **Default branch:** `main`. Merges deploy to production on Vercel.
- **Active dev branch (May 2026):** `claude/complete-project-74XPN`.
  This is the branch all recent waves (36–38) have shipped to. Merge
  to `main` when ready.
- **Production URL:** https://sovereignmatrix.agency
- **Vercel project:** `sovereign-matrix` (one project, one
  production deploy, one preview deploy per PR).
- **Source of truth for what's deployed:**
  `https://sovereignmatrix.agency/api/built/ledger` — signed
  shipped-work ledger, returns the last N wave commits.

If you need to know "is the deploy fresh?", `curl` the ledger.

---

## 3. Credentials inventory

The minimum set required to keep the platform running. **None of
these live in this repo** — they live in Vercel Project Settings,
Clerk Dashboard, Stripe Dashboard, etc. Christiaan's password
manager is the master source.

| Service                   | Where it lives                                     | Without it, what breaks                             |
| ------------------------- | -------------------------------------------------- | --------------------------------------------------- |
| Vercel (deploys)          | https://vercel.com/dashboard                       | No deploys. Production stays at last build.         |
| Neon (Postgres)           | https://console.neon.tech                          | Every DB read/write fails. Site loads, queries 5xx. |
| Clerk (auth)              | https://dashboard.clerk.com                        | Nobody can sign in. Anonymous routes still work.    |
| Stripe (revenue)          | https://dashboard.stripe.com                       | No new subscriptions; existing subs continue.       |
| Resend (email)            | https://resend.com                                 | Onboarding + transactional email silent.            |
| Cloudflare (DNS, CDN)     | https://dash.cloudflare.com                        | DNS resolution stops if records expire.             |
| GitHub (source + CI)      | https://github.com/christiaan839-beep/sovereign-v2 | No deploys, no PRs, no issues.                      |
| Sentry (errors)           | https://sentry.io                                  | Errors still happen, just nobody sees them.         |
| npm (OSS publish)         | https://www.npmjs.com/org/sovereign-matrix         | Can't publish OSS patches.                          |
| Bitcoin OTS anchor wallet | self-custodial — see §7                            | Anchor cron fails; existing anchors stay valid.     |

For each, the recovery codes / backup MFA tokens are in
Christiaan's Bitwarden vault (master shared with [TODO: name a
co-trustee here when you have one]).

**Action item for a new operator:** rotate every credential above
on day one. The platform survives the rotation because every
secret is read from environment variables in Vercel — there are no
hardcoded keys in the source.

---

## 4. Billing accounts

| Provider     | Billing email                     | Card                | Typical monthly bill (May 2026) |
| ------------ | --------------------------------- | ------------------- | ------------------------------- |
| Vercel       | christiaan@sovereignmatrix.agency | Christiaan personal | ~$20 (Pro)                      |
| Neon         | same                              | same                | ~$19 (Launch tier)              |
| Clerk        | same                              | same                | ~$25 (Pro)                      |
| Stripe       | n/a (Stripe takes from revenue)   | n/a                 | 2.9% + $0.30 per txn            |
| Resend       | same                              | same                | $0 (free tier currently)        |
| Cloudflare   | same                              | same                | $0 (free tier)                  |
| Sentry       | same                              | same                | $0 (developer tier)             |
| AI providers | various                           | Christiaan personal | ~$50–$200, highly variable      |

If billing fails: Vercel pauses the deploy after 7 days, Neon
hibernates the DB after 14 days of non-payment, Clerk lets sign-ins
fail. Total runway from a failed credit card to total platform
outage: **~7 days**. Auto-pay every credential.

---

## 5. The revenue path

The money flow is:

1. User signs in (Clerk).
2. User visits `/pricing`, picks a plan, hits
   `/api/payments/stripe/checkout` which creates a Stripe Checkout
   Session and redirects.
3. Stripe collects the card and fires
   `checkout.session.completed` → POST `/api/payments/stripe/webhook`.
4. The webhook handler verifies the Stripe signature, dedupes the
   `evt_*` id via `src/lib/idempotency.ts`, and writes a row to the
   `subscriptions` table.
5. The user is redirected to `/dashboard` and `plan-enforcement.ts`
   reads the new subscription row on every agent call.

**If revenue is broken, in order of probability:**

- Stripe webhook URL not configured → check Stripe Dashboard
  → Developers → Webhooks. Should point to
  `https://sovereignmatrix.agency/api/payments/stripe/webhook` (no
  underscore — `_payments` is a private folder whose URL 404s; the
  routable path is the `payments/` shim).
- `STRIPE_WEBHOOK_SECRET` env var stale → re-copy from the Stripe
  Webhook details page into Vercel project env.
- Stripe price IDs missing → see `STRIPE_PRICE_*` in
  `.env.example`; create them in Stripe Dashboard and paste IDs
  into Vercel env.
- Idempotency table missing → see `docs/runbooks/db-down.md`.

There are vitest contract tests in
`src/app/api/_payments/stripe/webhook/__tests__/contract.test.ts`
covering bad sig / stale event / duplicate event / happy path /
payment failed. If these are green and revenue is still broken,
the issue is in Stripe Dashboard config, not in the code.

---

## 6. Incident response

The platform has three liveness surfaces:

- `GET /api/health/ping` — process is up
- `GET /api/health/ready` — all critical dependencies green
  (Clerk, DB, signing secret). 200 if ready=true, 503 if not.
- `GET /api/status/metrics` — production p50/p95/p99 over 24h

For a "site is slow / down" incident:

1. `curl https://sovereignmatrix.agency/api/health/ping` → if 5xx,
   the Next.js process is failing. Check Vercel deploy logs.
2. `curl https://sovereignmatrix.agency/api/health/ready` → if 503,
   the JSON body tells you which dependency is down.
3. If DB is down → `docs/runbooks/db-down.md`.
4. If Clerk is down → `docs/runbooks/clerk-jwks-failing.md`.
5. If you don't know what's broken, check Sentry for the last 100
   errors, and Vercel's runtime logs for the last 1000 requests.

The platform is designed to **fail soft**: missing DB tables return
empty arrays, missing AI keys fall back through the model cascade,
missing webhook secrets return 503 with a clear error message
rather than silently accepting. So "site is slow" usually doesn't
mean "site is broken" — it usually means one dependency is
degraded but not fatal.

---

## 7. Forensic walkthrough — handing a regulator the receipt

This is the demo every regulated buyer wants to see. Memorize it.

**Setup:** a regulator emails asking "prove that decision X on date
Y was the output of model Z processed under safety pack W". You
have a receipt id.

**Steps:**

1. `curl https://sovereignmatrix.agency/api/verify?receiptId=<id>`
   returns `{ valid: true, scheme: "ed25519" }`. This is the
   convenience verifier — the regulator may not trust your endpoint.
2. Hand the regulator the receipt body + the signature + the
   Ed25519 public key URL:
   `https://sovereignmatrix.agency/.well-known/sovereign-receipts/ed25519.pem`
3. The regulator's expert installs `@sovereign-matrix/verifiable-receipts`
   from npm, downloads the public key, and runs:

   ```bash
   npx @sovereign-matrix/verifiable-receipts verify \
     --manifest ./receipt-bundle.json \
     --pubkey ./ed25519.pem
   ```

   Exit code 0 means the math holds. The regulator trusts the
   math, not us.

4. For Bitcoin anchor proof: every audit row's chain head is
   periodically anchored via OpenTimestamps. Run
   `curl https://sovereignmatrix.agency/api/auditor/anchor?head=<sha>`
   to get the OTS proof. The regulator verifies it against the
   public Bitcoin blockchain — no Sovereign infrastructure is
   trusted in this verification path.

**Anchor wallet:** the OpenTimestamps proofs do not require us to
hold any wallet — OTS aggregates submissions across users into a
single hourly Merkle tree, then commits the root to Bitcoin via a
calendar server. We do not pay gas. The calendars are listed at
https://opentimestamps.org. If those calendars all go offline, the
proofs still verify against any Bitcoin node that has the relevant
blocks (anyone, anywhere, forever).

---

## 8. GDPR / POPIA DSAR responses

A user emails asking for all data we have on them, or asking us to
delete everything. Both are legal obligations under POPIA §23 (RSA)
and GDPR Art. 15 / Art. 17 (EU).

**For "export":**

1. Look the user up by email in Clerk → copy the user id.
2. Hit `POST /api/privacy/dsar` with the user id. The endpoint
   returns a signed bundle (Wave 13 receipt-bundle pattern) the
   user can verify on their own.
3. Email them the bundle. Done.

**For "delete":**

1. Verify their identity via Clerk (don't delete on first email —
   verify they own the email).
2. Hit `POST /api/privacy/delete` (admin-gated). This soft-deletes
   the user row, anonymizes their generations + leads, and revokes
   their tokens. Receipts they signed are retained but with PII
   redacted from the input/output payloads (the signature still
   verifies because canonicalization removes the redacted fields
   before re-signing — see `src/lib/dsar-redact.ts`).
3. Confirm via email within the regulatory window (30 days
   GDPR / 30 days POPIA).

---

## 9. Publishing an OSS patch release

When a bug in `@sovereign-matrix/verifiable-receipts` (or
`agent-sdk`) needs a fix:

1. Branch off `main`, edit, test locally:
   `cd packages/verifiable-receipts && npm test -- --run`.
2. Bump the version in `packages/verifiable-receipts/package.json`
   (semver — patch for bug fix, minor for additive feature).
3. Commit + push + merge to `main`.
4. Tag: `git tag verifiable-receipts-v<NEW-VERSION>` (e.g.
   `verifiable-receipts-v0.1.1`).
5. Push the tag: `git push origin verifiable-receipts-v<NEW-VERSION>`.
6. The `.github/workflows/release-oss.yml` action runs
   automatically: typecheck → test → pack → `npm publish
--provenance`.
7. Verify on npm: https://www.npmjs.com/package/@sovereign-matrix/verifiable-receipts

The first-time setup: add `NPM_TOKEN` repo secret in GitHub
Settings → Secrets and Actions → Repository secrets. The token must
be an npm Automation token with publish scope on the
`@sovereign-matrix` org.

For `agent-sdk`, use the tag prefix `agent-sdk-v` instead.

---

## 10. Codebase navigation

The map you need to navigate this repo:

- `src/app/` — Next.js App Router pages + API routes
  - `src/app/api/agents/<slug>/route.ts` — 140 agent endpoints,
    one per agent. All authenticated.
  - `src/app/api/_payments/stripe/webhook/` — the money path.
  - `src/app/api/_webhooks/` — inbound webhooks (HubSpot, Clerk,
    Stripe, Yoco, Cal.com). All signature-verified.
- `src/lib/` — 120+ shared modules.
  - `ai.ts` — single entry point for every AI model call.
    Cheapest-first router. Read this before touching any agent.
  - `agent-runs.ts` — signing + canonicalization. The crypto core.
  - `auth-guard.ts` — `requireAuth()` wraps every protected route.
  - `plan-enforcement.ts` — quota / paywall.
  - `idempotency.ts` — webhook event dedup.
- `src/db/schema.ts` — Drizzle ORM, 38 tables. Source of truth.
- `drizzle/` — generated migration SQL. Apply via Neon SQL Editor.
- `packages/` — the two OSS packages.
- `docs/` — every other piece of documentation (this file's
  neighbours).
  - `docs/specs/` — VAOS 1.0 / 2.0 / 3.0 wire specs.
  - `docs/runbooks/` — incident-specific playbooks.
- `e2e/smoke.spec.ts` — Playwright smoke run on every preview.

If you only ever read four files in this repo, read:
`src/lib/ai.ts`, `src/lib/agent-runs.ts`,
`src/app/api/_payments/stripe/webhook/route.ts`, and `CLAUDE.md`.

---

## 11. The five things that will most likely break first

Ranked by historical incident frequency:

1. **A Stripe webhook event arrives with a signature this codebase
   doesn't recognize** because Stripe rotated their signing
   algorithm. Fix: update `stripe` npm dep, re-deploy. Tests in
   `webhook/__tests__/contract.test.ts` cover the signature path.
2. **Clerk pushes a SDK change that breaks `currentUser()`**.
   Fix: pin the Clerk SDK version, then plan a migration.
   Watch the Clerk changelog.
3. **A new Next.js major hits and the App Router contract drifts**.
   Pin Next.js major in `package.json`; only upgrade with a full
   smoke run + `npm run build` green locally first.
4. **AI provider rate-limits the global key** during a usage spike.
   `src/lib/ai.ts` will cascade through the providers but the slow
   path is visible. Add user keys or upgrade the provider.
5. **Neon hibernates the DB** because nobody hit the platform for
   2+ weeks. Hit any endpoint to wake it; the first request after
   hibernation takes ~5 seconds.

For each, the response is documented in `docs/runbooks/`.

---

## 12. What to do on day one as a new operator

1. Read CLAUDE.md cover-to-cover.
2. Clone the repo, `npm install`, `npm run build` — confirm green.
3. Visit https://sovereignmatrix.agency on a fresh browser. Make
   sure every CTA works end-to-end.
4. Rotate every credential in §3.
5. Verify the OSS packages on npm by running:
   `npx @sovereign-matrix/verifiable-receipts verify --help`
   — if it prints, the OSS path is alive.
6. Run `npm test -- --run` locally. ~3000 tests should pass in
   under 30 seconds.
7. Tag yourself as the security contact: update
   `security@sovereignmatrix.agency` MX records to forward to you.

After that, you are operational. The platform was designed to run
with no human intervention for weeks at a time — the cron jobs,
anchor jobs, and health checks self-heal. Your job is to handle
incidents, ship features, and answer customers.

---

## 13. The forever clause

If you, the operator, also cannot continue: ensure the OSS packages
on npm remain at their latest published versions, transfer DNS
ownership to a friend / co-trustee, and commit the latest secrets
to a sealed envelope under attorney custody.

The platform's core promise — "any receipt signed under this
issuer's keys can be independently verified by any third party,
forever" — does not require this platform to be online. It requires:

1. The Ed25519 + ML-DSA-65 public keys are findable (Wayback
   Machine, IPFS, the OSS package's SPEC.md).
2. The OSS verifier library is on npm (immutable once published).
3. The Bitcoin chain still exists (independent of us).

All three are achievable without any operator. That is what makes
this project survive even an operator's full discontinuation.

— Christiaan de Wet, Cape Town, May 2026.
