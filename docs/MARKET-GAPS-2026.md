# Market Gap Analysis — Regulated AI 2026

A live read on which regulated-AI compliance verticals are most
underserved relative to enforceable regulation + procurement budget.
This file is a working document — updated as new packs ship + new
regulations land.

Last updated: 2026-05-18 (Wave 64).

CC0 1.0. Republish freely.

---

## What we ship today (32 Apache-2.0 Guardian packs across 6 continents)

| #      | Pack                             | Citation                                             | Vertical                                   | Geography    |
| ------ | -------------------------------- | ---------------------------------------------------- | ------------------------------------------ | ------------ |
| 1      | `hipaaPack`                      | 45 CFR §164.514 Safe Harbor                          | Health (PII)                               | US           |
| 2      | `sr117Pack`                      | Fed SR 11-7 / OCC 2011-12                            | Banking model risk                         | US           |
| 3      | `naicPack`                       | NAIC AI Bulletin (Dec 2023)                          | Insurance                                  | US           |
| 4      | `dscsaPack`                      | DSCSA §581(11)                                       | Pharma supply chain                        | US           |
| 5      | `csrdPack`                       | EU Directive 2022/2464 + ESRS                        | Sustainability disclosure                  | EU           |
| 6      | `cfpbPack`                       | 12 CFR §1002 (ECOA) + §1024/§1026 (Reg Z)            | Consumer credit + mortgage                 | US           |
| 7      | `masPack`                        | MAS FEAT 2018 + Singapore PDPA                       | Financial AI + NRIC                        | Singapore    |
| 8      | `fcaPack`                        | FCA PRIN 2A + FG24/2 + FG21/1                        | Consumer Duty + AI guidance                | UK           |
| 9      | `pciDssPack`                     | PCI DSS v4.0 §3.3 / §3.5                             | Payment card data                          | Global       |
| 10     | `euAiActPack`                    | Reg (EU) 2024/1689 Art. 13/14/15/50                  | High-risk AI systems                       | EU           |
| 11     | `nydfsPack`                      | 23 NYCRR Part 500 + NYDFS AI Letter (Oct 2024)       | NY state financial cybersecurity           | NY           |
| 12     | `nycAedtPack`                    | NYC Local Law 144 §§20-870 to 20-874                 | Algorithmic hiring decisions               | NYC          |
| 13     | `ferpaPack`                      | 20 USC §1232g + 34 CFR Part 99                       | US student records                         | US           |
| 14     | `fdaSaMDPack`                    | FDA SaMD + AI/ML SaMD Action Plan + 21 CFR §807.87   | Medical-device AI                          | US           |
| 15     | `doraPack`                       | Reg (EU) 2022/2554 + ESA RTS Art. 18/19/28-30        | EU financial ICT resilience                | EU           |
| **16** | **`coloradoAiPack`** (NEW)       | Colo. Rev. Stat. §§ 6-1-1701 to 6-1-1707 (SB 24-205) | **Consequential-decision AI**              | Colorado     |
| **17** | **`californiaAb2013Pack`** (NEW) | Cal. Bus. & Prof. § 22757.1 (AB 2013)                | **GenAI training-data transparency**       | California   |
| **18** | **`apraCps230Pack`** (NEW)       | APRA CPS 230 + Privacy Act 1988 (Cth) ADM            | **Financial operational resilience + ADM** | Australia    |
| 19     | `fdaPccpPack`                    | FDA PCCP Final Guidance (Dec 4, 2024)                | Continuous-learning medical AI             | US           |
| 20     | `illinoisAiPack`                 | 820 ILCS 42/ + HB 3773 (IHRA amendment)              | AI video interview + hiring bias           | Illinois     |
| **21** | **`canadaAidaPack`** (NEW)       | Bill C-27 Part 3 (AIDA) ss. 8-12 + PIPEDA ADM        | **High-impact AI (employment + service)**  | Canada       |
| **22** | **`ukIcoPack`** (NEW)            | ICO Guidance on AI + UK GDPR Art. 22 + ATRS v2       | **Cross-sector UK auditing framework**     | UK           |
| **23** | **`iso42001Pack`** (NEW)         | ISO/IEC 42001:2023 §§ 6.1.4 / 7.5 + Annex A          | **AI Management System runtime hooks**     | ISO          |
| **24** | **`texasAiPack`** (NEW)          | Tex. Bus. & Com. § 503.001 + HB 4 + TX-RAMP          | **Biometric AI + state procurement**       | Texas        |
| **25** | **`brazilLgpdAiPack`** (NEW)     | LGPD Art. 20 + PL 2338/2023 art. 13                  | **GenAI + automated decisions**            | Brazil       |
| 26     | `indiaDpdpAiPack`                | DPDP Act §§ 6 / 10 + MeitY AI Advisory (Mar 2024)    | DPDP + significant-data-fiduciary AI       | India        |
| **27** | **`nistAiRmfPack`** (NEW)        | NIST AI 100-1 + AI 600-1 GenAI Profile (Jul 2024)    | **US federal GenAI procurement**           | US           |
| **28** | **`chinaPiplGenAiPack`** (NEW)   | PIPL Art. 24 + CAC Interim Measures + Deep Synthesis | **China PIPL + GenAI registration**        | China        |
| **29** | **`japanAppiPack`** (NEW)        | APPI Arts. 17/28 + METI AI Guidelines v1.0           | **Japan APPI + cross-border AI**           | Japan        |
| **30** | **`koreaPipaPack`** (NEW)        | PIPA Art. 28-2 + AI Basic Act (eff. Jan 2026)        | **South Korea risk-tiered AI**             | South Korea  |
| **31** | **`southAfricaPopiaPack`** (NEW) | POPIA ss. 8/71 + Draft AI Framework (Aug 2024)       | **South Africa automated decisions**       | South Africa |
| **32** | **`uaePdplPack`** (NEW)          | UAE PDPL Art. 13 + DIFC AI + ADGM DP                 | **UAE / Gulf AI procurement**              | UAE          |

Coverage: **32 packs across 6 continents** — Americas (US 14 incl. NIST/CA/IL/CO/NYC/TX · Canada · Brazil) · Europe (EU 3 · UK) · APAC (Singapore · Japan · South Korea · India · China · Australia) · MEA (South Africa · UAE) · ISO international · Global (PCI DSS).

**Python SDK shipped (Wave 64, NEW):** `sovereign-matrix-verifiable-receipts`
on PyPI (v0.1). Pure-Python Ed25519 verifier + RFC 9162 transparency-log
inclusion-proof verifier. The single biggest distribution gap (Python is
~80% of working AI/ML engineers) now closed for verifier-side use. 22
unit tests + cross-language interop with the TypeScript canonical
implementation. Issuer-side signing remains TypeScript-canonical;
verification is symmetric.

**RFC 9116 `/.well-known/security.txt` (Wave 64, NEW):** auto-discovered
by HackerOne, Bugcrowd, Intigriti, GitHub Security Lab, every SIG-Lite
procurement scanner. Closes the H.2.3 procurement question line item.

**Witness federation primitive (Wave 63, NEW):** every Sovereign Matrix
deployment exposes a public observation list at
`/api/transparency/witness/observations`. A peer monitor pulls the
full set of STHs we've ever recorded cosignatures against, then
cross-checks against other witness aggregators running the same
endpoint shape. Disagreement on `(treeSize → rootHash)` between
honest witnesses is the smoke signal for log equivocation. See
`docs/WITNESSES.md` for the federation operator governance.

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

## Wave 63 shipped — six more packs + witness federation primitive

Every regulation called out in the prior Wave 63 candidate list
(Canada AIDA, UK ICO Auditing Framework + Art. 22 UK GDPR, ISO/IEC
42001, Texas CUBI + HB 4 + TX-RAMP, Brazil LGPD AI / PL 2338, India
DPDP + MeitY Advisory) is now in `ALL_PACKS` — 18 new rules and 45
new tests. Plus the witness federation observation endpoint described
above. The pack table at the top of this doc reflects the new state.

Below: the Wave 64 horizon — verticals still meeting the
three-criteria gate (enforceable, procurement budget, pattern fit).

---

## Wave 64 shipped — six continents now covered + Python SDK

Every regulation called out in the prior Wave 64 candidate list
(NIST AI RMF 600-1, China PIPL + CAC Interim Measures, Japan APPI +
METI, South Korea PIPA + AI Basic Act, South Africa POPIA + AI
Framework, UAE PDPL + DIFC AI) is now in `ALL_PACKS` — 18 new rules
and 45 new tests. Plus the Python verifier SDK and the RFC 9116
`security.txt` endpoint described above.

The next-horizon roadmap (Wave 65 candidates) lives below.

---

## Wave 65 candidates — next next-horizon

### 1. Reproducible-build + Sigstore provenance on every npm release

The supply-chain attestation layer. GitHub Actions can mint an
in-toto / SLSA L3 provenance for every `@sovereign-matrix/verifiable-
receipts` release, mirror to Rekor via Sigstore keyless signing,
and let any installer verify the published tarball is byte-for-byte
identical to the commit it claims to be built from. Closes the
"how do I know your npm release wasn't poisoned" procurement gate.

### 2. Hosted multi-region transparency log (witness federation phase 2)

Today's transparency log runs in one region. A second log instance
in a different region (Frankfurt + Singapore), pulling the same
issuer source and emitting independent STHs that can be cross-
witnessed, is the move from "single point of failure" → "Byzantine-
fault-tolerant against any one region going dark".

### 3. Public Trust Center (status + posture + audits + sub-processors aggregator)

We have `/security/live`, `/status/integrity`, `/security/posture`,
`/api/status/metrics`, `/.well-known/vaos`, `/.well-known/security.txt`,
`/api/transparency/witness/observations`. None of them aggregate.
A `/trust` page that surfaces all of these + SOC 2 II report + DPA

- sub-processor list + uptime history is the procurement-ready
  single URL. ~half-day to build.

### 4. Cash-tier bug bounty (HackerOne or Intigriti)

SECURITY.md already commits SLAs; SECURITY.txt already published
contact. The missing piece is **cash on file** so researchers
actually file. Tier-priced: receipt-forgery > log-equivocation >
Guardian-rule-bypass > standard XSS/SQLi.

### 5. Go SDK skeleton (sovereign-matrix/verifiable-receipts/go)

After Python, Go is the second-biggest verifier-language gap —
cloud / SRE / regulator tooling lives in Go. Same pattern as
the Python SDK: Ed25519 + RFC 9162 inclusion-proof verifier,
verifier-side only, `go get` distributable.

### 6. One-click deploy buttons (Railway / Render / Vercel / Fly.io)

Currently a self-host requires reading the README. One-click
deploy buttons in the README turn "this is a library" into
"this is a platform you can run by clicking a button." Each
button is ~10 minutes of config + a forked template repo.

---

**Wave 65 sizing.** Reproducible builds + Trust Center + Go SDK is
one wave (~half-day each). Multi-region log + cash bug bounty
require external coordination (Vercel/Cloud provider config + a
HackerOne onboarding) and would land in a follow-up.

---

## Wave 64 reference (shipped) — for transparency, the candidates that became packs

### 1. NIST AI RMF 1.0 Generative AI Profile (GAI-Profile) runtime hooks

- **Status**: NIST AI 600-1 published July 2024; voluntary but cited
  in every major US federal AI procurement spec from Q4 2025 onward
- **AI use case**: Any GenAI deployed in a US federal-adjacent
  procurement context; defense contractors; FedRAMP-aligned AI
- **Per-decision rule**: WARN when GenAI output lacks (a) AI 600-1
  risk-control ID reference, (b) NIST AI RMF function (Govern / Map /
  Measure / Manage) tag, (c) "AI-generated content" provenance flag
- **Market**: Federal AI procurement spend $13.5B (2025); the
  voluntary-but-de-facto-mandatory layer for US public-sector AI
- **Pattern fit**: high — NIST AI RMF maps to ISO 42001 Annex A
  control language with NIST CSF nomenclature overlay

### 2. China PIPL + Generative AI Services Interim Measures

- **Status**: PIPL in force since Nov 2021; CAC's "Interim Measures
  for the Management of Generative AI Services" (生成式人工智能服务管理暂行办法)
  effective Aug 15, 2023; algorithmic-recommendation rules layered
- **AI use case**: Any GenAI made available to Chinese mainland users;
  any cross-border AI inference of Chinese data subjects
- **Per-decision rule**: WARN on GenAI output without (a) algorithm
  filing number, (b) PIPL Art. 24 automated-decision disclosure,
  (c) content-mark for AI-generated output per Deep Synthesis rules
- **Market**: ~$50B Chinese enterprise AI market by 2027; required
  for any global SaaS shipping into mainland China
- **Risk**: ITAR / export-control entanglement requires legal review
  before shipping rule text — keep description language regulator-
  citation-only

### 3. Japan APPI + METI AI Guidelines for Business

- **Status**: APPI revised April 2022; METI "AI Guidelines for
  Business v1.0" (Apr 2024) + v1.1 (Q4 2025); Japan AI Promotion
  Act expected late 2026
- **AI use case**: Any AI processing personal data of Japanese
  residents; any AI sold to Japanese keiretsu or government
- **Per-decision rule**: WARN on output without (a) APPI consent
  basis reference, (b) METI guideline applicability tag,
  (c) cross-border-transfer attestation when applicable
- **Market**: Japan enterprise AI spend $9.2B (2025); completes
  the G7 AI-regulation circumference (US, UK, EU, Canada, Japan)

### 4. South Korea PIPA + AI Basic Act (eff. Jan 2026)

- **Status**: AI Basic Act (인공지능 기본법) passed Dec 2024,
  effective Jan 2026; layered on PIPA + the Algorithm Discrimination
  Prohibition Act
- **AI use case**: Korean residents + B2B SaaS in the K-AI ecosystem
- **Per-decision rule**: WARN when high-impact AI output lacks
  (a) PIPA consent reference, (b) AI Basic Act risk tier (general /
  high-impact / generative), (c) Korean-language right-to-explanation
- **Market**: K-AI ecosystem $14B by 2027; the third APAC pack
  rounding out Japan + Singapore + India + Australia

### 5. South Africa POPIA + draft AI National Policy Framework

- **Status**: POPIA in force since July 2021; draft AI National
  Policy Framework released by Department of Communications Aug 2024;
  Information Regulator AI guidance Q2 2026
- **AI use case**: Any AI processing personal data of SA residents;
  any AI deployed in the African financial-inclusion sector
- **Per-decision rule**: WARN on output without (a) POPIA s. 71
  automated-decision notice, (b) Information Regulator notification
  for high-risk AI per draft framework, (c) responsible-party
  attribution
- **Market**: Africa fintech AI spend $1.6B (2025) → $4.8B (2030);
  South Africa is the regulatory beachhead for the continent —
  Sovereign Matrix is South African, the home jurisdiction warrants
  shipping

### 6. UAE PDPL + DIFC AI Regulation + Dubai Digital Strategy 2031

- **Status**: UAE PDPL in force since Jan 2022; DIFC AI Regulation
  in consultation (expected Q3 2026); ADGM Data Protection Regulations
  for AI live since 2025
- **AI use case**: AI sold to UAE government + DIFC / ADGM financial
  free-zones; Gulf cross-border AI inference
- **Per-decision rule**: WARN when output lacks (a) PDPL Art. 13
  automated-decision notice, (b) DIFC AI Regulation risk-tier tag,
  (c) Arabic-language right-to-review where applicable
- **Market**: Gulf AI spend $50B by 2030; the GCC procurement
  superhub for emerging-market AI

---

**Wave 64 sizing.** 6 packs × ~3 rules each = ~18 rules + ~40 tests.
At the established velocity pattern this is a single dedicated wave.
Brings the moat to **32 packs across 6 continents**: Americas (8 packs
incl. US/CA/BR/Tex/Cal/Ill/Col/NYC) · Europe (4 incl. EU/UK) · APAC
(6 incl. SG/JP/KR/AU/IN/CN) · MEA (2 incl. ZA/UAE) · ISO international
· Global (PCI DSS). The 4th continent (Africa) and 6th continent (MEA)
land here.

---

## Wave 63 reference (shipped) — for transparency, the candidates that became packs

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
