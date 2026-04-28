# Sovereign Matrix — Project Constitution

> **The 7 immutable principles that define what this project is.**
>
> When in doubt, return here. When tempted to deviate, return here.
> This document changes only with a deliberate, documented vote
> recorded in the ADR log (`docs/adr/`). Drift in the principles
> is the canary that the project has lost its identity.
>
> **Last ratified:** 2026-04-28 — Round 27 (the Permanence Sprint).

---

## Why a constitution exists

Software projects don't die from a single mortal blow. They die from
ten years of compromises, each individually defensible, that
collectively erode what made the project worth building.

A constitution is the answer to *"is this change consistent with
who we are?"*. It's the line in the sand. It survives the founder.
It survives the first acquisition offer. It survives the well-meaning
PR from a contributor who doesn't yet understand why we're different.

Without a constitution, the project is at the mercy of every
quarter's strongest argument. With one, every decision has an
appellate court — these seven principles, ratified, voted on,
written down.

---

## The 7 Principles

### 1. Every claim has a verifiable source.

If the platform says "223 agents", `git grep` proves it. If it says
"5-layer safety pipeline", the code in `output-verifier.ts` proves
it. If it says "hash-chained audit log", running
`/api/admin/audit/verify-chain` proves it.

A claim that can't be verified by reading the source is a marketing
lie waiting to be exposed. The anti-drift gates in
`scripts/weekly-health.mjs` exist to enforce this — every numeric
or capability claim that drifts from its source-of-truth file fails
CI.

**Operationalised by**: 141 anti-drift invariants. `floor: false`
on every "must NOT contain" check. `single-source-of-truth`
constants in `src/lib/platform-stats.ts` for every numeric claim.

### 2. Tenant isolation is by construction, not by convention.

Every store helper carries `userId` in every WHERE clause. A hostile
id is mathematically a no-op, not a leak. We do NOT rely on
"developers will remember to add the WHERE" — the layer below them
forces it.

This is why `playbook-dag-store.ts`, `share-token-store.ts`,
`hitl-approval.ts`, `execution-audit.ts` all look the same: every
function takes `userId`, every WHERE includes it, every helper
returns null on wrong-owner without distinguishing from not-found
(no information leak via 404 vs 403).

**Operationalised by**: anti-drift grep for `userId` in every store
WHERE. Tests that explicitly verify a wrong-owner request returns
the same shape as not-found.

### 3. Fail-loud, not fail-silent.

Production outages and security incidents are caught by humans
seeing red lines, not by humans noticing graphs that look slightly
off three weeks later.

When something fails, it logs ERROR with structured context. When a
boot-time invariant is violated (missing `ENCRYPTION_KEY`, missing
`CRON_SECRET`), the platform refuses to boot. When tampering is
detected on the audit chain, the cron returns 500. When a usage
counter fails to write, the failure path lands in `usage_outbox`
PLUS logs CRITICAL.

The opposite — fail-silent (e.g. `safeDecrypt` returning ciphertext
on auth-tag failure, pre-Round 25) — hides the signal exactly when
it matters most.

**Operationalised by**: `assertProductionRequiredEnv` boot gate.
`TamperDetectedError`. Cron-verified audit chain. Outbox pattern.
Structured ERROR logs with severity grading.

### 4. Append-only over in-place mutation, where forensics matter.

The audit log doesn't UPDATE rows; it INSERTs them and chains them.
The DAG version history doesn't overwrite; it appends. Restoration
doesn't roll the timeline back; it appends a new row that points at
the source. Decided HITL approvals are immutable.

This is the foundation of trust. A platform that can rewrite its
own history can't be trusted to tell the truth.

**Operationalised by**: SHA-256 hash chain on `audit_logs` (drizzle
0033). Append-only contract enforced by anti-drift on
`createDagVersion` calls in the save POST. `restoreDagVersion`
chained to `createDagVersion` (verified by anti-drift gate).

### 5. The single source of truth is the code.

When marketing copy contradicts the code, the marketing copy is
wrong. When a doc says "we have 130 agents" and the registry has
223, the doc is wrong. When the env reference says
`ENCRYPTION_KEY` is optional but `assertProductionRequiredEnv` says
it's required, the production assertion wins.

This is why `platform-stats.ts` exports constants and every page
imports them. Why `agent-manifests.generated.ts` is generated from
the agent route files, not hand-edited. Why `plans.ts` is the
canonical price + tier map and every other surface derives.

**Operationalised by**: anti-drift gates that fail when stale
literals appear in copy. Generator scripts (`scripts/generate-agent-
manifests.mjs`) that derive from source.

### 6. The platform must work fully without the founder.

If the founder vanishes tomorrow, someone else can:
- Deploy the next release (runbook)
- Roll back a bad deploy (runbook)
- Diagnose an incident (runbook)
- Add a new agent (CONTRIBUTING.md + agent-factory.ts)
- Run the full eval / anti-drift / migration pipeline (CI gates)
- Understand why every architectural choice was made (ADR log)

This is the bus-factor principle. A project where only one person
knows how something works is one accident from death. The
`docs/SUCCESSION.md` document is the operational handover artifact;
the `docs/adr/` log is the decision-history artifact.

**Operationalised by**: `docs/SUCCESSION.md`, `docs/adr/`, every
runbook in `docs/runbooks/`, the agent factory pattern, anti-drift
gates that catch regressions a new contributor would miss.

### 7. Bound the financial blast radius.

A single misconfigured agent can't bankrupt the platform. A single
runaway loop can't drain the credit pool. A single abusive customer
can't burn enough provider tokens to cause a billing emergency.

Every layer has a ceiling: per-step retry caps, per-run duration
caps, per-tenant 24h cost caps, per-agent token-budget caps,
circuit breakers per provider. The platform is designed so the
WORST plausible failure mode (a misconfigured nested A2E loop, an
attacker holding a stolen API key) has a known, bounded cost.

**Operationalised by**: `src/lib/cost-runaway.ts`,
`agent-spawn.ts` per-parent budget cap, `retry-with-backoff` max
attempts, circuit breakers per provider in `agent-factory.ts`,
`PLAN_LIMITS` enforcement, free-tier rate limits.

---

## How this constitution changes

A principle here is amended by:

1. An ADR proposed in `docs/adr/NNNN-<title>.md` with the rationale.
2. The change merged through the standard PR process.
3. The "Last ratified" date in this document updated.

A principle here is **never** amended by silent edit. The intent of
making this a constitution is that the cost of changing it is
visible — every amendment has a paper trail.

---

## What is NOT in the constitution

The constitution describes WHO WE ARE. It does not describe:

- Tactical engineering choices (which models, which UI library)
- Strategy (which markets, which customers)
- Pricing (lives in `plans.ts`)
- Roadmap (lives in `docs/WHATS-NOT-ELITE.md` + `/roadmap`)

Those are mutable. The 7 principles are not.

---

## Enforcement

Every principle has an anti-drift gate in `scripts/weekly-health.mjs`.
A PR that violates a principle fails CI. A merge that bypasses CI
is a violation of the constitution itself — the audit chain catches
that too.

The principles outlast any individual contributor. They outlast the
founder. They are the project's identity.
