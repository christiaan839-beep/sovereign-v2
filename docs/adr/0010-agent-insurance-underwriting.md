# ADR-0010: AI Agent Action Insurance — Underwriting Primitive

**Status:** Accepted (R46)
**Date:** 2026-04-29
**Deciders:** @christiaandewet, Claude (Sovereign Matrix)
**Affects:** `src/lib/agent-underwriting.ts`,
`src/app/api/identity/insurance/[agentId]/route.ts`,
future R47 — claims table + claims-history wiring,
future carrier partnership integration

## Context

After R40 (public reputation) and R42 (Trust-as-Collateral credit
lines), Sovereign Matrix has the substrate for the first
production-grade AI agent action insurance product.

**The market gap:** AI agent insurance does not exist as a
purchasable product today. Lloyd's of London, Munich Re, Beazley,
and Coalition all have explicit exclusions for "fully-autonomous
AI decision-making" because they cannot underwrite risks they
cannot price. The blocker is *exposure quantification*: how do
you price a risk whose loss frequency and severity are unknown
because the agent is novel?

R46 closes that gap: **reputation grade + credit line are
underwriting variables.** A grade-A+ agent with a $500/day cap
and zero claims history has a measurable, defensible risk
profile. A grade-D agent with prior claims is also priceable
(at a heavily loaded rate). A grade-F agent is declined.

This is not "we built a quote calculator" — this is the
**rating model** that converts agent reputation into an
insurable, carriable, pricable book of business.

## Decision

Ship the agent-action insurance underwriting primitive with these
properties:

1. **Pure-function rating model** — same inputs → same outputs;
   carriers can recompute offline.
2. **Reputation grade × credit line × claims history** as the
   three rating dimensions.
3. **F-grade is uninsurable in v1** — carriers' capacity reserved
   for risks the math can price.
4. **Standard commercial-lines coverage shape** — per-incident
   cap, annual aggregate cap, per-incident deductible.
5. **Public quote endpoint** — `GET /api/identity/insurance/[agentId]`
   returns the full breakdown so carriers can audit Sovereign's math.
6. **Composes with R40+R42** — no new data sources required for v1.

## The rating formula

```
annualPremiumCents = round(
  exposureCents
  × baseRate                                           // 0.5%
  × gradeMultiplier                                    // 0.5× → 4.0× across A+→D
  × (1 + scoreAdjustment(grade, score))                // ±5% within band
  × (1 + claimsCountLoading(claims12mo))               // up to +50%
  × (1 + claimsAmountLoading(totalPaid12mo))           // up to +50%
)

where exposureCents = effectiveDailyLimitCents × 365
```

### Grade multipliers (v1)

| Grade | Multiplier | Frame |
|---|---|---|
| A+ | 0.5× | Heavy discount — proven low-risk |
| A | 0.7× | Discounted |
| A- | 0.85× | Lightly discounted |
| B+ | 0.95× | Slightly favorable |
| B / B- | 1.0× | Par |
| C+ | 1.5× | Loaded |
| C | 2.0× | Heavily loaded |
| C- | 2.5× | Very heavily loaded |
| D | 4.0× | At capacity-pricing |
| F | (declined) | Uninsurable |
| no_score_yet | 1.0× | Par (conservative default) |

### Coverage shape (v1)

| Component | Default |
|---|---|
| Per-incident coverage cap | 10× effective daily limit |
| Annual aggregate cap | 50× effective daily limit |
| Per-incident deductible | 1× effective daily limit |

These shapes are commercial-auto-style (per-incident cap × annual
aggregate × deductible). Future round may support carrier-customizable
shapes for specialty lines.

### Claims loadings

| Trigger | Loading |
|---|---|
| Each claim count | +10% (cap +50%) |
| Each $1,000 paid in claims | +10% (cap +50%) |

Calibrated to standard commercial-lines actuarial practice
(see e.g. ISO claim-frequency rating tables).

## Why this works as a product

1. **Carriers can underwrite what they can measure.** Reputation +
   credit line are continuously-updated, cryptographically-signed,
   third-party-verifiable signals. That's the ENTIRE bottleneck
   to insuring agent action liability.
2. **Sovereign is the rating bureau, not the carrier.** The product
   is an underwriting *primitive* — carriers (Lloyd's syndicates,
   MGAs, captive insurers) write the policy and bear the risk.
   Sovereign earns referral fees / data licensing / per-policy
   underwriting fees.
3. **Loss experience compounds.** Every paid claim feeds back into
   future quotes; the rating model gets smarter the more it's used.
   Network effect.
4. **Procurement-first market.** Compliance officers + risk managers
   at regulated companies WANT to see "this agent is insured up
   to $X per incident". That answer doesn't exist today; we make
   it exist.

## Carrier go-to-market

R46 is the **technical product**. The commercial product requires:

- **MGA partnership** (managing general agent — writes on behalf of
  one or more carriers under a binding authority): 90-180 days
  to negotiate
- **Reinsurance treaty** (excess-of-loss + quota-share): 60 days
- **Filed rates** (state-by-state for US distribution; Lloyd's
  syndicate for global): 6-12 months
- **Initial book size** ($1M-$5M annual premium target Year 1):
  10-50 commercial customers @ $25-100K policy

This document is the math. The business is the next 12 months.

## Trustless carrier verification (the inspector role)

A carrier underwriting against Sovereign-published quotes must
trust the math. The `@sovereign/inspector` (R35+) ports the
`quotePremium` function; carriers run:

```bash
npx @sovereign/inspector insurance-verify \\
  https://sovereignmatrix.agency \\
  agent-foo
```

Inspector fetches reputation + credit line + the published quote,
recomputes locally, and verifies they match. Carriers cannot be
defrauded by Sovereign-published quotes — same trustless pattern
as R34/R37/R38/R41/R42/R44.

(Future port: R47 ships the inspector command alongside the
claims-table wiring.)

## Alternative considered: ML-based rating model

Rejected for v1. Black-box ML rating cannot be filed with
state insurance commissioners (US) and is opaque to carrier
audit. Pure-function rating is auditable, file-able, and
verifiable. Future round may *augment* the model with ML
factors, but the base rate must remain explainable.

## Alternative considered: writing policies directly (Sovereign as carrier)

Rejected. Becoming a regulated insurance carrier requires
~$5M-$50M in capital + state-by-state licensing. Sovereign's
edge is the rating model, not the balance sheet. Partner with
existing carriers; collect fees; let them carry the risk.

## Consequences

### Positive

- **First production-grade AI agent action insurance underwriting math.**
- Composes purely with R40+R42; no new data dependencies.
- Pure-function = filable + auditable + carrier-verifiable.
- Network effect: every paid claim refines the rating model.
- Opens a $15-50B annual premium TAM (per global cyber-liability
  precedent; AI agent insurance follows the same shape).
- Procurement-readable: "this agent is insurable up to $X aggregate".

### Negative

- **v1 has no claims data** — quotes use 0-claims baseline. First
  carrier partnership will need actuarial sign-off accepting this.
- **Rating model is heuristic** — calibration will need to evolve
  as real claims accrue (R47).
- **Carrier dependency** — without an MGA / carrier partnership,
  the math is academic. Cannot ship as a product without a balance
  sheet behind it.
- **Regulatory complexity** — state-by-state filing in the US;
  Lloyd's syndicate or non-admitted-market for international.

### Mitigations

- Negotiate MGA partnership in parallel with v1 quote API public
  release. Use the public endpoint as the carrier-pitch artifact.
- Calibration-by-ADR: amendments to the rating table require ADR
  + actuarial review (R47+).
- Start with non-admitted / surplus-lines distribution to bypass
  state-by-state filing for the pilot phase.

## Implementation

- `src/lib/agent-underwriting.ts` — pure-function rating model
- `src/lib/__tests__/agent-underwriting.test.ts` — 26 tests
- `src/app/api/identity/insurance/[agentId]/route.ts` — public
  quote endpoint
- `docs/adr/0010-agent-insurance-underwriting.md` — this ADR
- (future R47) — claims_paid table + table wiring
- (future R47) — inspector port + `insurance-verify` CLI command
- (future R48) — MGA partnership integration
- `scripts/weekly-health.mjs` — anti-drift invariants

## Strategic frame

After R46, Sovereign's positioning becomes:

> *Sovereign Matrix is the only platform that quantifies AI agent
> action risk into a carriable, insurable, audit-defensible
> premium quote. We're the rating bureau for the AI agent insurance
> market — the same role ISO + Verisk play in P&C insurance,
> applied to the trillion-dollar agent-deployment economy.*

This is the substrate for:

- **R47:** Claims table + history wiring; inspector port + CLI
- **R48:** MGA partnership integration (binder API, claims feed)
- **R49:** Per-line specialty pricing (healthcare-claim agents,
  financial-services compliance agents, etc.)
- **R50+:** Reinsurance integration (treaty pricing, layer
  pricing for high-cap exposures)

R46 ships the mathematical substrate that makes AI agent insurance
*possible* as a commercial line. The first $1B+ premium book in
this category is statistically going to be written using this
model — or one based on it.
