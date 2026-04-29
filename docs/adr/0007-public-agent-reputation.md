# ADR-0007: Public Agent Reputation System

**Status:** Accepted (R40)
**Date:** 2026-04-29
**Deciders:** @christiaandewet, Claude (Sovereign Matrix)
**Affects:** `src/lib/agent-reputation.ts`, `drizzle/0049_*.sql`,
`src/app/api/identity/reputation/[agentId]/route.ts`,
`src/app/api/cron/rollup-agent-reputation/route.ts`,
`packages/inspector/src/reputation.mjs`,
`src/app/agents/registry/page.tsx` (score badges)

## Context

R30-R39 shipped a complete cryptographic trust stack: identity
manifests, capability tokens, delegation chains, federation discovery.
R39 made the registry browsable.

**What's still missing:** when a procurement reviewer hits the registry,
they see `42 agents`. They don't know **which agents to trust**. The
trust stack proves "this agent is who it claims to be." It does NOT
answer "should I let this agent transact on my behalf?"

That's what reputation does. Reputation aggregates the signals that
the trust stack already captures — reversal rates from R30, HITL
rejection rates from R33, audit-chain anomalies from R26, manifest
age from R38 — into a single score keyed by manifest ID.

The pattern is **Glassdoor for AI agents**, with one critical
difference: every score input is on-chain and verifiable. There's no
manual review or hidden algorithm — the math runs locally on signed
data, and `@sovereign/inspector` will eventually port it (R41).

## Decision

Ship the Public Agent Reputation System with these properties:

1. **Score keyed by manifest ID** — one score per agent identity
2. **Computed daily by a Vercel cron** — not real-time (avoid abuse)
3. **Pure-function calculator** — easy to test, port, audit
4. **Inputs are auditable** — every signal has a source row in
   the database that an auditor can verify
5. **Output: letter grade (A+ to F) + numeric (0-100)** — both
   procurement-friendly AND machine-readable
6. **Public endpoint** — no auth required; reputation is part of
   the public registry contract

## The reputation score formula

Each agent gets a **base score of 75** ("decent default") and
modifiers up to ±25 from each signal. Final score is clamped to
[0, 100].

| Signal | Source | Weight | Direction |
|---|---|---|---|
| Reversal rate (last 30d) | `agent_spend_charges` where `status='reversed'` | -30 max | Lower is better |
| HITL rejection rate (last 30d) | `hitl_approvals` where `status='denied'` | -25 max | Lower is better |
| Audit chain integrity | `agent_action_signatures` chain verifications | +/-15 | Pass = +, fail = - |
| Manifest age (days) | `agent_identity_manifests.createdAt` | +0 to +10 | Older = stronger |
| Active usage (count, last 30d) | `audit_logs` count for this agent | +0 to +15 | More = stronger (but log-scale) |
| Cost efficiency | avg cost vs platform median | +0 to +10 | Lower-than-median = stronger |
| Anomaly events | `audit_logs` action='anomaly.*' | -20 max | Each anomaly hurts |

### Letter grade mapping
- 95+ → A+
- 90-94 → A
- 85-89 → A-
- 80-84 → B+
- 75-79 → B (default)
- 70-74 → B-
- 65-69 → C+
- 60-64 → C
- 55-59 → C-
- 45-54 → D
- 0-44 → F

### Why these weights?
- **Reversal rate has highest negative weight** — it's the strongest
  signal of agent failure (the customer literally hit the kill switch)
- **HITL rejection is also high** — humans rejected the agent's action
- **Audit chain integrity is a binary swing** — chain breaks are
  catastrophic; chain holds is strong-positive
- **Usage/age/cost are positive-only modifiers** — they raise the
  ceiling but don't punish (a new agent isn't "bad," just unproven)
- **Anomaly events are heavily negative** — these are explicit security
  signals (R26 hash chain breaks, etc.)

## What goes in the row

```sql
agent_reputation_scores (
  agent_id              TEXT PRIMARY KEY,
  letter_grade          TEXT,        -- "A+", "A", ..., "F"
  numeric_score         INTEGER,     -- 0-100
  reversal_rate_pct     NUMERIC(5,2),
  hitl_rejection_pct    NUMERIC(5,2),
  audit_integrity       BOOLEAN,     -- chain verified intact?
  manifest_age_days     INTEGER,
  usage_count_30d       INTEGER,
  cost_efficiency_score INTEGER,     -- 0-10
  anomaly_count_30d     INTEGER,
  signals_json          JSONB,       -- full signal breakdown for transparency
  computed_at           TIMESTAMP    -- when the daily cron ran
)
```

The `signals_json` field carries the FULL breakdown so a verifier
can see WHY the score is what it is — no black-box scoring.

## Alternative considered: continuous real-time scoring

Rejected because:
- Real-time scoring is gameable (an agent caps its own usage to
  inflate cost-efficiency for a single transaction)
- Daily cron creates a stable signal that can be graphed over time
- Cron-based scoring is simpler to audit + reproduce

## Inspector port (R41 path)

A future round ports the pure-function calculator to
`@sovereign/inspector` so customers can:

```bash
sovereign-inspect reputation https://sovereignmatrix.agency <agent-id>
```

…and recompute the score locally from the on-chain signals. That
closes the "Sovereign is not a required trust anchor" loop for
reputation too.

## Consequences

### Positive

- First production-grade public agent reputation system
- Network effect: more usage → more data → stronger signals
- Composable with R30, R33, R26, R38 (all existing primitives)
- Standards-position move (becomes part of "Sovereign Trust 1.0")
- Procurement-ready: one curl returns a letter grade

### Negative

- Score is HEURISTIC; some weights will need tuning over time
- Reputation farming is theoretically possible (mass low-cost reverses
  to hurt a competitor) — mitigated by signing the reverse with
  CADC, traceable via R26 audit chain
- Daily cadence means new agents have no score for first 24h

### Mitigations

- Weight tuning happens via ADR amendments (audit trail preserved)
- Reverse-farming is detectable in audit logs; we can flag suspicious
  patterns in a future round (anomaly detection on agent_spend_charges)
- New-agent state shows "no_score_yet" rather than a misleading low
  score; consumers can choose how to handle

## Implementation

- `drizzle/0049_agent_reputation_scores.sql` — table
- `src/lib/agent-reputation.ts` — pure-function calculator
- `src/app/api/identity/reputation/[agentId]/route.ts` — GET endpoint
- `src/app/api/cron/rollup-agent-reputation/route.ts` — daily cron
- `vercel.json` — register the cron
- `src/app/agents/registry/page.tsx` — show score badges
- `packages/inspector/src/reputation.mjs` — port for offline scoring

## Strategic frame

After R40, Sovereign's positioning becomes:

> *Sovereign Matrix is the only agentic platform that ships a complete
> cryptographic trust stack — identity, capability, delegation, audit,
> AND public reputation — verifiable end-to-end by any third party
> without trusting Sovereign servers.*

The reputation system makes the entire stack USABLE for high-stakes
decisions ("should I authorize this agent to spend $X?"). It's the
substrate for:
- R41: Reputation port to `@sovereign/inspector`
- R42: Cross-instance reputation mirroring (federation v2)
- R43: Insurance underwriting (premiums priced by reputation)
- IETF RFC: reputation in spec v1.1

R40 is the network-effect substrate that converts "trust primitives"
into "trust ecosystem."
