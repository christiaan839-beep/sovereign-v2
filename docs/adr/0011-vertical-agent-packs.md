# ADR-0011: Vertical Agent Packs — generic infra → industry products

**Status:** Accepted (R47)
**Date:** 2026-04-29
**Deciders:** @christiaandewet, Claude (Sovereign Matrix)
**Affects:** `src/lib/vertical-packs/`,
`src/app/api/vertical-packs/[packId]/route.ts`,
future `src/app/for/banking-compliance/page.tsx`,
future `src/lib/vertical-packs/healthcare-claims.ts`,
future `src/lib/vertical-packs/legal-discovery.ts`

## Context

Sovereign Matrix has 223 generic agents and a complete cryptographic
trust stack (R26-R46). What it lacks is a **product**: a sellable,
opinionated bundle aimed at a specific buyer in a specific industry.

A community bank's compliance officer doesn't want "AI agent
infrastructure" — they want **OCC-examination-ready compliance
automation that won't get them fired.** The current platform makes
them assemble that themselves: pick from 223 agents, configure ACT
scopes, write HITL rules, build audit queries, write the OCC
mapping. Most won't.

The vertical pack is the **product** — same shape as Stripe Connect,
Auth0 Enterprise, Okta Workforce Identity. We take the infrastructure
and bundle it with industry-specific opinions, regulatory citations,
and a curated agent surface. The buyer signs once and gets the
deployment configured for their examiners.

## Decision

Ship vertical packs as immutable, declarative TypeScript files
defining:

1. **Curated agent allowlist** — which of the 223 agents are enabled
   for this vertical
2. **Vertical-specific HITL rules** — layered on top of platform
   defaults, with regulatory citations
3. **Pre-built audit queries** — the canned questions examiners
   ACTUALLY ask, with action prefixes
4. **Default ACT scopes** — opinionated capability defaults
   (banking pack: read-only by default — agents NEVER autonomously
   spend in a regulated context)
5. **Compliance framework mapping** — which frameworks the pack
   satisfies out-of-the-box (composes with `docs/COMPLIANCE-MAPPING.md`)
6. **Pricing tier** — declared ACV range and target customer size
7. **SLA tier** — composes with R44 reliability attestations

First pack: **Banking Compliance** (banking-compliance-v1).

## Why immutable per version

A pack is a **regulatory artifact** — once a customer's deployment
runs `banking-compliance-v1`, the auditor needs to be able to
reconstruct exactly what was deployed at any point in time. Mutating
a pack invalidates the audit chain.

When the pack changes, version bumps (banking-compliance-v2). Old
deployments stay on v1 until explicitly migrated. New deployments
start on v2. The audit log records which version was active at each
moment.

## Pack lifecycle

```
1. Define          src/lib/vertical-packs/<industry>.ts (pure data)
2. Test            src/lib/__tests__/<industry>-pack.test.ts
3. Publish         GET /api/vertical-packs/<id> exposes it
4. Sell            Sales engagement → customer signs for the pack
5. Deploy          Customer's tenant config references pack id+version
6. Audit           Pack version is logged on every agent action
```

## Banking Compliance Pack — first product

| Attribute | Value |
|---|---|
| Target | Community banks ($1-10B AUM), credit unions, mid-market RIAs, fintech compliance teams |
| Buyer | Chief Compliance Officer, BSA Officer, VP of Risk |
| ACV | $25K-$150K |
| Compliance frameworks | SOC 2 Type II, OCC Handbook, FFIEC IT Handbook, SEC Rule 17a-4, FINRA 3110, NIST AI RMF, ISO 27001 |
| SLA tier | regulated (99.9% commitment + signed attestation per R44) |
| Default ACT scope | **Read-only** — `max_cents: 0`, action allowlist limited to read/draft/alert/summary/analyze |
| Default daily limit | $100 (conservative — R42 credit lines widen for proven agents) |

## HITL rules unique to banking

Five rules layered on top of platform defaults:

1. **SAR/CTR drafts must be human-approved** (31 CFR 1020.320)
2. **Customer NPI exports require dual approval** (GLBA, FFIEC IT)
3. **Policy-drift detections trigger 5-day BSA officer review** (OCC CMS)
4. **Vendor risk assessments cannot auto-onboard** (OCC 2013-29)
5. **Examination responses cannot ship without CCO signature** (12 USC 1820)

Each rule cites the regulatory authority. When the OCC examiner asks
"how does your AI tooling handle BSA reporting?" the answer is:
"these five rules + this audit query + here's a verifier you can run
yourself."

## Pre-built audit queries

Five queries the pack ships:

1. Every customer-data-touching agent action (30d)
2. Full SAR/CTR pipeline reconstruction (90d)
3. Vendor risk decisions + signatures (1 year)
4. Examination response artifacts + CCO signatures (180d)
5. Anomaly events (180d)

These convert "the OCC examiner sent a 50-question request" from a
two-week SQL session into a ten-minute click-to-export operation.
That's the *measurable customer outcome* — the case study that lands
the next 10 customers.

## Why this pattern compounds

Every additional vertical pack:

- **Compounds the moat** — each pack reuses 100% of the trust stack
  (R26-R46) and adds vertical opinions
- **Reuses the sales motion** — same procurement template, different
  regulatory citations
- **Strengthens the federation argument** — packs declare which
  compliance frameworks they satisfy, federation graph aggregates
- **Powers the marketplace** — third parties can submit packs (R49+
  marketplace integration)

Year-1 sequence: banking-compliance → healthcare-claims → legal-
discovery. Each one ~$50-150K ACV × 10-30 customers per vertical = the
path to $5-15M ARR.

## Alternative considered: customer-configurable templates

Rejected. Letting each customer write their own HITL rules + audit
queries fragments the regulatory-defensibility story. The point of a
pack is "this configuration was reviewed by counsel and field-tested
at 10 customers; you adopt it as-is for examiner-defensibility."
Custom configurations are still possible (post-deploy customization)
but the canonical pack is the certified surface.

## Alternative considered: pricing inside the pack manifest

Rejected for v1. Pricing is a sales-led commercial decision; encoding
ranges in the manifest is enough for marketing surface. Future round
may add usage-based metering tied to pack id (R50+).

## Consequences

### Positive

- **First sellable PRODUCT** as opposed to "infrastructure you
  can build something on top of"
- **Immutable, versioned, audit-defensible** — auditors can prove
  which pack version was active at any point
- **Composes with R26-R46 trust stack** — each pack inherits the
  full cryptographic substrate
- **Vertical pricing** — each pack has its own ACV range matching
  the regulatory complexity of the industry
- **Marketplace path** — third parties can submit packs in R49+

### Negative

- **Pack curation is a NEW operational responsibility** — every
  regulatory change in a vertical may require a pack revision
- **Versioning + migration is non-trivial** — a customer on v1
  must explicitly upgrade to v2; we need migration tooling
  (R49+)

### Mitigations

- ADR amendments document pack version changes; old versions stay
  available indefinitely
- Anti-drift gate verifies pack invariants (read-only ACT scopes,
  required compliance framework references, etc.)

## Implementation

- `src/lib/vertical-packs/types.ts` — pack shape
- `src/lib/vertical-packs/banking-compliance.ts` — first pack
- `src/lib/__tests__/banking-compliance-pack.test.ts` — 28 tests
  ensuring pack invariants
- `src/app/api/vertical-packs/[packId]/route.ts` — public endpoint
- `docs/adr/0011-vertical-agent-packs.md` — this ADR
- `scripts/weekly-health.mjs` — anti-drift invariants

## Strategic frame

After R47, Sovereign's positioning becomes:

> *Sovereign Matrix sells regulatory-ready agent products.
> Banking-compliance pack ships examination-defensible AI agent
> infrastructure to community banks today; healthcare-claims and
> legal-discovery packs follow in the next two quarters. Each pack
> is immutable, versioned, audit-trail-recorded, and built on the
> same R26-R46 cryptographic trust substrate.*

This is the move that converts the platform from "interesting
infrastructure" into "specific products targetable by named buyer
personas in specific industries with specific ACV ranges."

The first $5M ARR comes from this round. The first $50M ARR comes
from the next 4 packs.
