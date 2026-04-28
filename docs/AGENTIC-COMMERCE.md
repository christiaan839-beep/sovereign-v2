# Agentic Commerce — Strategy + Architecture

> Round 30 — the platform's first move into the agentic commerce
> category. This document is both the strategy rationale AND the
> reference architecture for the primitives shipped in R30.

## What is agentic commerce?

The pattern where AI agents autonomously execute economic
transactions on behalf of users — purchasing goods, transferring
funds, paying for services, allocating budgets, signing contracts,
and (the frontier) transacting with *other agents*.

The shift is structurally larger than it looks. A consultative
agent is a search engine with personality. A transactional agent
is a fiduciary — it has identity, scope, budget, liability, and a
transaction history that constitutes a financial record.

## Why now (the macro)

Q2 2025 - Q4 2026 is when the agentic-commerce stack is being
defined. Whichever platforms ship before standards calcify become
the reference implementations.

- **Provider-side**: OpenAI Operator, Anthropic Computer Use, Google
  Agentic Mode all give agents tool-use sufficient to transact.
- **Payment rails**: Stripe + OpenAI's Agentic Commerce Protocol
  (Sep 2025), Mastercard Agentic Tokens (Apr 2025), Visa Intelligent
  Commerce (Apr 2025) introduce delegated-payment primitives.
- **Standards**: W3C Agent Identifiers, RFC drafts for the Agent
  Commerce Protocol, `agent.json` discovery file — all in flight.
- **Demand**: procurement teams want auto-renewing SaaS, paid
  invoices, managed inventory. Existing rails aren't designed for
  non-human actors making millions of micro-decisions.

## Why we ship this now

Sovereign Matrix already has 60% of the agentic-commerce stack —
**most competitors are chatbots with API integrations; we have a
cryptographically-trustable execution stack.**

| Primitive | Source | Status |
|---|---|---|
| Agent identity | `agent_manifests` + tenant scoping | shipped |
| Bounded auth | `api-key-scopes.ts` (R26) | shipped |
| Per-actor budget | `cost-runaway.ts` (R27) | shipped |
| Audit chain | `audit-log.ts` SHA-256 chain (R26) | shipped |
| HITL escalation | `hitl-approval.ts` (R26) | shipped |
| Trust levels | `trust-levels.ts` (R26) | shipped |
| Cryptographic receipts | `response-attestation.ts` HMAC + R30 chain | shipped |
| **Spend authorizations** | **`agent-spend.ts` (R30) — NEW** | **shipped** |
| **Reversal flow** | **`agent-spend.ts` (R30) — NEW** | **shipped** |
| **Per-merchant scoping** | **`agent-spend.ts` (R30) — NEW** | **shipped** |

## The R30 primitives

### 1. Agent Spend Authorization

A user grants their agent a bounded, scoped, time-limited
authorization to spend money. Like a Privacy.com card or Stripe
Issuing card, but specific to AI agents.

**Properties:**
- `maxCents` — hard ceiling (cents)
- `agentName` — bound to a specific agent (not "any agent")
- `expiresAt` — required (no perpetual blank checks)
- `categoryLimits` — optional per-merchant-category sub-budgets
- `allowedMerchants` — optional explicit allowlist
- `hitlThresholdCents` — charges above this require human approval

**API:**
```
POST   /api/agent-commerce/authorize
GET    /api/agent-commerce/authorize
DELETE /api/agent-commerce/authorize?id=...&reason=...
```

### 2. Atomic Charge

The agent attempts a charge against an authorization. The platform
atomically validates (8 checks via the pure-function `evaluateCharge`)
and decrements the authorization. Failures are logged for forensics
with a `failed` row in `agent_spend_charges`.

**Defence-in-depth:**
- **CHECK constraint** on `agent_spend_authorizations.spent_cents <= max_cents`
  → DB refuses over-spend even if app logic bugs out
- **SELECT FOR UPDATE** row lock during charge → no concurrent race
- **UNIQUE INDEX** on `(authorization_id, idempotency_key)` →
  retried charges return the original receipt (never double-spend)
- **Hash-chained receipt** → tampering detectable
- **Audit log entry** (`commerce.charge`) → SOC-2-grade record

**API:**
```
POST /api/agent-commerce/charge
```

Body:
```json
{
  "authorizationId": "uuid",
  "agentName": "travel-agent",
  "idempotencyKey": "stable-key-from-agent",
  "amountCents": 2999,
  "merchantName": "AirlineCo",
  "merchantCategory": "travel",
  "metadata": { "flight": "NYC-LON" }
}
```

Response (success):
```json
{
  "chargeId": "uuid",
  "receiptHash": "sha256-hex",
  "reversalWindowUntil": "2026-04-29T12:34:56Z",
  "remainingCents": 47001,
  "status": "completed"
}
```

### 3. Reversal

Within the configured reversal window (default 24h), either the
user or an admin can reverse a completed charge. The amount is
refunded to the authorization (`spent_cents -= amount`). The chain
is preserved; we never rewrite history.

**API:**
```
POST /api/agent-commerce/reverse/[chargeId]
{
  "reason": "agent bought wrong flight"
}
```

### 4. Public chain verification

Anyone with an authorization ID can verify the receipt chain is
intact. No auth required (the auth ID is the capability).

**API:**
```
GET /api/agent-commerce/verify/[authorizationId]
```

Response when intact:
```json
{
  "chainIntact": true,
  "chargeCount": 17,
  "verifiedAt": "..."
}
```

Response when broken:
```json
{
  "chainIntact": false,
  "brokenAt": "charge-uuid",
  "expected": "sha256-hex",
  "found": "sha256-hex",
  "verifiedAt": "..."
}
```

## What this unlocks for buyers

| Buyer | What this enables |
|---|---|
| **Procurement teams** | Auto-renew SaaS, pay invoices, manage budget — with hard ceilings, audit, and reversal |
| **Travel ops** | "$5K Q2 travel budget, max $2K per trip, only US airlines" |
| **Content teams** | "$500/mo on stock photos, only from approved vendors" |
| **DevOps** | "Auto-purchase compute capacity up to $200/day, only AWS" |
| **Personal assistants** | "$50/wk groceries, only from instacart, biometric approval over $30" |

## The reversal-window doctrine

We default to 24h reversal windows because:
- **Long enough** to catch agent mistakes (most are detected within
  hours when the user reviews their morning agent activity).
- **Short enough** to give the merchant settlement certainty (after
  24h, the charge is final from the platform's POV).
- **Configurable** per authorization for high-risk categories
  (e.g. "physical goods" might need 72h; "subscription" might be 1h).

Beyond the window, normal dispute process applies (Stripe chargeback,
operator escalation, etc.) — out of scope for the platform layer.

## What's next

Tier 2 (Q3 2026):
- Two-party signing (user co-signs at commit time via biometric/2FA)
- Cryptographic per-action receipts surfaced to merchants
- Agent-to-agent commerce protocol (RFC + reference impl)
- HITL escalation thresholds tuned per merchant category

Tier 3 (Q4 2026):
- Agent KYC/KYA registry (public, queryable)
- Public reputation system (reversal rate, dispute rate per agent)

## Strategic frame

The single sentence:

> *Sovereign Matrix is the cryptographically-trustable compute
> layer for agentic commerce — every agent action is hash-chained,
> scope-bounded, cost-capped, and reversible by default.*

This positions us at the gap most agent platforms ignore: not "what
your agent can do" (Crew/Lindy/n8n already do that) but "what your
agent can do **with money**" — the next $100B category.
