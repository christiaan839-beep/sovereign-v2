# DARPA SBIR Phase I Application Draft — Sovereign Matrix

**Status:** Draft. Founder edits personal sections, leaves technical sections as-is.

Apply at https://www.dodsbirsttr.mil. Phase I = $250K, ~6-month period of performance. Phase II = $1.7M follow-on. Phase III = sole-source contract authority. **Apply on the next open solicitation cycle** (USAI, ANSR, or any verification-related topic).

---

## Topic match

Target topics (cross-list against the current open SBIR solicitation):

- **DARPA AIE / I2O — AI verification / formal methods for ML systems**
- **DARPA SafeDocs / IDAS** — formal verification of structured documents
- **USAI (Understanding the Threat to AI)**
- **ANSR (AI Network Security Research)**
- **Air Force / Army / Navy SBIR topics on AI assurance, model risk, model provenance**

The pitch maps regardless of which solicitation is open: **cryptographic chain-of-custody for AI agent decisions**.

---

## A. Cover sheet

**Company:** Sovereign Matrix
**Website:** https://sovereignmatrix.agency
**SAM.gov registration:** [register at sam.gov before submission — takes 7-14 days]
**Cage Code:** [obtained after SAM.gov]
**DUNS:** [obtained after SAM.gov]
**Principal Investigator:** [Founder name + LinkedIn + brief bio]
**Period of performance:** 6 months
**Cost-share:** None proposed (DARPA Phase I is 100% federal)
**Award amount requested:** $250,000

---

## B. Identification + significance of opportunity

**Problem statement (200 words):**

The U.S. federal government is rapidly deploying generative AI across mission-critical workflows — defense procurement narratives, intelligence analysis summaries, regulatory rulemaking commentary, and battlefield decision support. Today, none of these AI-generated outputs can be cryptographically verified after the fact. Every output is a screenshot at best — a system that promises an audit trail but ships none. When an Inspector General or congressional oversight body audits a contested AI decision, the only artifact is the agency's word that the screenshot matches what the model produced.

This is unacceptable under FISMA, NIST AI RMF, OMB M-24-10 (the AI in Federal Government memo), and the new OMB M-24-15 requirements. It is also a known active threat surface — a malicious or compromised AI provider can silently swap a model under the same name and no agency would detect it without independent cryptographic verification.

Sovereign Matrix has shipped seven cryptographic primitives that together produce an auditor-verifiable, tamper-evident, replayable receipt for every AI agent decision: HMAC-SHA256 + Ed25519 signatures, Merkle inclusion proofs, receipt-chain ratchet, output watermarking, anonymous-credential auditor seats, verifiable model fingerprinting, and zero-knowledge cross-tenant pass-rate proofs.

**Significance to DoD / DARPA mission:**

The next decade of DoD AI deployment requires assurance primitives that are mathematically verifiable, not policy-stipulated. The 7 primitives Sovereign ships are pure, library-grade implementations that any federal AI deployment can adopt without changing model providers. Adoption velocity matters; we are the only commercial-off-the-shelf option ready today.

---

## C. Phase I technical objectives

**Objective 1 (months 1-2): Federal threat-model adaptation.** Adapt the existing cryptographic primitives to the federal threat model — air-gapped deployment, FIPS 140-3-validated cryptography, NIST SP 800-90A-compliant entropy, and the controlled-unclassified-information (CUI) handling requirements of DFARS 252.204-7012.

**Objective 2 (months 2-3): Verifiable model fingerprinting for federal LLM stacks.** Extend the model-fingerprint primitive (`src/lib/model-fingerprint.ts`) to cover the federal-only LLM stack — DoD-hosted Llama, Anthropic via FedRAMP, AWS Bedrock for federal — and produce a behavior-canary suite that detects silent model swaps within 99.5% confidence on 20 canary prompts.

**Objective 3 (months 3-5): Anonymous-credential auditor seats for IG / GAO.** Extend the anonymous-credential primitive (`src/lib/anon-credential.ts`) to support per-tenant cross-agency replay — an Inspector General can verify any executive-branch AI decision via anonymous credentials without exposing the originating agency's tenant identity.

**Objective 4 (months 5-6): Federal AI Assurance reference deployment.** Build a reference implementation showing the seven primitives running end-to-end in a federal-friendly stack (Air Force / DoD Engineering Test Environment). Open-source the wrapper library so any federal AI deployment can integrate via `npm install @sovereign/federal-assurance` (or Python equivalent).

---

## D. Work plan

| Month | Deliverable                                                      |
| ----- | ---------------------------------------------------------------- |
| 1     | Federal threat-model document + FIPS migration plan              |
| 2     | FIPS-validated crypto wrapper + air-gapped deployment kit        |
| 3     | Federal-LLM-stack behavior canary suite (20 canaries × 5 models) |
| 4     | Anonymous-credential cross-agency replay primitive               |
| 5     | Reference deployment running on DoD ETE / GovCloud               |
| 6     | Open-source wrapper library + DARPA technical report             |

---

## E. Related work + prior art

Sovereign Matrix's seven cryptographic primitives are documented in the open codebase at https://github.com/christiaan839-beep/sovereign-v2— review the receipts spec at sovereignmatrix.agency/spec for the complete protocol.

Adjacent prior art:

- **MIT CSAIL Verifiable AI** — academic; no production deployment.
- **NIST AI Risk Management Framework** — policy framework, not a primitive library.
- **Google / OpenAI model cards** — disclosure documents, not cryptographic artifacts.
- **HuggingFace Inference Endpoints** — model-hosting infrastructure, no audit trail.
- **Anthropic Constitutional AI** — output filtering, no cryptographic chain-of-custody.

Sovereign Matrix is differentiated by being **commercial-off-the-shelf today** with seven primitives already shipping in production code with 2,400+ tests passing.

---

## F. Key personnel

**Principal Investigator: [Founder name]**

- [Education / credentials]
- [Prior security / cryptography work — link to prior github / paper / conference talk]
- Solo technical founder of Sovereign Matrix. Author of all seven cryptographic primitives. 215,000 LOC TypeScript in the production codebase.

**Federal liaison (sub):** TBD — Phase I budget includes 80 hours of contract federal-compliance advisor (target: ex-FedRAMP 3PAO or ex-IG technical lead).

---

## G. Facilities + equipment

- Cloud-compute via AWS Activate ($100K credits secured) and Microsoft for Startups ($150K Azure credits)
- Vercel hosting for the production platform
- Neon (PostgreSQL serverless) — currently US-East / EU-West, will migrate to GovCloud for federal scope

No federal facilities required for Phase I. Phase II will migrate to GovCloud (FedRAMP High).

---

## H. Budget summary

| Line item                                               | Amount       |
| ------------------------------------------------------- | ------------ |
| PI salary (6 months, FTE)                               | $120,000     |
| Federal liaison (80 hrs × $250/hr)                      | $20,000      |
| FIPS 140-3 validation engagement                        | $35,000      |
| Cloud infrastructure (GovCloud)                         | $15,000      |
| Sub-contractor (cryptographer review, 40 hrs × $400/hr) | $16,000      |
| Travel (DARPA meetings, $2K × 4 trips)                  | $8,000       |
| Materials + equipment                                   | $5,000       |
| Indirect costs (overhead)                               | $25,000      |
| Profit / fee (7%)                                       | $6,000       |
| **Total**                                               | **$250,000** |

---

## I. Phase II + Phase III commercialization plan

**Phase II ($1.7M, 24 months):** Production deployment in 3 federal customer environments (target: USPTO AI assistance, VA medical AI, DARPA program review systems). Hire 4 engineers + 1 federal-sales lead. Phase III = sole-source for follow-on production contracts.

**Commercial revenue trajectory (already underway):**

- Vertical landings live for CSRD, SR 11-7, NERC CIP, 21 CFR Part 11, NAIC, FedRAMP
- Stripe SKUs wired: $50K/yr Auditor Replay Seats + $45-75K/yr Regulatory Packs
- Self-serve revenue surface live at sovereignmatrix.agency/starter-packs

This SBIR is the federal acceleration; commercial revenue is the dual-use path.

---

## What you do AFTER submitting

1. Track the application via the SAM.gov dashboard.
2. Re-DM the relevant DARPA program manager 7 days after submission with a 60-second video demo of `/demo/verify-receipt` working live.
3. Apply IN PARALLEL to **NSF SBIR Track G** ($275K Phase I), **IARPA SCISRS** ($250K-$2M), and **EU Horizon Europe** (up to €2M). All three accept the same technical core with minor reframing.
4. Email **In-Q-Tel** with the same pitch — they're the CIA's strategic-investment arm and pay for AI verification tools directly.

The crypto-receipts moat is exactly the kind of dual-use defensive primitive these programs are explicitly looking for. Apply to all four within 30 days.
