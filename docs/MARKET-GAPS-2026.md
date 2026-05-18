# Market Gap Analysis — Regulated AI 2026

A live read on which regulated-AI compliance verticals are most
underserved relative to enforceable regulation + procurement budget.
This file is a working document — updated as new packs ship + new
regulations land.

Last updated: 2026-05-18 (Wave 62).

CC0 1.0. Republish freely.

---

## What we ship today (20 Apache-2.0 Guardian packs)

| #      | Pack                             | Citation                                             | Vertical                                   | Geography  |
| ------ | -------------------------------- | ---------------------------------------------------- | ------------------------------------------ | ---------- |
| 1      | `hipaaPack`                      | 45 CFR §164.514 Safe Harbor                          | Health (PII)                               | US         |
| 2      | `sr117Pack`                      | Fed SR 11-7 / OCC 2011-12                            | Banking model risk                         | US         |
| 3      | `naicPack`                       | NAIC AI Bulletin (Dec 2023)                          | Insurance                                  | US         |
| 4      | `dscsaPack`                      | DSCSA §581(11)                                       | Pharma supply chain                        | US         |
| 5      | `csrdPack`                       | EU Directive 2022/2464 + ESRS                        | Sustainability disclosure                  | EU         |
| 6      | `cfpbPack`                       | 12 CFR §1002 (ECOA) + §1024/§1026 (Reg Z)            | Consumer credit + mortgage                 | US         |
| 7      | `masPack`                        | MAS FEAT 2018 + Singapore PDPA                       | Financial AI + NRIC                        | Singapore  |
| 8      | `fcaPack`                        | FCA PRIN 2A + FG24/2 + FG21/1                        | Consumer Duty + AI guidance                | UK         |
| 9      | `pciDssPack`                     | PCI DSS v4.0 §3.3 / §3.5                             | Payment card data                          | Global     |
| 10     | `euAiActPack`                    | Reg (EU) 2024/1689 Art. 13/14/15/50                  | High-risk AI systems                       | EU         |
| 11     | `nydfsPack`                      | 23 NYCRR Part 500 + NYDFS AI Letter (Oct 2024)       | NY state financial cybersecurity           | NY         |
| 12     | `nycAedtPack`                    | NYC Local Law 144 §§20-870 to 20-874                 | Algorithmic hiring decisions               | NYC        |
| 13     | `ferpaPack`                      | 20 USC §1232g + 34 CFR Part 99                       | US student records                         | US         |
| 14     | `fdaSaMDPack`                    | FDA SaMD + AI/ML SaMD Action Plan + 21 CFR §807.87   | Medical-device AI                          | US         |
| 15     | `doraPack`                       | Reg (EU) 2022/2554 + ESA RTS Art. 18/19/28-30        | EU financial ICT resilience                | EU         |
| **16** | **`coloradoAiPack`** (NEW)       | Colo. Rev. Stat. §§ 6-1-1701 to 6-1-1707 (SB 24-205) | **Consequential-decision AI**              | Colorado   |
| **17** | **`californiaAb2013Pack`** (NEW) | Cal. Bus. & Prof. § 22757.1 (AB 2013)                | **GenAI training-data transparency**       | California |
| **18** | **`apraCps230Pack`** (NEW)       | APRA CPS 230 + Privacy Act 1988 (Cth) ADM            | **Financial operational resilience + ADM** | Australia  |
| **19** | **`fdaPccpPack`** (NEW)          | FDA PCCP Final Guidance (Dec 4, 2024)                | **Continuous-learning medical AI**         | US         |
| **20** | **`illinoisAiPack`** (NEW)       | 820 ILCS 42/ + HB 3773 (IHRA amendment)              | **AI video interview + hiring bias**       | Illinois   |

Coverage: US (13 packs incl. CA/IL/CO/NYC) · EU (3 packs) · UK · Singapore · Australia · Global (PCI DSS).

**Federation primitive (Wave 62, NEW):** every Sovereign Matrix
deployment now hosts an `/.well-known/vaos` discovery document
(RFC 8615) that exposes wire versions, pubkey URLs, transparency-log
URLs, and frozen-spec URLs in a single JSON response. Auditors and
compliance bots discover everything in one round-trip; the same
shape is hostable by any third-party VAOS issuer.

**C2PA bridge (Wave 62, NEW):** `toC2PAManifest()` ↔ `fromC2PAManifest()`
round-trip a Guardian verdict through the Content Authenticity
Initiative manifest format (label `org.sovereignmatrix.vaos.v1`),
making VAOS receipts portable across Adobe Firefly, Microsoft Copilot,
and Truepic Lens pipelines without losing the signature.

---

## Wave 62 shipped — what was on the prior roadmap is now in `ALL_PACKS`

The five regulations called out in the May 18 roadmap (Colorado SB
24-205, California AB 2013, Australia APRA CPS 230 + Privacy Act ADM,
FDA PCCP, Illinois AI VIA + HB 3773) shipped in Wave 62 alongside the
federation + content-provenance primitives. Below is the next-wave
horizon — Wave 63 candidates that still meet our three-criteria gate
(enforceable, procurement budget, pattern-credibly-maps).

---

## Wave 63 candidates — next-horizon underserved verticals

### 1. Canada AIDA (Artificial Intelligence and Data Act, C-27)

- **Status**: Expected Royal Assent late 2026; "high-impact systems"
  obligation pre-published 2025 to give industry runway
- **AI use case**: Any high-impact AI (employment, services, content
  moderation, biometric ID) deployed in or to Canadian users
- **Per-decision rule**: WARN when output lacks (a) bias-mitigation
  reference, (b) human-oversight attestation, (c) accessibility
  consideration; BLOCK on identified material-harm tier
- **Market**: ~250K Canadian SMBs + 60+ federally-regulated enterprises
  (banks, telecoms, transport) — every B2B SaaS shipping AI into the
  Canadian market in 2027
- **Pattern fit**: high — mirrors EU AI Act risk-tiering with Canadian
  PIPEDA / Privacy Act overlays

### 2. UK AI Regulation White Paper + ICO Auditing Framework

- **Status**: ICO AI Auditing Framework live (updated Q1 2026);
  AI Safety Bill expected Q3 2026
- **AI use case**: All UK-deployed AI under ICO's 5 cross-sector
  principles (safety, transparency, fairness, accountability,
  contestability)
- **Per-decision rule**: WARN when high-stakes output lacks (a)
  Data Protection Impact Assessment reference, (b) explainability
  artefact, (c) human review pathway per ICO § 22 / Art. 22 GDPR
- **Market**: UK enterprise AI spend £8B/yr; existing FCA pack covers
  finance only — this extends to public sector + healthcare + edtech

### 3. ISO/IEC 42001 AI Management System runtime hooks

- **Status**: Published Dec 2023; the procurement "responsible AI
  policy" line item is now an explicit ISO 42001 certification check
- **AI use case**: Every operational ISO 42001-certified AI system
- **Per-decision rule**: WARN when output lacks (a) AIMS document
  reference, (b) risk-treatment record id, (c) Annex A control set
  applicability tag
- **Market**: BSI counts 1,800+ ISO 42001-cert-track companies as of
  Q1 2026; SOC 2 + ISO 42001 dual-cert is the new enterprise default

### 4. Texas TX-RAMP + Texas Capture/Use of Biometric Identifier Act

- **Status**: TX-RAMP active for state procurement (cloud + AI);
  HB 4 (passed June 2025) extends biometric-AI consent requirements
- **AI use case**: Any AI sold to Texas state agencies; any biometric
  AI (face/voice/iris) used on Texas residents
- **Per-decision rule**: BLOCK biometric-AI output without (a) prior
  written consent, (b) retention destruction schedule, (c) data-residency
  attestation; WARN on TX-RAMP-scope output without certification ref
- **Market**: Texas state government IT spend $3.4B/yr; biometric-AI
  market $32B by 2027; the bookend to Illinois BIPA on the south

### 5. Brazil LGPD AI Regulation (PL 2338/2023)

- **Status**: ANPD draft regulation released Apr 2025; expected
  enforcement Q3 2026 paired with LGPD Art. 20 (automated-decision right)
- **AI use case**: Any AI processing personal data of Brazilian
  residents — credit scoring, recruitment, content moderation
- **Per-decision rule**: WARN when output lacks (a) DPIA reference,
  (b) right-to-human-review notice in Portuguese, (c) algorithmic
  impact category (low / moderate / high / unacceptable)
- **Market**: Brazil enterprise AI spend $4.8B (2025); completes
  Americas coverage (US + CA + BR) under the same canonical projection

### 6. India DPDP Act + IndiaAI Mission AI Safety Institute guidance

- **Status**: DPDP Act in force since Aug 2023; MeitY AI Advisory
  (March 2024) and IndiaAI Safety Institute guidance (Q4 2025)
- **AI use case**: Any AI deployed on Indian data principals;
  high-risk LLMs require Government of India notification per
  March 2024 MeitY advisory
- **Per-decision rule**: WARN when output lacks (a) consent-artefact
  reference, (b) significant-data-fiduciary tag if applicable,
  (c) "unreliability" disclaimer per MeitY advisory
- **Market**: ~750K Indian SMEs + every global SaaS with Indian
  customers (which is most of them)

---

**Wave 63 sizing.** 6 packs × ~3 rules each = ~18 rules + ~36 tests.
At the established pattern velocity (Wave 61: 4 packs/30 tests, Wave 62:
5 packs/38 tests), this is a single dedicated wave. Brings the moat
to 26 packs across US (13) · EU (3) · UK (2) · Canada · Australia ·
India · Brazil · Singapore · Texas · Global.

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
