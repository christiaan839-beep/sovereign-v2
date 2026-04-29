# Sovereign Matrix Agent Development Lifecycle (ADLC)

> An open, opinionated framework for safely moving an organization
> from "we should try AI agents" to "we operate cryptographically-
> accountable agentic workforces in production."
>
> **License:** CC-BY 4.0 — fork, adapt, use. Attribution to
> Sovereign Matrix appreciated.
> **Spec version:** v1.0
> **Last updated:** 2026-04-29
> **Reference implementation:** github.com/christiaan839-beep/sovereign-v2
>
> The ADLC is the **agent-era equivalent of the SDLC** (Software
> Development Lifecycle) and the **DevSecOps** pipeline. SDLC told
> teams how to safely ship software; DevSecOps added security as a
> first-class step. ADLC adds **cryptographic accountability +
> regulatory defensibility** as first-class steps for autonomous
> systems.

---

## Why this framework exists

Every organization deploying AI agents faces the same questions in
the same order. Without a shared framework, each team rediscovers
them — usually after a regulator or lawyer asks. The ADLC makes
those questions explicit, sequences them, and shows what good answers
look like.

The opinionation comes from:
- **5 sellable production packs** built on this lifecycle (banking,
  healthcare, legal, HR, federal/DoD)
- **26 cryptographically-verifiable trust + reliability primitives**
  shipped in the reference implementation
- **449 anti-drift invariants** preventing the lifecycle from
  decaying after launch
- The **ATF, NIST AI RMF, EU AI Act Article 14, SOC 2, HIPAA, EEOC,
  NYC LL144, Colorado SB 24-205, FedRAMP, CMMC** regulatory map
  underlying the framework

---

## The 7-stage lifecycle

```
   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
   │ 1. IDEATION  │→ │ 2. SCOPING   │→ │ 3. AUTHORING │
   └──────────────┘  └──────────────┘  └──────────────┘
                                              │
   ┌──────────────┐  ┌──────────────┐  ┌──────▼───────┐
   │ 7. OPERATE   │← │ 6. DEPLOYMENT│← │ 4. VALIDATION│
   └──────┬───────┘  └──────────────┘  └──────────────┘
          │                                    │
          │          ┌──────────────┐          │
          └─────────→│ 5. ATTESTATION│←────────┘
                     └──────────────┘
```

Each stage has:
- **Inputs** — what must exist before the stage starts
- **Outputs** — what must exist when the stage ends
- **Failure mode** — what regulator / liability you're exposed to
  if you skip
- **Reference primitives** — what the reference implementation
  ships to support the stage

---

## Stage 1 — Ideation

**Question:** *Should this workflow be agent-driven at all?*

**Inputs:**
- Business problem statement (what pain are we solving?)
- Affected stakeholders (employees, customers, regulators)
- Current cost of human-only execution

**Outputs:**
- Decision: AGENT-AUGMENT / AGENT-AUTOMATE / DON'T-AGENT-IT
- A 1-page "why this is suitable for agents" memo

**Failure mode:** building agents for inappropriate workflows
(adverse decisions without human review → EEOC / Title VII /
Article 14 violations). The most expensive AI mistakes start here.

**Decision tree:**

| Workflow has... | → Recommend |
|---|---|
| Adverse decisions affecting protected classes | AGENT-AUGMENT (never automate) |
| Regulated submissions (SAR/CTR/FDA/court filing) | AGENT-AUGMENT (always HITL) |
| High-volume routine work + low individual impact | AGENT-AUTOMATE (with audit) |
| Customer-facing communication on sensitive topics | AGENT-AUGMENT (review required) |
| Internal analysis / drafting / summarization | AGENT-AUTOMATE (with HITL on commit) |
| One-off creative work | Probably DON'T-AGENT-IT |

**Reference primitive:** none (this is a pre-platform decision).

---

## Stage 2 — Scoping

**Question:** *What exactly will the agent be allowed to do, and what
must remain human?*

**Inputs:** the Stage-1 memo.

**Outputs:**
- Capability scope (what actions the agent can take)
- HITL routing rules (which actions require human approval, who, how
  many approvers)
- ACT (Agent Capability Token) shape — bounded, revocable
- Default daily spend cap (composes with reputation)

**Failure mode:** under-scoped agents do nothing useful; over-scoped
agents create blast-radius problems (runaway costs, regulatory
exposure, customer-facing errors).

**Reference primitives:**
- **R37 ACTs** (`src/lib/agent-capability-tokens.ts`) — Macaroon-
  pattern attenuatable tokens
- **R33 multi-stage HITL** (`src/lib/multi-stage-hitl.ts`) —
  sequential approval orchestration
- **R30 cost-runaway** (`src/lib/cost-runaway.ts`) — daily spend cap
- **R42 Trust-as-Collateral** (`src/lib/agent-credit-line.ts`) —
  reputation modulates the cap

**Default scoping rule:** every regulated-context pack ships with
`max_cents: 0` ACT scope. The agent reads, drafts, alerts, summarizes,
analyzes — but NEVER autonomously commits state changes.

---

## Stage 3 — Authoring

**Question:** *Build the actual agent behavior + assemble it into a
crew.*

**Inputs:** the Stage-2 capability scope.

**Outputs:**
- Agent prompt + behavior spec
- Identity Manifest declaring what the agent is + who owns it
- (If multi-agent) Crew Definition declaring members + handoff rules
- Test suite covering the agent's stated capabilities

**Failure mode:** agents that drift from their declared scope; agents
that bypass HITL by being able to invoke tools they shouldn't have.

**Reference primitives:**
- **R38 KYA Manifests** (`src/lib/agent-identity.ts`) — signed agent
  identity declarations
- **R70 Crew Protocol** (`src/lib/orchestration/crew-protocol.ts`)
  — declarative multi-agent collaboration
- **R63 Pack Validator** (`src/lib/vertical-packs/pack-validator.ts`)
  — structural + safety invariants

**The 9 safety invariants every authored agent must satisfy** (from
the R63 validator):

1. Read-only by default (`max_cents: 0`)
2. HITL coverage on every adverse-action keyword
3. Regulatory citation on every HITL rule
4. Audit-query audienceContext required
5. Daily limit bounded ($0-$1000)
6. No banned-agent keywords (jailbreak, deepfake, exploit, etc.)
7. Pricing tier declared
8. SLA tier declared
9. Compliance frameworks declared

---

## Stage 4 — Validation

**Question:** *Prove the agent does what it says + nothing else.*

**Inputs:** the Stage-3 authored agent.

**Outputs:**
- Unit-test suite (capability coverage)
- Red-team scenarios (adversarial inputs)
- HITL-boundary stress tests (does the agent honor its scope?)
- Reproducibility evidence (same input → same output, deterministic
  where possible)

**Failure mode:** agents that pass functional tests but fail
adversarial / regulatory edge cases.

**Reference primitives:**
- **Anti-drift CI gate** (`scripts/weekly-health.mjs`) — 449
  invariants checked on every PR
- **R57 Anomaly detector** (`src/lib/anomaly/audit-anomaly-detector.ts`)
  — statistical drift detection
- **Pack validator regression suite** — every in-source pack must
  pass `validateAuthoredPack`

**Validation gate:** if ANY R63 invariant fails, the pack cannot ship.
If anomaly detector identifies systematic disparate impact, the
pack must be redesigned.

---

## Stage 5 — Attestation

**Question:** *Sign the manifest + commit the crew config + record
the cryptographic root of trust.*

**Inputs:** the Stage-4 validated agent.

**Outputs:**
- Identity Manifest signed by owner's Ed25519 key (CADC)
- Crew Definition `configHash` recorded in audit log
- ACT capability tokens minted with bounded scopes
- First reliability attestation entry

**Failure mode:** agents in production without provenance — no
defense to "the AI did it autonomously" arguments.

**Reference primitives:**
- **R34 CADC** (`src/lib/agent-delegation.ts`) — Ed25519 + canonical-
  JSON signing
- **R44 Reliability Attestations** — daily-signed platform commitments
- **R26 Audit Chain** — hash-chained immutable log

**Attestation contract:** an agent without a signed identity manifest
+ an active ACT cannot run on the platform. This is enforced at the
runtime gate, not as a "best practice."

---

## Stage 6 — Deployment

**Question:** *Ship the agent into production with appropriate
boundary controls.*

**Inputs:** the Stage-5 attested agent.

**Outputs:**
- Production deployment (with environment-specific config)
- CMEK (customer-managed encryption keys) wired
- Webhook signing keys provisioned
- Federation discovery manifest published (if applicable)
- Customer-managed audit-log export endpoint configured

**Failure mode:** deploy environments that lack production-grade
crypto / encryption / audit infrastructure — every regulator-
visible surface must work, not just the happy path.

**Reference primitives:**
- **R54 KMS-abstracted Signer** (`src/lib/keys/signer.ts`) — AWS/GCP/
  Azure pluggable
- **R55 CMEK** (`src/lib/encryption/cmek.ts`) — customer-managed key
  envelope encryption
- **R58 Webhook signing** (`src/lib/webhooks/signing.ts`) — Ed25519 +
  replay defense
- **R36/R56 Federation discovery** (`/.well-known/sovereign-trust` +
  `src/lib/federation/discovery.ts`)

---

## Stage 7 — Operate

**Question:** *Continuously verify the agent in production + respond
to anomalies.*

**Inputs:** the Stage-6 deployed agent.

**Outputs:**
- Real-time anomaly detection signals
- Daily signed reliability attestations
- Federated cross-instance reputation aggregation
- Customer-managed audit-log exports
- Insurance underwriting quote updates (R46)

**Failure mode:** silent drift — the agent is technically running
but its behavior has changed in ways nobody noticed until a customer,
regulator, or litigant did.

**Reference primitives:**
- **R57+R67 Anomaly Detection** — statistical drift detection +
  hourly cron + persistent findings
- **R44 Daily attestations** — cryptographically-signed reliability
  commitments
- **R50 Federated Reputation** — cross-instance worst-of grading
- **R45 Customer-managed audit export** — tenant holds the data
- **R46 Insurance quotes** — economic signal of agent risk profile

**The 24/7 verification loop:**

```
Anomaly detector (hourly)  →  R44 attestation (daily)
       ↓                            ↓
   anomaly_findings           reliability_attestations
       ↓                            ↓
       └────────────→ /reliability page + /api/health/anomalies
                              ↓
              `npx @sovereign/inspector reliability-verify`
                              ↓
                    Customer verifies offline
```

---

## Cross-cutting concerns (apply at every stage)

### Cryptographic accountability

Every action that crosses the platform boundary is signed by a named
human's Ed25519 key (R34 CADC). "The AI did it" is not a defense
under EU AI Act Article 14, EEOC AI Guidance, FRCP 11, or CMMC. The
signature chain IS the defense.

### Regulatory citation discipline

Every HITL rule cites a specific statute / case / agency guidance.
Pack validator (R63) rejects rules without citations. Anti-slop
discipline.

### Read-only-by-default ACT scope

Every regulated-context pack ships with `max_cents: 0` and a curated
allowlist of read/draft/alert/analyze actions. Agents NEVER
autonomously commit state changes that affect humans, money, or
compliance.

### Customer data sovereignty

Customer-managed encryption keys (R55), customer-managed audit
exports (R45), and federation discovery (R36) together mean: the
customer controls their data, they can verify Sovereign isn't lying
about it, and their audit trail survives even if Sovereign vanishes.

### Trustless verification

Every claim — reputation, credit line, reliability, audit integrity,
federated grade, insurance quote — is verifiable offline by the
customer using `@sovereign/inspector`. Math is the truth, not
marketing.

---

## How this differs from existing frameworks

| Framework | What it covers | What it doesn't |
|---|---|---|
| **NIST AI RMF** | Govern / Map / Measure / Manage | Doesn't prescribe HITL routing or signing |
| **EU AI Act** | Article 14 mandates human oversight | Doesn't say HOW to implement |
| **OWASP LLM Top 10** | Vulnerability taxonomy | Doesn't address regulatory defensibility |
| **CSA Agentic Trust Framework** | Identity + credential + tool governance | Doesn't ship reference implementation |
| **MLOps frameworks** (MLflow, etc.) | Model lifecycle | Doesn't address agent autonomy or HITL |
| **Sovereign ADLC** (this doc) | **All 7 stages, with a reference implementation** | None — uses the others as inputs |

The ADLC is **opinionated** in a way the others aren't. We name a
default (read-only ACT scope), prescribe a substrate (CADC signing),
and ship a reference implementation that can be adopted as-is or
forked.

---

## Adoption paths

### Path A: Adopt as-is (fastest)

Use the Sovereign Matrix reference implementation. All 26 trust +
reliability primitives ship under MIT license; clone the repo;
deploy on your infrastructure. The 5 vertical packs ship in-source
as exemplars.

### Path B: Adopt the framework, build your own (most flexible)

Read the framework. Adopt the 7-stage lifecycle in your own pipeline.
Use whatever crypto / KMS / audit infrastructure you prefer. The ADLC
is not Sovereign-specific; it's a pattern.

### Path C: Hybrid (most common)

Adopt the framework. Use the Sovereign reference implementation for
the cryptographic primitives (CADC, KMS Signer, CMEK, audit chain,
attestations). Build your own vertical packs against the R63 SDK.
Submit packs to the Sovereign Marketplace if you want to monetize
them.

---

## Maintenance and evolution

This framework is living. Updates flow through:
- **ADR amendments** — major changes go through `docs/adr/` numbered
  proposal → review → accept lifecycle
- **Anti-drift CI gate** — invariants prevent silent regression
- **Public threat model** — adversarial pressure surfaced in
  `docs/THREAT_MODEL.md`
- **Annual major version bumps** — when EU AI Act / NIST RMF / etc.
  publish substantive updates

Submit improvements via PR or issue at
`github.com/christiaan839-beep/sovereign-v2`.

---

## Appendix: stage-to-primitive mapping

| Stage | Reference primitives (file paths in source) |
|---|---|
| 1. Ideation | (pre-platform; no primitive) |
| 2. Scoping | `agent-capability-tokens.ts`, `multi-stage-hitl.ts`, `cost-runaway.ts`, `agent-credit-line.ts` |
| 3. Authoring | `agent-identity.ts`, `orchestration/crew-protocol.ts`, `vertical-packs/pack-validator.ts` |
| 4. Validation | `scripts/weekly-health.mjs`, `anomaly/audit-anomaly-detector.ts` |
| 5. Attestation | `agent-delegation.ts`, `reliability-attestation.ts`, `audit-log.ts` |
| 6. Deployment | `keys/signer.ts`, `encryption/cmek.ts`, `webhooks/signing.ts`, `federation/discovery.ts` |
| 7. Operate | `audit-anomaly-detector.ts`, `app/api/cron/detect-anomalies`, `agent-reputation.ts`, `agent-underwriting.ts` |

Every primitive is unit-tested; every primitive ports verbatim to
`@sovereign/inspector` for offline customer verification; every
primitive composes with the others.

---

**The ADLC is how you ship agents that don't get you sued, fired, or
investigated.** Use it. Fork it. Improve it. Tell us what we got
wrong.

— The Sovereign Matrix team, April 2026
