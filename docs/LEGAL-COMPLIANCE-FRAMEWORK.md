# Sovereign Matrix — Legal & Regulatory Compliance Framework

> The procurement-grade "what laws apply, what's our posture, and what's
> the customer's responsibility" map. This document does NOT constitute
> legal advice; it's a structured statement of how the platform's
> primitives align with applicable laws + where customer obligations
> kick in.
>
> **Last updated:** 2026-04-29 (R67 cumulative)
> **Maintained by:** anti-drift gates in `scripts/weekly-health.mjs`
> **Companion doc:** `docs/COMPLIANCE-MAPPING.md` (file-path-level
> control mapping)

---

## How to read this document

For each applicable law / regulation:

1. **What it requires** — the operative obligation
2. **Sovereign's posture** — what we DO and what we DO NOT do
3. **Customer responsibility** — what the deploying customer must do
4. **Which platform primitive helps** — file paths in this codebase
5. **Disclaimers** — explicit scoping limits

---

## CRITICAL DISCLAIMERS (read first)

### 1. We are NOT a regulated insurer.

R46 (`src/lib/agent-underwriting.ts`) ships **rating model mathematics**
— the same role ISO/Verisk play in P&C insurance. We do NOT issue
insurance policies. We do NOT bear underwriting risk. We do NOT
collect premiums on policies. Customers who want insurance for AI
agent action liability must engage a licensed insurance carrier or
MGA who uses our rating math (or their own) to write the policy.

**Customer responsibility:** if you want actual insurance, contract
with a carrier (Lloyd's syndicate, US-admitted carrier, MGA, captive)
who will issue a policy. The R46 math is freely usable; the policy
is the carrier's.

### 2. We are NOT a law firm and do NOT practice law.

R52 (Legal e-Discovery Pack) ships **tools for licensed attorneys**.
The pack drafts privilege classifications, redactions, production
sets — but every output requires attorney sign-off (R34 CADC) before
becoming binding. Drafts are not legal advice. Sovereign Matrix does
not represent any party in any matter. Use of the platform does not
create an attorney-client relationship between Sovereign and any
party.

**Customer responsibility:** licensed attorneys must review and
sign off on every output before it's produced, filed, or relied
upon. The pack's HITL rules ENFORCE this technically (FRCP 11
sign-off is a hard gate).

### 3. We are NOT practicing medicine and do NOT diagnose patients.

R49 (Healthcare Claims Pack) ships **tools for licensed clinicians
and compliance teams**. Agent drafts of prior-auth denials,
breach-notification letters, FDA submissions — every one requires
the responsible licensed professional's R34 signature before being
sent or filed. Sovereign does not diagnose, prescribe, or recommend
treatment.

**Customer responsibility:** licensed physicians, pharmacists,
nurses, and other regulated professionals must review and sign each
output before clinical or patient-facing use.

### 4. We are NOT a money transmitter.

R30 cost-runaway tracks platform-internal cost ledgers. R42-R43
Trust-as-Collateral modulates internal spend caps. We do not transmit
money on behalf of customers. We do not custody customer funds.
Stripe-mediated billing happens at the customer's election; we are
not in the payment flow.

### 5. We are NOT a credit reporting agency.

R40 reputation grades are SUBJECT-RECOGNIZED data computed from a
customer's own platform usage. Reputation data is not used by
Sovereign for "consumer credit eligibility" determinations within
the meaning of the FCRA. The platform does NOT broker credit-eligibility
information about people.

### 6. We are NOT acting as a covered entity under HIPAA.

If a customer processes PHI on the platform, Sovereign acts as a
**Business Associate** — but only after a Business Associate
Agreement (BAA) is executed in writing. The R49 Healthcare Claims
Pack's vendor-BAA-tracking HITL rule **HARD-BLOCKS** vendor data
sharing until a BAA exists.

**Customer responsibility:** execute a BAA with Sovereign Matrix
before processing any PHI. Until the BAA is signed, the platform
will reject PHI-handling actions at the HITL gate.

---

## United States — Federal laws & regulations

### HIPAA / HITECH (45 CFR Part 160-164)

**What it requires:** covered entities and business associates must
implement administrative, physical, and technical safeguards for PHI;
notify HHS + affected individuals of breaches affecting >500 within
60 days.

**Sovereign's posture:** acts as a Business Associate under executed
BAA. Implements §164.312 Technical Safeguards via:
- §164.312(a) — Access Control: R34 CADC (Ed25519 signing) +
  R37 ACTs + R55 CMEK
- §164.312(b) — Audit Controls: R26 hash-chained audit log +
  R67 anomaly cron (`src/app/api/cron/detect-anomalies/route.ts`)
- §164.312(c)(1) — Integrity: R26 chain integrity check (every 6h)
- §164.312(c)(2) — Mechanism to authenticate ePHI: R34 + R45 audit
  export with chain hash
- §164.312(d) — Person/entity authentication: Clerk MFA + per-user
  Ed25519 keys
- §164.312(e) — Transmission security: TLS via Vercel + canonical-
  JSON-signed payloads + R58 webhook signing

**Customer responsibility:** sign BAA; designate Privacy Officer;
configure R49 pack's HITL rules; enforce CMEK; train workforce.

**See:** `docs/COMPLIANCE-MAPPING.md` HIPAA section.

### EU AI Act (Regulation 2024/1689)

**What it requires:** for high-risk AI systems (Article 6 + Annex
III), establish risk management, data governance, technical
documentation, human oversight (Article 14), accuracy/robustness
(Article 15), and quality management.

**Sovereign's posture:** we provide infrastructure that DEPLOYERS
of high-risk AI systems use to satisfy their obligations. The
R33 multi-stage HITL system + R34 user-signed actions
**cryptographically satisfy Article 14** — natural persons can
demonstrably oversee.

**Customer responsibility:** if you're a "provider" or "deployer"
of a high-risk AI system under Article 6, you bear the primary
obligations. Use Sovereign's primitives to implement. Maintain your
own technical documentation per Article 11.

**See:** `docs/COMPLIANCE-MAPPING.md` EU AI Act section.

### FCRA (15 USC §1681) — Fair Credit Reporting Act

**What it requires:** consumer reporting agencies + users of consumer
reports must follow accuracy, dispute, and adverse-action procedures.

**Sovereign's posture:** the platform does NOT broker consumer credit
eligibility information. R40 agent reputation is NOT a consumer
report — it scores SOFTWARE AGENTS, not natural persons.

**Customer responsibility:** if you USE Sovereign in a consumer-
report-generating workflow (e.g., HR pack's background checks),
you are responsible for FCRA compliance. The R62 HR Compliance
Pack's HITL rules enforce adverse-action notice requirements.

### EEOC / Title VII / ADA — Federal anti-discrimination

**What it requires:** employers may not discriminate based on
protected characteristics (race, sex, age, disability, etc.).
Algorithmic hiring tools must not produce disparate impact.

**Sovereign's posture:** the R62 HR Compliance Pack ships:
- Bias-audit HITL rules for any agent-driven hiring decision
- Mandatory human review on any rejection at the candidate stage
- Pre-built audit queries for EEOC charge response
- Default ACT scope: read-only (agents draft + score; hiring
  managers sign final decisions)

**Customer responsibility:** conduct your own statistical bias
audits; preserve records per 29 CFR 1602.14; respond to EEOC
charges per 29 CFR 1601.

### NYC Local Law 144 (Automated Employment Decision Tools)

**What it requires:** employers using AEDTs must publish bias-audit
results within 1 year + provide candidate notice.

**Sovereign's posture:** R62 HR Pack's pre-built audit queries
generate the input data for an annual independent bias audit
(`audit-eedtBiasAudit-365d` query). The required candidate notice
is generated as a draft; HR signs and posts.

**Customer responsibility:** engage an independent auditor (NYC's
definition); publish on a publicly-accessible URL; notify candidates
ten days before use.

### Colorado AI Act (SB 24-205, effective Feb 2026)

**What it requires:** developers + deployers of "high-risk AI
systems" affecting consequential decisions (housing, employment,
finance, healthcare, etc.) must conduct impact assessments,
provide consumer notices, and exercise reasonable care to avoid
algorithmic discrimination.

**Sovereign's posture:** R62 HR Pack + R47 Banking Pack + R49
Healthcare Pack all include the impact-assessment scaffolding
(documented HITL rules, audit logs, bias-detection signals).

**Customer responsibility:** complete impact assessments for any
"consequential decision" workflow you build on Sovereign; provide
consumer notices; document risk-management practices.

### SEC / FINRA / OCC / FFIEC — Financial regulators

**What they require:** registered investment advisers, broker-dealers,
banks, and credit unions face myriad rule-sets (17a-4 records, 3110
supervision, OCC Compliance Management Systems, FFIEC IT Handbook).

**Sovereign's posture:** R47 Banking Compliance Pack maps to:
- 12 CFR 30 (OCC Heightened Standards)
- OCC Bulletin 2013-29 (third-party risk)
- 12 USC 1820 (examination authority)
- 31 CFR 1020.320 (BSA reporting / SAR / CTR)
- SEC Rule 17a-4 (broker-dealer record retention) — R45 audit
  export satisfies 17a-4 e-records integrity requirements
- FINRA Rule 3110 (supervision) — R34 CADC sign-off chain

**Customer responsibility:** YOU (the regulated entity) are
responsible for your registration, examinations, and enforcement
posture. Sovereign provides infrastructure; the regulated activity
remains yours.

### SOX (Sarbanes-Oxley §404)

**What it requires:** public-company management must establish
ICFR (internal controls over financial reporting) + auditors test
operating effectiveness.

**Sovereign's posture:** the R26 audit chain + R44 signed
reliability attestations + R67 anomaly detection produce ICFR-grade
audit trails for any agent-driven financial workflow. SOC 2 Type II
is the procurement-acceptable substrate.

**Customer responsibility:** if you're a public company subject to
SOX, design your control framework; engage your external auditor
(PwC/EY/Deloitte/KPMG); test operating effectiveness annually.

### CCPA / CPRA (California Consumer Privacy Act)

**What it requires:** businesses processing personal info of CA
residents must honor opt-out rights, deletion rights, access rights.

**Sovereign's posture:** R45 customer-managed audit-log export
provides the technical foundation for access requests (your data
flows out to your S3, then to the consumer). R26 hash chain
preserves a record of every access without exposing the underlying
PII (which lives encrypted via R55 CMEK).

**Customer responsibility:** maintain your privacy policy; honor
opt-out + deletion requests within 45 days; track CA data flows.

### CFAA / Computer Fraud and Abuse Act

**Sovereign's posture:** every agent action is signed by a human
(R34 CADC); ACT capability tokens (R37) bound what each agent can
do; audit chain (R26) records all access. This is the technical
substrate for "authorized access" — agents can ONLY do what their
ACT scope permits.

**Customer responsibility:** issue ACTs only for authorized
workflows. Document your authorization decisions. Don't deploy
agents to access systems without permission.

---

## United States — State + sector-specific

### NYC Local Law 144 — see above

### Colorado SB 24-205 — see above

### California SB 1047 (vetoed Sep 2024 but successor likely)

If a successor passes, AI safety duty-of-care obligations attach to
"frontier models" (>$100M training compute). Sovereign Matrix is
not a frontier-model developer; we're a deployment platform.
Customer responsibility: monitor evolution.

### Texas TRAIGA (2025 if enacted), Virginia AI Act, etc.

State AI laws are proliferating. Sovereign's substrate (R33 HITL,
R26 audit, R34 CADC) should satisfy most "human oversight"
requirements. Customer responsibility: track state-specific
requirements; document your compliance posture per state.

### State insurance regulators (NAIC + state-by-state)

**Sovereign's posture:** R46 underwriting math is a rating model.
Carriers writing policies based on it must file rates per state
requirements (admitted) or use surplus-lines treatment (non-admitted).

**Customer responsibility:** if you're a carrier or MGA, file your
rates per state; comply with NAIC Model #880 (AI in insurance) when
adopted in your states.

---

## European Union

### GDPR (Regulation 2016/679)

**What it requires:** lawful basis for processing personal data;
data-subject rights; cross-border transfer mechanisms.

**Sovereign's posture:** acts as a **processor** for customer-
controlled personal data. Customers are controllers. R55 CMEK +
R45 audit export provide data-subject access + deletion technical
support. We will execute Standard Contractual Clauses (Module 2 +
Module 3) for cross-border transfers.

**Customer responsibility:** establish lawful basis (Art 6); execute
DPA with Sovereign; respond to data-subject requests (Arts 15-22);
maintain ROPA (Art 30); appoint DPO if required (Art 37).

### EU AI Act — see above

### NIS2 Directive (cybersecurity)

For "essential" + "important" entities. R44 signed reliability
attestations + R67 anomaly detection + R34 CADC together provide
the technical security baseline NIS2 demands.

---

## United Kingdom

### UK GDPR + Data Protection Act 2018

Substantially same as EU GDPR; same posture.

### UK AI regulation framework

Currently sectoral (FCA for financial, MHRA for healthcare, etc.).
Sovereign's vertical packs map directly. Customer responsibility:
follow your sector regulator's guidance.

---

## Australia, Canada, Singapore, Brazil

Each has GDPR-equivalent privacy law (Privacy Act 1988 / PIPEDA /
PDPA / LGPD). Sovereign's posture mirrors GDPR; technical primitives
(R55 CMEK, R45 audit export, R26 chain) provide the substrate.
Customer responsibility: localize compliance to your jurisdiction.

---

## Export controls

### US EAR (Export Administration Regulations)

**What it requires:** dual-use cryptographic software is controlled
under Category 5, Part 2 of the Commerce Control List.

**Sovereign's posture:** Ed25519 signing (R34, R44, R45, R58) is
**publicly available and mass-market** under §740.17(b)(2) (TSU
exception) and §742.15(b) (License Exception ENC). The
`@sovereign/inspector` open-source package is publicly published
on npm.

**Customer responsibility:** if you operate in a sanctioned
jurisdiction (Cuba, Iran, North Korea, Syria, Crimea, Donetsk,
Luhansk), Sovereign is unavailable. Comply with OFAC sanctions.

### EU Dual-Use Regulation 2021/821

Same crypto-export posture; mass-market exception.

---

## Industry self-regulatory standards

### NIST AI RMF (AI Risk Management Framework)

Voluntary but increasingly required by federal contracts. R26-R67
substrate satisfies all four NIST RMF functions:
- GOVERN: docs/PROJECT-CONSTITUTION.md, ADRs
- MAP: agent identity manifests (R38), threat model
- MEASURE: reputation (R40), credit lines (R42), reliability
  attestations (R44), anomalies (R57+R67)
- MANAGE: HITL (R33), cost-runaway (R30), ACT revocation (R37)

### ISO 27001 / 27017 / 27018

Sovereign-deployer's responsibility (operator certifies). The
substrate (signed audits, encryption, access control, monitoring)
is shipped; the certification scope is the operator's.

### SOC 2 Type II

Sovereign's procurement target: complete first observation period
in 2026. Customer can request the SOC 2 report under NDA after
completion.

### PCI DSS

If a customer processes payment cards on Sovereign, PCI DSS applies.
R55 CMEK + R45 audit export + R34 CADC + R26 chain together provide
the technical safeguards. Customer must complete their own annual
assessment.

### HITRUST CSF

Healthcare-specific framework that maps to HIPAA + ISO + NIST.
R49 Healthcare Pack maps to HITRUST controls (see
`docs/COMPLIANCE-MAPPING.md`).

---

## Algorithmic-bias + AI-discrimination posture

This deserves a section of its own because it's the highest-risk
area for AI platforms.

### Why this matters

EEOC issued AI-hiring guidance in May 2023; NYC LL144 went into
effect; Colorado SB 24-205 takes effect Feb 2026; California
proposed AB 2930. The trend is clear: algorithmic discrimination
is enforceable under existing civil-rights laws AND new AI-specific
laws.

### Sovereign's posture (across all packs)

1. **Default ACT scope is READ-ONLY** for any pack touching
   protected-class-relevant data (HR, healthcare, banking).
   Agents cannot autonomously make adverse decisions.
2. **HITL is mandatory** for any decision affecting consequential
   outcomes (R33 multi-stage HITL with regulatory citations).
3. **Cryptographic accountability** — every decision is signed by
   a named human (R34 CADC). EEOC charge defense becomes "show me
   the signature" instead of "the algorithm decided."
4. **Bias-audit substrate** — R26 audit log captures every input
   feature + decision + signer + timestamp. This is the data feed
   for an independent auditor's bias study.
5. **No black-box rating** — R57 anomaly detector is statistical
   (z-score, rate comparisons). No ML, no opaque model. Operators
   can audit the math.

### Customer responsibility

- Conduct annual bias audits (NYC LL144) or impact assessments
  (Colorado SB 24-205)
- Document feature engineering + model selection decisions
- Provide consumer notices where required
- Maintain records per EEOC retention rules

---

## Customer-facing data flow (the data-sovereignty story)

| Step | Where data lives | Who controls | Crypto |
|---|---|---|---|
| 1. Ingestion | Customer's API call → Sovereign Vercel edge | Customer (TLS) | TLS 1.3 |
| 2. At-rest | Encrypted via R55 CMEK | Customer's CMK in their KMS | AES-256-GCM via tenant DEK |
| 3. Processing | In Sovereign process memory (transient) | Customer (CMEK unwrap required) | AEAD |
| 4. Audit | Hash-chained to audit_logs | Both — customer can export | sha256 chain |
| 5. Export | Signed batch → customer's S3 | Customer | Ed25519 + chain |
| 6. Verification | Customer-side via @sovereign/inspector | Customer (offline) | Ed25519 verify |
| 7. Retention | Customer-controlled (export = canonical) | Customer | — |
| 8. Deletion | Customer destroys CMK → data unreadable | Customer | CMK destroy |

**The bottom line:** the customer holds the keys to their data.
Sovereign cannot decrypt without the customer's KMS. If the
customer revokes their CMK, the data is permanently unreadable.
This is the strongest data-sovereignty story shipping in agent
infrastructure.

---

## Audits, certifications, and procurement responses

### What we have

- **Anti-drift CI gate**: 430 invariants (`scripts/weekly-health.mjs`)
- **Public threat model**: `docs/THREAT_MODEL.md`
- **Compliance mapping**: `docs/COMPLIANCE-MAPPING.md`
- **Open-source verifier**: `@sovereign/inspector`

### What we're working on (Year 1 targets)

- **SOC 2 Type II**: 90-day observation in flight
- **ISO 27001**: scoped for Year 2
- **HITRUST CSF (healthcare)**: scoped for Year 2

### What customers can request under NDA

- SOC 2 Type II report (when complete)
- Penetration test reports (when complete)
- Insurance certificates (E&O / cyber-liability)
- Sub-processor list

### What customers can verify ANYTIME without an NDA

- Run `npx @sovereign/inspector full https://sovereignmatrix.agency`
- Inspect the source code on github.com/christiaan839-beep/sovereign-v2
- Read the threat model + ADRs + this document

---

## Reporting suspected non-compliance

If you believe a Sovereign-deployment is non-compliant or violating
applicable law, report via:
- security@sovereignmatrix.agency (vulnerabilities)
- compliance@sovereignmatrix.agency (regulatory concerns)
- The R45 customer-managed audit export contains the cryptographic
  evidence; bring it.

---

## What this document is NOT

- **Not a legal opinion.** Engage qualified counsel for your specific
  regulatory profile.
- **Not a replacement for due diligence.** Customers must conduct
  their own legal review.
- **Not a guarantee.** Compliance is the deployer's responsibility;
  this document maps OUR posture to common laws so you can answer
  specific questionnaire items.

What it IS:

- **A starting point** for procurement and legal-team review
- **A living document** maintained by the anti-drift CI gate
- **A procurement accelerator** — turning weeks of "do you comply
  with X?" into hours of "yes, here's our specific posture and
  here's the file path that implements it"
