# Market Gap Analysis — Regulated AI 2026

A live read on which regulated-AI compliance verticals are most
underserved relative to enforceable regulation + procurement budget.
This file is a working document — updated as new packs ship + new
regulations land.

Last updated: 2026-05-18 (Wave 61).

CC0 1.0. Republish freely.

---

## What we ship today (15 Apache-2.0 Guardian packs)

| #      | Pack                    | Citation                                           | Vertical                         | Geography |
| ------ | ----------------------- | -------------------------------------------------- | -------------------------------- | --------- |
| 1      | `hipaaPack`             | 45 CFR §164.514 Safe Harbor                        | Health (PII)                     | US        |
| 2      | `sr117Pack`             | Fed SR 11-7 / OCC 2011-12                          | Banking model risk               | US        |
| 3      | `naicPack`              | NAIC AI Bulletin (Dec 2023)                        | Insurance                        | US        |
| 4      | `dscsaPack`             | DSCSA §581(11)                                     | Pharma supply chain              | US        |
| 5      | `csrdPack`              | EU Directive 2022/2464 + ESRS                      | Sustainability disclosure        | EU        |
| 6      | `cfpbPack`              | 12 CFR §1002 (ECOA) + §1024/§1026 (Reg Z)          | Consumer credit + mortgage       | US        |
| 7      | `masPack`               | MAS FEAT 2018 + Singapore PDPA                     | Financial AI + NRIC              | Singapore |
| 8      | `fcaPack`               | FCA PRIN 2A + FG24/2 + FG21/1                      | Consumer Duty + AI guidance      | UK        |
| 9      | `pciDssPack`            | PCI DSS v4.0 §3.3 / §3.5                           | Payment card data                | Global    |
| 10     | `euAiActPack`           | Reg (EU) 2024/1689 Art. 13/14/15/50                | High-risk AI systems             | EU        |
| 11     | `nydfsPack`             | 23 NYCRR Part 500 + NYDFS AI Letter (Oct 2024)     | NY state financial cybersecurity | NY        |
| **12** | **`nycAedtPack`** (NEW) | NYC Local Law 144 §§20-870 to 20-874               | **Algorithmic hiring decisions** | NYC       |
| **13** | **`ferpaPack`** (NEW)   | 20 USC §1232g + 34 CFR Part 99                     | **US student records**           | US        |
| **14** | **`fdaSaMDPack`** (NEW) | FDA SaMD + AI/ML SaMD Action Plan + 21 CFR §807.87 | **Medical-device AI**            | US        |
| **15** | **`doraPack`** (NEW)    | Reg (EU) 2022/2554 + ESA RTS Art. 18/19/28-30      | **EU financial ICT resilience**  | EU        |

Coverage: US (10 packs) · EU (3 packs) · UK · Singapore · Global · NYC.

---

## Still-underserved verticals (research-confirmed)

Based on the May 2026 gap analysis run, these are the highest-leverage
regulations the project should add next. Each meets three criteria:
(a) enforceable today or in 2026, (b) procurement budget exists,
(c) wire format + Guardian-pack pattern credibly maps.

### 1. Colorado SB 24-205 — AI Consumer Protection Act (Feb 1, 2026)

- **Status**: Effective Feb 1, 2026 with private right of action
- **AI use case**: Any "consequential decision" AI (employment,
  education, financial, healthcare, housing, insurance, legal,
  essential services) used on Colorado residents
- **Per-decision rule**: BLOCK consequential-decision output without a
  documented impact-assessment reference + an algorithmic-discrimination
  disclosure
- **Why we missed it**: still pre-enforcement at last pack audit.
  Worth shipping before Feb 1, 2026.
- **Market**: every B2C AI vendor with Colorado customers

### 2. California AB 2013 — Generative AI Training Data Transparency (Jan 1, 2026)

- **Status**: Effective Jan 1, 2026
- **AI use case**: Any GenAI offered to Californians — foundation
  model APIs, RAG systems, fine-tuned vertical LLMs
- **Per-decision rule**: WARN when a generation receipt lacks a
  training-data manifest hash + synthetic-data percentage +
  copyright-cleared-sources flag per §22757.1
- **Market**: every B2B SaaS shipping AI to California enterprises —
  effectively the entire US AI sector. Salesforce/Adobe/ServiceNow
  procurement already demanding this Q4 2025
- **Difficulty**: medium — needs a `trainingDataManifest` field
  convention added to the canonical projection

### 3. Australia Privacy Act AI Reforms + APRA CPS 230 (Active Jul 2025)

- **Status**: CPS 230 operational-risk standard live July 1, 2025;
  Privacy Act tranche-2 reforms covering automated decisions land 2026
- **AI use case**: Bank credit decisioning, super-fund advice bots,
  insurance underwriting
- **Per-decision rule**: WARN on material-service AI calls without
  (a) tolerance-level metric, (b) fourth-party dependency chain,
  (c) consumer-explanation token per Privacy Act ADM right
- **Market**: ~640 APRA-regulated entities; APAC RegTech spend
  $3.1B/yr, AU share ~28%
- **Why we'll add it**: completes the APAC trifecta with MAS
  (Singapore) + (incoming) APRA (Australia)

### 4. FDA Predetermined Change Control Plans (PCCP) — Dec 2024 Final Guidance

- **Status**: Enforceable now
- **AI use case**: Continuous-learning AI medical devices (radiology
  triage, sepsis predictors, continuous glucose adjustment models)
- **Per-decision rule**: WARN when model inference output lacks
  (a) approved PCCP version reference, (b) current model weights hash,
  (c) drift metrics within the pre-specified Modification Protocol
  bounds
- **Market**: AI-SaMD market $8.2B (2025) → $24B (2030); FDA cleared
  950+ AI devices as of Q1 2026
- **Why we'll add it**: extends the FDA SaMD pack with continuous-
  learning-specific rules

### 5. Illinois AI Video Interview Act + bias-audit expansions

- **Status**: Illinois AI VIA enforced since 2020; expanded coverage
  in HB 3773 (Illinois Human Rights Act amendment) effective Jan 2026
- **AI use case**: Video-based hiring assessments
- **Why we'll add it**: extends the NYC AEDT pack with state-level
  bias-audit obligations beyond NYC

---

## Adjacent artifacts research flagged (NOT Guardian packs)

These are commercial-readiness items, not technical primitives. Each
maps to a specific procurement-questionnaire line item.

### A. Public bug bounty program

Tier-priced (receipt-forgery > log-equivocation > Guardian-rule-bypass

> standard XSS/SQLi). HackerOne or Intigriti. Enterprise security
> teams check the SIG Lite Q. H.2.3 line item; missing bounty = ~3
> weeks of back-and-forth per deal.

**Status:** not started. Cost: ~$5K/yr platform fee + payout budget.

### B. Named-competitor comparison pages

Procurement runs Gartner-MQ-style comparisons. If we don't appear in
the "vs Credo AI / Holistic AI / Fairly AI / Cranium / Calypso AI /
Robust Intelligence" SEO surface, we're not on the longlist. One
page per competitor, ~800 words, schema.org `ComparePage` markup.

**Status:** not started. Effort: ~1 day per page. Each one is a
distribution channel.

### C. SOC 2 Type II + ISO 42001 attestation landing

ISO 42001 (AI Management System) is the new procurement gate
replacing "do you have a responsible AI policy?". Needs auditor
name, report date, NDA-gated download. Plus DPA + sub-processor list

- EU SCC module 2 at `/legal/dpa` — required before any EU bank will
  take a meeting.

**Status:** SOC 2 Type II in progress per /security marketing copy;
ISO 42001 not yet started. Cost: $30–80K initial + recurring annual.

### D. Public Trust Center (Vanta/Drata-style)

Aggregates `/security/live` + SOC 2 + pen-test summary + uptime into
one procurement-ready URL. We have the pieces (`/security/live`,
`/status/integrity`, `/security/posture` JSON, `/api/status/metrics`)
— just need the aggregator page.

**Status:** parts shipped; aggregator pending. ~half-day to build.

---

## Methodology

This document compiles findings from the May 18, 2026 internal
research run. Sources:

- OWASP LLM Top 10 (2025) — `docs/OWASP-AI-MAPPING.md`
- NIST AI RMF
- Public regulatory text (cited inline)
- Industry analyst notes: Celent 2025 ICT-Risk Compliance,
  Gartner HR-Tech Compliance TAM 2027

Contributions welcome — fork this doc, add a vertical, open a PR.
The list is a living document; if you spot a gap, file an issue at
`spec@sovereignmatrix.agency`.

---

## License

CC0 1.0 (public domain). Republish, fork, embed in your procurement
materials without restriction.
