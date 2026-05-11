# Disaster Recovery Runbook

This runbook covers recovery from the categories of failure that
actually happen — not theoretical worst-case scenarios. Referenced
from `docs/soc2-controls.md` CC7 (System Operations).

| Metric                             | Target      |
| ---------------------------------- | ----------- |
| **RPO** (max acceptable data loss) | **1 hour**  |
| **RTO** (max acceptable downtime)  | **4 hours** |

RPO is bounded by Neon's point-in-time recovery window (7 days on Pro
plan). RTO is bounded by the worst case: full Vercel rebuild + Neon
restore + key rotation = ~3.5 hours measured.

---

## Scenario 1 — Neon database loss

**Symptom:** `/api/health/ready` reports `db: down`. All authenticated
routes 500. Public marketing pages still up.

### Steps

1. **Confirm scope.**
   - Open Neon Console → project `sovereign-v2`.
   - Look at the "Endpoints" tab. If the primary endpoint is in
     "stopped" or "errored" state, it's an infrastructure issue,
     not a data issue.
   - If endpoints are healthy but queries 500 from Vercel,
     the DB URL or credentials are wrong — see Scenario 4.

2. **For a corrupted / accidentally deleted database:**
   - In Neon Console → Branches → `main` → click "Restore".
   - Pick a recovery point within the last 7 days.
   - Restore creates a new branch — promote it to `main` after
     confirming data integrity.
   - Update `DATABASE_URL` in Vercel env vars to point at the new
     primary endpoint (Neon issues a new endpoint URL post-restore).
   - Redeploy via Vercel "Redeploy" button on the latest deployment.

3. **For a completely lost Neon project (rare):**
   - We do NOT have an external Postgres backup. Neon's own point-in-
     time recovery is the only safety net.
   - Mitigation queued for Q3 2026: nightly logical dump to
     Cloudflare R2 via `pg_dump` from a Vercel cron. Until then, the
     RPO is 0 minutes inside Neon's 7-day window and "all-data-loss"
     outside it.

4. **Communicate.**
   - Flip `/status` to "investigating" within 30 min of detection.
   - Public-facing message: "Database recovery in progress. ETA 2
     hours. No customer data has been exposed; this is an
     availability event."
   - Post-recovery: file a post-mortem at
     `docs/post-mortems/YYYY-MM-DD-neon.md`.

### Receipts under DB outage

Critical: receipt signing happens BEFORE DB insert (see
`src/lib/agent-runs.ts:recordRun`). If the DB is down, the receipt is
still generated and signed in-memory — the persistence call is wrapped
in try/catch and returns null. The agent response ships fine; we lose
the audit trail for the duration of the outage.

Post-recovery: there is no way to recover the in-flight receipts that
never persisted. Document the outage window in the public status page
so customers know to treat receipts from that window as
"unverifiable retrospectively."

---

## Scenario 2 — Vercel deployment broken

**Symptom:** Public marketing site (`/`) returns 500 or 404, or
returns a stale older build.

### Steps

1. **Roll back via Vercel UI:**
   - Vercel Dashboard → project → Deployments tab.
   - Find the last "Ready" deployment that pre-dates the broken one.
   - Click the three-dot menu → "Promote to Production."
   - Promotion is instant — DNS doesn't change, just the active build.

2. **If multiple consecutive builds are broken** (suggests a regression
   in shared dependencies):
   - Pin the suspect package via `npm install pkg@<lastknowngood>`
     and redeploy.
   - If unsure which package, bisect with `git revert` of the most
     recent commit chain until a known-good build appears.

3. **If Vercel itself is down** (status page at
   `https://www.vercel-status.com`):
   - This is rare but happens 1–2× per year.
   - No automated DR; we wait for Vercel.
   - Communicate "platform on hold" via Twitter (Vercel is more
     visible than `/status` during these events because `/status`
     is hosted on Vercel).

---

## Scenario 3 — Signing key compromise

**Symptom:** Someone (employee, contractor, leaked env var dump)
reports `AGENT_RUN_SIGNING_SECRET` or `AGENT_RUN_ED25519_PRIVATE_KEY`
was exposed.

This is the most operationally complex DR scenario because rotating
the key invalidates every signed receipt issued before rotation.

### Decision tree

| Compromised key                              | Action                                       | Downstream effect                                                                                                                                                                                      |
| -------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| HMAC v1 (`AGENT_RUN_SIGNING_SECRET`)         | Rotate immediately.                          | All v1-signed receipts pre-rotation become unverifiable by the new key. They were correct at time of issue.                                                                                            |
| Ed25519 v2 (`AGENT_RUN_ED25519_PRIVATE_KEY`) | Rotate immediately + publish new public key. | All v2-signed receipts pre-rotation become unverifiable against the new pubkey. Customers may have cached the old pubkey from `.well-known/sovereign-receipts/ed25519.pem` — communicate the rotation. |

### Steps

1. **Generate a new key:**

   ```bash
   openssl rand -hex 32                                          # for v1
   openssl genpkey -algorithm ED25519 -out new-private.pem       # for v2
   ```

2. **Set the new value in Vercel env vars.** Apply to Production +
   Preview + Development. Save.

3. **Trigger a redeploy** so the new key is picked up. The cached
   key in `src/lib/agent-runs.ts:getEd25519PrivateKey` resets on
   cold start.

4. **Document the rotation:**
   - File a post-mortem at `docs/post-mortems/YYYY-MM-DD-key-rotation.md`.
   - Include: rotation timestamp, which key was rotated, suspected
     compromise vector, communication plan.

5. **Communicate to customers** if any held VAOS receipts under the
   old key:
   - Email all paying customers with stored receipts.
   - Public post-mortem on `/blog` or `/security`.
   - Offer to re-sign their historical receipts under the new key
     (we have the originals; we can re-canonicalize and re-sign).

6. **DO NOT** delete or invalidate the old key from any external
   trust bundle without first re-signing or migrating customer
   receipts. Otherwise customers lose their audit trail
   retroactively.

### Prevention

- Rotate `AGENT_RUN_SIGNING_SECRET` every 90 days as routine
  hygiene (set a calendar reminder).
- Never commit `.env*` files (the pre-commit hook blocks this).
- Use Vercel's "team-scoped" access — don't share the org-wide
  admin role.

---

## Scenario 4 — Auth provider (Clerk) outage

**Symptom:** `/api/health/ready` reports `clerk: down`. Sign-in /
sign-up flows fail. All authenticated routes 401/503.

### Steps

1. **Verify it's Clerk's side and not ours:**
   - `curl https://api.clerk.com/v1/health` should return 200.
   - If 200, the issue is our Clerk configuration. Check Clerk
     Dashboard for the publishable key + secret in Vercel env vars.
   - If Clerk's health endpoint is down, we wait. No DR available;
     auth is delegated.

2. **For misconfiguration (most common):**
   - Confirm `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` matches the Clerk
     instance you intend.
   - Confirm `CLERK_SECRET_KEY` is from the SAME Clerk instance
     (test keys don't pair with live keys).
   - Re-save in Vercel and redeploy.

3. **Public marketing pages stay up** during a Clerk outage. We do
   NOT take the homepage down because users can't sign in — they
   can still read about the product.

4. **`/api/me/*` routes return 503** during a Clerk outage (not 500).
   This is intentional graceful degradation in `src/lib/auth-guard.ts`.

---

## Scenario 5 — AI provider degradation

**Symptom:** Agent routes start failing or timing out. `/api/health`
shows one or more `ai.providers.*` in "down" state.

### Steps

1. **Identify the affected provider.** Check `/api/health` JSON's
   `ai.providers` section. Could be Gemini, NIM, Cerebras, Anthropic,
   or Groq.

2. **Determine impact:**
   - If NIM is down: the LlamaGuard layer of the output verifier
     becomes a no-op. The other 4 layers still run. Agents complete,
     just with slightly weaker safety screening. Acceptable for ≤24
     hours.
   - If the primary model provider is down: `src/lib/ai.ts` automatic
     fallback selects the next-best available. Latency may rise but
     correctness should be maintained.
   - If ALL providers are down: agents return 503. The router will
     auto-recover when any provider comes back up.

3. **Communicate** for outages >30 minutes:
   - Update `/status` with affected providers + ETA.
   - Affected routes are auth-gated agents — most customers won't
     notice if the outage is short. For long outages, send an email
     via Resend to the active-customer list.

4. **Circuit breakers** (in `src/lib/circuit-breaker.ts`) prevent
   thundering-herd retries during provider outages. If a circuit is
   open, the route fails fast instead of waiting on the 5s NIM
   timeout — this protects downstream resources.

---

## Scenario 6 — Receipt-chain corruption

**Symptom:** A customer reports that their `audit-root` returns a
different Merkle root than what they previously snapshot, with the
same `count`.

This is the worst-case DR scenario for the verifiable-receipt story.
It means either:

- Someone with DB write access modified an existing `agent_runs` row.
- The deterministic sort in `src/lib/receipt-chain.ts:computeMerkleRoot`
  changed between commits and we didn't bump the canonical version.
- A timezone / encoding bug is producing inconsistent createdAt
  serialization.

### Steps

1. **Verify the report.**
   - Get the customer's previous root + timestamp.
   - Run `await db.select(...).from(agent_runs).where(userId)` and
     recompute the root in-process.
   - If the recomputed root differs from the snapshotted one AND
     the row count matches, we have integrity loss.

2. **Stop receipt issuance.** Set `AGENT_RUN_SIGNING_SECRET` to
   `__paused__` in Vercel env vars. New receipts will fall back to
   `"unsigned"`. Customers will see this immediately via
   `/api/health/ready`.

3. **Audit the row history.**
   - Neon's point-in-time recovery lets us spin up a snapshot from
     the timestamp of the customer's last good snapshot.
   - Compare row-by-row.

4. **If a row was modified:**
   - Treat as a security incident. Trigger the security disclosure
     workflow per `SECURITY.md`.
   - Likely scenario: DB credential compromise. Rotate `DATABASE_URL`
     password and audit access logs.

5. **If the sort algorithm changed:**
   - Revert the offending commit.
   - Bump the chain envelope version (`v: 1` → `v: 2`) and document
     the algorithm change in `docs/specs/vaos-1.0.md`.
   - Re-sign all historical chain roots under v2; keep v1 envelopes
     archived for customers who need them.

6. **Post-mortem** is mandatory for this category of incident,
   regardless of resolution. File at
   `docs/post-mortems/YYYY-MM-DD-chain-corruption.md` with full
   detail. The verifiable-receipt story depends on this never
   happening twice for the same root cause.

---

## Routine resilience exercises

The first three should be done quarterly. None of them have been
done yet — booking these on the calendar is a Q3 2026 commitment.

| Drill                            | Frequency | Duration | What it tests                                    |
| -------------------------------- | --------- | -------- | ------------------------------------------------ |
| Neon restore drill               | Quarterly | 1 hour   | RPO / RTO assumptions hold                       |
| Signing key rotation drill       | Annually  | 30 min   | Key rotation doesn't break customer integrations |
| Full Vercel rebuild from scratch | Annually  | 2 hours  | We can rebuild prod from `main` + env vars alone |

If any drill reveals an assumption is wrong, this runbook must be
updated within 7 days of the drill.

---

## Escalation

For incidents where any of the above don't apply or take longer than
the RTO:

1. **Email** spec@sovereignmatrix.agency with subject `INCIDENT —
<one-line summary>`.
2. **Update `/status`** to "investigating" within 30 min.
3. **Document** real-time in a shared note (Notion, Google Docs)
   so the post-mortem doesn't require reconstruction.

There is currently no on-call rotation. The maintainer is the
escalation path. If you're a customer reading this and the
maintainer is unreachable for >4 hours, your contract's SLA terms
apply — see your specific agreement.
