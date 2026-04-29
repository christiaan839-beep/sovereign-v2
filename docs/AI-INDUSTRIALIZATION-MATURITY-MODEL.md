# Sovereign Matrix AI Industrialization Maturity Model (AIMM)

> An open, opinionated 4-stage framework for assessing how
> **deeply industrialized** an organization's agentic AI deployment
> is. Sister framework to the Sovereign ADLC (Agent Development
> Lifecycle).
>
> **License:** CC-BY 4.0 — fork, adapt, use. Attribution to
> Sovereign Matrix appreciated.
> **Spec version:** v1.0
> **Last updated:** 2026-04-29
> **Reference implementation:** github.com/christiaan839-beep/sovereign-v2
>
> The AIMM is what **CMMI** was for software process maturity, and
> what **NIST CSF Tiers** were for cybersecurity readiness — applied
> to autonomous agent deployment. It answers: *"Where is your
> organization on the agentic AI industrialization curve, and what
> do you need to ship next?"*

---

## Why this framework exists

The 2026 enterprise agentic AI landscape is fragmenting between three
camps:

1. **AI dabblers** — running ChatGPT in browsers, no governance, no
   audit trail. Maturity Stage 0.
2. **AI piloteers** — POCs in production but no scaled deployment;
   most layoffs attributed to AI here are the Forrester "AI washing
   reversal" pattern. Maturity Stage 1-2.
3. **AI industrialists** — autonomous workforces with cryptographic
   accountability, regulator-defensible audit trails, insurable
   agent action liability. Maturity Stage 3-4.

Without a shared framework, every procurement officer,
implementation partner, and regulator runs their own assessment from
scratch. The AIMM is the assessment everyone runs.

---

## The 4 stages

```
   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
   │ STAGE 1      │ →  │ STAGE 2      │ →  │ STAGE 3      │ →  │ STAGE 4      │
   │ EXPLORER     │    │ PILOT        │    │ SCALED       │    │ AUTONOMOUS   │
   └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
   "What is AI?"        "Does it work?"     "Can we govern it?"   "Can we trust it?"
   ───────────────      ──────────────      ─────────────────     ────────────────
   Months 0-3           Months 3-12         Months 12-24          Months 24-60+
   No audit trail       Logs (mutable)      Hash-chained audit    Cryptographically
                                            + HITL routing         signed end-to-end
                                                                   + insurable
```

Each stage has:
- **Defining question** — what the organization is wrestling with
- **Hallmarks** — concrete characteristics observable to procurement
- **Reference primitives** — file paths in the Sovereign codebase
  (or your own implementation) that mark stage entry
- **Common failure mode** — the way organizations get stuck
- **Time to next stage** — typical, not deterministic
- **Procurement signal** — what an external auditor would see

---

## Stage 1 — EXPLORER

**Defining question:** *"What is AI agentic deployment, and is it
real for our business?"*

**Hallmarks:**
- Individual employees experiment with ChatGPT, Claude, Gemini in
  browser tabs
- No central platform; no governance; no audit trail
- "AI strategy" exists at PowerPoint level, not in production
- Risk profile: **employees may be pasting sensitive data into
  consumer LLMs**

**Reference primitives at this stage:** none. By definition, the
organization hasn't deployed a platform yet.

**Common failure mode:** the "shadow AI" problem — Cloud Security
Alliance research finds 60% of enterprises have employees using
unauthorized AI tools with company data.

**Time to Stage 2:** 1-3 months once leadership commits to a pilot.

**Procurement signal:** zero — no AI vendor relationships, no
written policies, no DPAs.

**How Sovereign helps you EXIT Stage 1:**
- Pick **1 vertical pack** (Banking, Healthcare, Legal, HR, FedRAMP,
  Workforce, Manufacturing, IT/SOC) matching your wedge use case
- Deploy in **45 minutes** via the Tier-S checklist
- Stop the shadow-AI bleed by giving employees a sanctioned platform

---

## Stage 2 — PILOT

**Defining question:** *"Does agentic AI actually work for our
specific use case?"*

**Hallmarks:**
- One or two production workflows running on a centralized platform
- Some logging exists (mutable application logs)
- Limited HITL — generally one approver, no multi-stage routing
- "Pilot" framing — leadership still treats it as experimental
- Most "AI-driven" layoffs at this stage are the Forrester-predicted
  reversal pattern (announced layoffs without mature deployment)
- Risk profile: **wrong outputs reach customers; nobody can
  reconstruct why**

**Reference primitives at this stage:**
- `src/lib/audit-log.ts` — basic logging (pre-R26 chain)
- 1-2 vertical pack agents enabled
- No multi-turn jailbreak defense yet
- No customer-managed audit export

**Common failure mode:** the "does it work?" question never gets
clearly answered. The pilot lingers for 12+ months as success
criteria are renegotiated.

**Time to Stage 3:** 6-12 months once measurable KPIs are agreed
(audit-pass rate, automated workflow throughput, HITL approval
times, etc.).

**Procurement signal:** vendor questionnaire submitted; SOC 2 Type I
or pre-Type-II observation period in flight; minimal external audit.

**How Sovereign helps you EXIT Stage 2:**
- Enable R26 hash-chained audit log (`src/lib/audit-log.ts`)
- Wire R33 multi-stage HITL routing (`src/lib/multi-stage-hitl.ts`)
- Configure R71 + R73 guardrails (single-turn AND multi-turn)
- Start daily R44 reliability attestations
- Establish baseline metrics for the next stage

---

## Stage 3 — SCALED

**Defining question:** *"Can we GOVERN this at scale, defensibly?"*

**Hallmarks:**
- 10+ production workflows across multiple business units
- Hash-chained audit log (R26) operational
- Multi-stage HITL routing for adverse decisions
- ACT capability tokens (R37) bounding what each agent can do
- Reputation scoring (R40) per agent
- Trust-as-Collateral live wire (R43) — reputation modulates spend
- Customer-managed audit export (R45) — tenant holds the data
- Cryptographically-signed reliability attestations (R44)
- Multi-turn jailbreak defense (R73) composed with single-turn (R71)
- 80%+ of routing decisions hit free-open-source models (R74 MoA)
- Risk profile: **outputs are reconstructable, signers are named,
  HITL is mandatory on adverse decisions**

**Reference primitives at this stage:**
- All R26-R45 trust stack ✅
- R47/R49/R52/R62/R53/R72/R76/R78 vertical packs deployed (1+ per
  business unit)
- R71 + R73 guardrails framework with operator adapters wired
- R57+R67 anomaly detection cron operational
- ✅ Inspector verification: `npx @sovereign/inspector full <url>`
  passes all checks

**Common failure mode:** organizational silos — security signed off
but legal didn't review the pack's regulatory citations; or finance
deployed but HR didn't enable the workforce-transformation analysis
required before any restructuring.

**Time to Stage 4:** 12-36 months. This is the longest stage because
it requires building **organizational habits**, not just technical
infrastructure.

**Procurement signal:** SOC 2 Type II report available under NDA;
EU AI Act Article 14 compliance attestation; HIPAA BAA executed
(if relevant); CSA-ATF mapping published.

**How Sovereign helps you EXIT Stage 3:**
- Federation v2 — peer with other Sovereign deployments (R50/R56)
- Insurance underwriting (R46) — actual carrier-bound policies
- Independent SOC 2 Type II audit pass
- IETF Sovereign Trust 1.0 RFC participation

---

## Stage 4 — AUTONOMOUS

**Defining question:** *"Can we INSURE this, FEDERATE this, and
PROVE every claim externally?"*

**Hallmarks:**
- 100+ production workflows; agents handle the workflow majority
  of routine cognitive work
- Federated reputation across multiple Sovereign deployments
  (worst-of aggregation)
- Active AI agent action insurance policies (carrier-bound on R46
  rating math)
- Cross-instance reputation mirroring contributes to per-agent
  credit lines
- HSM-backed master signing key (R54 production-grade adapter)
- On-chain reputation anchors (Bitcoin OP_RETURN / IPFS) for
  ultra-strong tamper-evidence
- IETF Sovereign Trust 1.0 spec adopted by ≥1 competing platform
- Risk profile: **reputation has automatic economic consequences;
  trust verification is provably trustless via offline inspector**

**Reference primitives at this stage:**
- All R26-R67 trust stack + R70-R76 + R71/R73 + R74 ✅
- R46 insurance underwriting → carrier partnership active
- Multi-region active-active deployment
- HSM-backed signing keys
- On-chain anchor cron operational
- Public benchmark page running inspector verifications against
  competitor deployments

**Common failure mode:** the "we did it, now what?" plateau. Stage 4
organizations have to figure out next-decade strategy when the
basics are solved. This is a good problem to have.

**Time to Stage 5:** there is no Stage 5 in v1.0. Future framework
versions may define one (e.g., "Self-Improving" — agents that
re-author their own packs under constraint).

**Procurement signal:** the organization IS the procurement signal —
peers cite this organization's deployment as the reference example
in their RFPs.

---

## How to use this framework

### As a vendor

The vendor (Sovereign Matrix or any other) maps customer prospects
to a stage at first qualification call:

- **Stage 1 prospect** → sell vertical pack + 45-min Tier-S deploy.
  Don't pitch federation.
- **Stage 2 prospect** → audit current logging + propose R26 chain
  upgrade + R33 HITL routing. Don't pitch insurance underwriting.
- **Stage 3 prospect** → propose R44 attestations + R71 + R73
  guardrails + R45 customer-managed export. Pitch SOC 2 Type II
  partnership.
- **Stage 4 prospect** → propose federation peering + carrier
  introductions for R46. Discuss IETF RFC participation.

### As a buyer

Run the AIMM self-assessment to know:
- What stage you're at NOW
- What primitives you need to deploy next
- What budget cycle you should plan for the transition
- What questions to ask vendors

### As a regulator / auditor

Stage 3 should be the **mandatory minimum** for any agentic
deployment processing adverse decisions in regulated contexts
(banking, healthcare, legal, HR, government). Stage 4 should be the
**recommended baseline** for high-risk AI systems under the EU AI
Act.

---

## Stage transition checklist (canonical)

| To advance to | Required primitives | Required process |
|---|---|---|
| Stage 2 | Centralized platform; basic logging | 1 production workflow live |
| Stage 3 | R26 + R33 + R34 + R37 + R44 + R71 | Multi-stage HITL + cryptographic accountability |
| Stage 4 | R45 + R46 + R50 + R57 + R67 + federation | Customer-managed audit + insurance + cross-instance reputation |

(Each row is necessary but not sufficient — process maturity must
match technical maturity.)

---

## How AIMM relates to other frameworks

| Framework | Scope | AIMM relationship |
|---|---|---|
| **NIST AI RMF** | Risk management functions | AIMM defines maturity within RMF's 4 functions |
| **EU AI Act** | High-risk AI legal requirements | Stage 3+ deployment satisfies most Article 14 oversight requirements |
| **CMMI** | Software process maturity | AIMM is the agentic-AI analog at a higher abstraction |
| **CMMC** | DoD cybersecurity maturity | AIMM stages roughly align: Stage 2 ≈ CMMC L1, Stage 3 ≈ CMMC L2, Stage 4 ≈ CMMC L3 |
| **CSA Agentic Trust Framework** | Zero-trust controls for agents | AIMM stages prescribe which ATF families are operational at each maturity level |
| **Sovereign ADLC** | 7-stage agent development lifecycle | AIMM is the ORG maturity; ADLC is the AGENT lifecycle. Both ship together. |

---

## Stage-to-primitive matrix (canonical)

| Primitive | Stage 1 | Stage 2 | Stage 3 | Stage 4 |
|---|---|---|---|---|
| R26 hash-chained audit log | — | partial | ✅ | ✅ |
| R30 cost-runaway daily cap | — | — | ✅ | ✅ |
| R33 multi-stage HITL | — | — | ✅ | ✅ |
| R34 CADC user signing | — | — | ✅ | ✅ |
| R37 ACT capability tokens | — | — | ✅ | ✅ |
| R44 signed reliability attestations | — | — | ✅ | ✅ |
| R45 customer-managed audit export | — | — | partial | ✅ |
| R46 insurance underwriting | — | — | — | ✅ |
| R50 federated reputation | — | — | — | ✅ |
| R55 CMEK | — | — | optional | ✅ |
| R57 anomaly detection | — | — | partial | ✅ |
| R63 pack validator | — | — | ✅ | ✅ |
| R67 anomaly cron + DB | — | — | ✅ | ✅ |
| R70 Crew Protocol | — | — | optional | ✅ |
| R71 Guardrails Framework | — | partial | ✅ | ✅ |
| R73 Multi-Turn Defender | — | — | ✅ | ✅ |
| R74 MoA Router | — | partial | ✅ | ✅ |
| R76 Manufacturing Pack (sector-specific) | — | — | ✅ if relevant | ✅ |
| R77 Trust Certification | — | — | bronze/silver | gold/platinum |

---

## Maintenance + evolution

- **Annual revision** — major versions track NIST RMF + EU AI Act
  + ATF spec evolution
- **ADR amendments** — substantial changes go through the ADR
  process (sister frameworks already use this)
- **Anti-drift CI gate** — file-path citations must match the
  reference implementation; broken links fail the build
- **Public benchmark report** — annual "State of Agentic Enterprise"
  report uses this framework as the survey instrument

Submit improvements via PR or issue at
`github.com/christiaan839-beep/sovereign-v2`.

---

**The AIMM is how you know whether your AI deployment is real or
performative.** Use it. Fork it. Improve it. The framework is
deliberately opinionated about the safe path because the unsafe
paths are how the Forrester-predicted "AI-washing reversal" pattern
unfolds. We don't get to ship that.

— The Sovereign Matrix team, April 2026
