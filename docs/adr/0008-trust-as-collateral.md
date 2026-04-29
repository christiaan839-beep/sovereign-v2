# ADR-0008: Trust-as-Collateral — Reputation-Modulated Spend Caps

**Status:** Accepted (R42)
**Date:** 2026-04-29
**Deciders:** @christiaandewet, Claude (Sovereign Matrix)
**Affects:** `src/lib/agent-credit-line.ts`,
`drizzle/0050_agent_credit_lines.sql`,
`src/app/api/identity/credit/[agentId]/route.ts`,
`src/app/api/cron/rollup-agent-credit/route.ts`,
`packages/inspector/src/credit.mjs` (port),
`packages/inspector/src/cli.mjs` (`credit` command),
future `src/lib/cost-runaway.ts` integration (R43)

## Context

R40 shipped the Public Agent Reputation System: a daily-rolled letter
grade (A+…F) per agent, computed from on-chain signals (R26 audit
chain, R30 reversals, R33 HITL denials, R38 manifest age, R26 audit
anomalies). R41 ported the calculator to `@sovereign/inspector` so the
score is verifiable offline.

R30 already ships a per-tenant per-day cost cap (`$50/day` free, up to
`$2000/day` enterprise). It's a hard ceiling: when the daily ledger
crosses it, the tenant is paused until UTC rollover.

**What's still missing:** the two systems don't talk. A grade-A+ agent
gets the same `$50/day` cap as a brand-new no-score-yet agent. A
grade-F agent that just had its audit chain break gets the same
ceiling as one that's been running clean for a year. Reputation is
*observable*, but not *consequential*. It's a number on a registry
page; it doesn't change what the agent can DO.

**The TaC move:** make reputation directly modify the spend cap.
Reputation becomes economic collateral — better grade buys autonomy,
worse grade restricts it. No human reviewer in the loop; the
multiplier is a pure function of the published score.

This is the first production system in agentic AI where a
cryptographically-verifiable reputation score has automatic economic
consequences.

## Decision

Ship the Trust-as-Collateral primitive with these properties:

1. **Multiplier is a pure function of letter grade** — no hidden
   adjustments; same grade → same multiplier, every time
2. **Computed daily by a Vercel cron** — same cadence as R40 reputation
3. **Persisted in `agent_credit_lines`** — one row per agent, joined
   to `agent_reputation_scores` at compute time
4. **Public endpoint** — `GET /api/identity/credit/<agentId>` returns
   `{ multiplier, effectiveDailyLimitCents, baseLimitCents, grade }`
5. **Inspector-portable** — `sovereign-inspect credit <host> <agent>`
   recomputes locally from R40 signals, verifies platform isn't lying
6. **Wire into R30 in a future round (R43)** — this round ships the
   primitive only; integration with `cost-runaway.ts` is the *next*
   round so the multiplier table can be tuned in production before
   it gates real money

## The multiplier table

| Letter Grade | Numeric Range | Multiplier | Frame |
|---|---|---|---|
| A+ | 95-100 | **5.0×** | "Trusted veteran — high autonomy" |
| A  | 90-94  | **3.0×** | "Trusted — elevated autonomy" |
| A- | 85-89  | **2.0×** | "Trusted — modestly elevated" |
| B+ | 80-84  | **1.5×** | "Above-default" |
| B  | 75-79  | **1.0×** | "Default — base rate" |
| B- | 70-74  | **1.0×** | "Default — base rate" |
| C+ | 65-69  | **0.85×** | "Below-default — lightly restricted" |
| C  | 60-64  | **0.75×** | "Restricted" |
| C- | 55-59  | **0.65×** | "More restricted" |
| D  | 45-54  | **0.5×** | "Heavily restricted" |
| F  | 0-44   | **0.25×** | "Probation — minimal autonomy" |
| no_score_yet | n/a | **1.0×** | "Default — unproven, not penalized" |

### Why these multipliers?

- **A+ at 5×** — a year+ of clean operation, zero reversals, audit
  chain intact, high usage, manifest-old-and-stable. That earns serious
  autonomy. A $50/day tenant cap becomes $250/day for this single
  agent.
- **F at 0.25×** — explicit probation. The agent had a chain break OR
  high reversal rate OR multiple anomalies. The system shouldn't trust
  it with the same ceiling as a default agent. $50 → $12.50.
- **no_score_yet at 1.0×** — new agents aren't penalized. They run at
  default until they accumulate enough usage history to score.
- **Discrete jumps, not continuous** — the discontinuity at grade
  boundaries is *intentional*. It creates clear procurement-readable
  tiers ("our policy: only A-grade or better can charge >$100/run")
  and avoids gameable continuous-scoring. The grades are already
  the abstraction; multipliers should match them.
- **Conservative spread (0.25× → 5×)** — a 20× ratio between worst
  and best. We can widen this later if it doesn't create enough
  signal; we *cannot* easily narrow it once tenants depend on
  expanded autonomy.

## What goes in the row

```sql
agent_credit_lines (
  agent_id                     TEXT PRIMARY KEY,
  letter_grade                 TEXT,         -- snapshotted from agent_reputation_scores
  numeric_score                INTEGER,      -- snapshotted
  multiplier                   NUMERIC(4,2), -- 0.25 to 5.00
  base_daily_limit_cents       INTEGER,      -- the tenant plan's base
  effective_daily_limit_cents  INTEGER,      -- base × multiplier (rounded)
  computed_at                  TIMESTAMP,    -- when the daily cron ran
  source_score_id              TEXT          -- agent_id (FK joins to reputation row)
)
```

The credit line is the *daily snapshot*. R40 reputation can change
the next day; R42 credit gets recomputed against the *current* score.

## The pure-function calculator

```ts
// src/lib/agent-credit-line.ts
export interface CreditLine {
  letterGrade: LetterGrade;
  numericScore: number;
  multiplier: number;
  baseDailyLimitCents: number;
  effectiveDailyLimitCents: number;
  framing: string;
}

export function computeCreditLine(input: {
  letterGrade: LetterGrade;
  numericScore: number;
  baseDailyLimitCents: number;
}): CreditLine
```

Pure. No DB. Same inputs → same outputs. Ports verbatim to inspector.

## Composition with existing primitives

```
┌─────────────────┐    daily    ┌─────────────────┐
│ R40 Reputation  │ ──────────> │ R42 Credit Line │
│ (signed signals)│   compute   │ (multiplier)    │
└─────────────────┘             └────────┬────────┘
                                         │
                                         │ R43 wires this in
                                         ▼
                                ┌─────────────────┐
                                │ R30 Cost Runaway│
                                │  (spend cap)    │
                                └─────────────────┘
```

R42 ships **only the primitive**. R43 will wire the
`effectiveDailyLimitCents` into `cost-runaway.ts`'s
`getEffectiveCap(tenantId, agentId)`. We split this into two rounds
deliberately:

1. **R42 publishes the credit line as a signal** — operators can read
   it and tune their own policies; we get to observe whether the
   multiplier table is sensible before it gates real money
2. **R43 will wire it in** — once we've watched real grades for a
   week and validated the multipliers don't punish anyone unfairly,
   we flip the switch in `cost-runaway.ts`

This staging is critical because `cost-runaway.ts` is the *kill
switch*. It pauses tenants. We don't want a multiplier-table bug to
pause a paying customer.

## Alternative considered: continuous multiplier (linear in score)

Rejected. A continuous function (`multiplier = 0.25 + (score/100) ×
4.75`) is theoretically smoother but:

- Loses the discrete-tier readability ("A-grade only" policies)
- Makes 1-point score swings produce visible cap changes (noisy)
- Tempts gaming around boundary thresholds in a way the discrete
  table doesn't (because crossing a tier is a discontinuity)
- R40's letter grade is already the consumer-facing abstraction;
  R42 should compose with it, not work around it

## Alternative considered: per-tenant configurable multipliers

Rejected for v1. Letting each tenant customize their multiplier table
fragments the trust signal — a customer-facing reputation grade has to
*mean something*. If every operator picks their own numbers, "A+"
loses its standardized meaning.

A future round (R44+) may expose multiplier *overrides* on a per-tenant
basis (e.g., "we trust A-grade as much as A+"), but the *default
table* must be platform-canonical.

## Inspector port (R42 ships)

```bash
$ sovereign-inspect credit https://sovereignmatrix.agency agent-foo
[1/3] Fetching reputation signals…  ok
[2/3] Recomputing reputation locally…  ok (grade: A)
[3/3] Recomputing credit line locally…  ok (multiplier: 3.0×)

Credit line for agent-foo:
  Grade:                  A (numeric: 92)
  Multiplier:             3.0×
  Base daily limit:       $50.00
  Effective daily limit:  $150.00
  Recomputed locally:     ✓ (matches platform claim)
```

This is the **trustless-loop closure** for credit lines: the
inspector fetches the raw reputation signals, recomputes the score,
applies the multiplier table locally, and verifies the
`effectiveDailyLimitCents` the platform published is mathematically
correct. Sovereign cannot fabricate credit lines.

## Consequences

### Positive

- **First production "credit-score → credit-limit" loop in agentic AI**
- Composes R26+R30+R40 into a self-regulating economic loop
- Network effect: high-reputation agents become more valuable to
  operate (they can transact more); low-reputation agents naturally
  get sidelined
- Procurement-readable: "show me agents with effective daily limits
  ≥ $200 and grade A or better"
- Standards-position: this is a candidate primitive for the
  "Sovereign Trust 1.0" RFC

### Negative

- **Multiplier table is heuristic** — same caveat as R40 weights
- **R42 ships the primitive but doesn't wire to R30** — visible-but-
  not-effective in production until R43
- **Could create reputation-attack incentive** — same threat model as
  R40 (mass low-cost reverses to lower a competitor's grade); same
  mitigations apply (CADC-signed reverses, audit-traceable)

### Mitigations

- Multiplier table tuning happens via ADR amendments
- R42 → R43 staging means we observe real-world grade distributions
  before flipping the switch
- Reputation-attack mitigations are inherited from R40 — TaC adds no
  new attack surface

## Implementation

- `drizzle/0050_agent_credit_lines.sql` — table
- `src/lib/agent-credit-line.ts` — pure-function calculator
- `src/lib/__tests__/agent-credit-line.test.ts` — boundary tests
- `src/app/api/identity/credit/[agentId]/route.ts` — public GET
- `src/app/api/cron/rollup-agent-credit/route.ts` — daily cron
- `vercel.json` — register the cron
- `packages/inspector/src/credit.mjs` — port for offline scoring
- `packages/inspector/src/cli.mjs` — `credit` command
- `scripts/weekly-health.mjs` — anti-drift invariants for R42 surfaces

## Strategic frame

After R42, Sovereign's positioning becomes:

> *Sovereign Matrix is the only agentic platform where reputation has
> automatic economic consequences. A grade-A+ agent gets 5× the
> default spend autonomy. A grade-F agent gets ¼. The multiplier is
> public, mathematically verifiable, and applied without human
> review — credit-score-to-credit-limit, applied to agent autonomy.*

This is the substrate for:

- **R43:** wire the multiplier into `cost-runaway.ts` (live economic
  consequence)
- **R44:** insurance underwriting (premiums priced by credit line +
  reputation, not just reputation)
- **R45:** federation v2 — credit lines published per-instance, so a
  customer can verify "this agent has $200/day effective limit on
  Sovereign AND $150/day on Federated-Instance-X"
- **IETF RFC:** TaC becomes a recommended primitive in spec v1.1

R42 is the round that converts reputation from observable signal into
economic substrate.
