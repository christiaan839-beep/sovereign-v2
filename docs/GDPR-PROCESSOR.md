# Data Processor Declaration — Sovereign Matrix

**Last reviewed:** 2026-05-15
**Article 28 GDPR / POPIA s.21 alignment.**

This document declares Sovereign Matrix's role as a Data Processor for customers acting as Data Controllers. Customer signs a Data Processing Agreement (DPA) that incorporates this declaration by reference. Email **legal@sovereignmatrix.agency** to request the executable DPA.

---

## 1. Roles

| Role               | Party                                                                       |
| ------------------ | --------------------------------------------------------------------------- |
| **Controller**     | The customer (the entity that runs Sovereign agents and uploads input data) |
| **Processor**      | Sovereign Matrix                                                            |
| **Sub-processors** | Listed in §4                                                                |

The customer determines the purpose and means of processing. Sovereign Matrix processes personal data **only on documented instructions from the customer** (the API call body and tenant configuration constitute documented instructions).

---

## 2. Categories of data subjects + personal data

Sovereign Matrix is a pass-through processor — we process whatever the customer sends through the agent endpoints. Typical categories observed across our verticals:

| Vertical                 | Typical data subjects                | Typical personal data                                                       |
| ------------------------ | ------------------------------------ | --------------------------------------------------------------------------- |
| Banking / SR 11-7        | Bank customers, loan applicants      | Name, account number, credit-bureau record, decisioning factors             |
| Pharma / clinical trials | Trial subjects, site staff, sponsors | Pseudonymized subject id, adverse-event narrative, signed monitoring report |
| Pharmacovigilance        | Patients (via ICSR), reporters, HCPs | Pseudonymized PV case data, MedDRA-coded events                             |
| Insurance claims         | Policyholders, claimants             | Policy id, claim narrative, adjudication decision                           |
| CSRD / ESG               | Employees, suppliers, communities    | Aggregated workforce metrics, supplier-survey responses                     |
| Defense / FedRAMP        | Federal personnel                    | Per FedRAMP boundary docs — usually pseudonymized                           |

The customer retains responsibility for **lawful basis** under GDPR Art. 6 and **special-category basis** under Art. 9 where applicable.

---

## 3. Purpose and duration of processing

**Purpose:** Execute the agent runs the customer requests. Generate cryptographically signed receipts. Store receipt metadata for the contractually agreed retention period. Deliver audit bundles to recipients the customer designates.

**Duration:** Personal data is retained per the customer's plan:

- Receipt body: retained for the audit-retention period the customer configures (default 7 years for regulated verticals).
- Receipt metadata + signature: retained for the same period — these are the auditor's verification artifacts.
- Agent run logs (input + output): retained 90 days by default; customer can reduce to 24 hours.

On contract termination, all data is exported to the customer and erased within 30 days unless legal hold applies.

---

## 4. Sub-processors

| Sub-processor                | Purpose                                     | Location                                 |
| ---------------------------- | ------------------------------------------- | ---------------------------------------- |
| Neon (PostgreSQL serverless) | Primary database                            | US-East / EU-West (per tenant residency) |
| Vercel                       | Hosting / edge functions                    | Global edge                              |
| Clerk                        | Authentication                              | US (primary)                             |
| Stripe                       | Payment processing                          | US                                       |
| Resend                       | Transactional email                         | US                                       |
| Anthropic                    | Claude LLM (when routed to Claude tier)     | US                                       |
| Google (Gemini)              | Gemini LLM (when routed)                    | Multi-region                             |
| NVIDIA NIM                   | NIM-hosted LLMs                             | Multi-region                             |
| Groq                         | Groq-hosted LLMs                            | US                                       |
| Cerebras                     | Cerebras-hosted LLMs                        | US                                       |
| Together AI                  | Together-hosted LLMs                        | US                                       |
| OpenAI                       | When customer explicitly routes (BYOK only) | US                                       |
| Sentry                       | Error monitoring                            | Customer-configurable                    |

Per Article 28(2), Sovereign Matrix gives the customer **30 days' written notice** of any new sub-processor. Customer may object; if objection cannot be resolved, customer may terminate.

**BYOK (Bring Your Own Key):** Customers can route LLM traffic through their own provider account, eliminating us as a sub-processor for the model call. Their keys are stored encrypted (AES-256-GCM with KEK/DEK split per `src/lib/envelope-encryption.ts`) and only decrypted at request time.

---

## 5. Technical and organizational measures (Art. 32 TOM)

| Measure                           | Implementation                                                                                                  |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Encryption at rest**            | AES-256-GCM, envelope-encrypted with per-tenant DEKs (`src/lib/envelope-encryption.ts`)                         |
| **Encryption in transit**         | TLS 1.3 enforced, HSTS preload                                                                                  |
| **Authentication**                | Clerk-managed, MFA required for admin roles                                                                     |
| **Authorization**                 | Role-based, per-tenant scoping enforced at every API entry (`src/lib/auth-guard.ts`, `src/lib/tenant-scope.ts`) |
| **Audit logging**                 | Operator actions logged with hashed user_id per `src/lib/audit-log.ts`                                          |
| **Tenant isolation**              | Hard tenant_id scoping in every Drizzle query; cross-tenant queries blocked by `src/lib/tenant-resolver.ts`     |
| **Cryptographic receipts**        | HMAC-SHA256 + Ed25519 signatures on every agent run; Merkle inclusion proofs                                    |
| **Backups**                       | Neon point-in-time recovery (7-day window); customer-export endpoint for portability                            |
| **Incident response**             | `docs/runbooks/*` — DR, DB-down, smoke-failing, migration-drift                                                 |
| **Sub-processor due-diligence**   | DPA signed with each; encrypted-at-rest verified                                                                |
| **Right of erasure**              | `/api/account/delete` — 22-table cascade, audit logs preserved with hashed user_id                              |
| **Right of access / portability** | `/api/account/export` — JSON dump of all tenant-owned data                                                      |
| **Data residency**                | Per-tenant routing primitive (`src/lib/tenant-residency.ts`) — US, EU, UK                                       |

---

## 6. Data subject rights

Customer (as Controller) is responsible for handling data-subject requests. Sovereign Matrix supports:

- **Access (Art. 15):** `/api/account/export` returns the full tenant dataset.
- **Rectification (Art. 16):** Customer updates source data; we re-process on next agent run.
- **Erasure (Art. 17):** `/api/account/delete` performs the cascade.
- **Restriction (Art. 18):** Customer can set a tenant flag halting agent execution while data is preserved.
- **Portability (Art. 20):** Same export as Access; machine-readable JSON.
- **Objection (Art. 21):** Customer instructs us to stop processing for a specific data subject.

We respond to customer requests for assistance within **72 hours**.

---

## 7. International transfers

When the customer routes data outside the EEA, Sovereign Matrix relies on:

- **EU Standard Contractual Clauses (2021/914 — Module 2: Controller → Processor)** for transfers to Sovereign US infrastructure.
- **UK Addendum to EU SCCs** for UK customers.
- **POPIA s.72** for South African customers.

Per-tenant residency primitive ensures EU-domiciled tenants' data does not leave the EEA absent explicit customer reconfiguration.

---

## 8. Audit + compliance

Customer (or Customer's auditor) may audit Sovereign Matrix's controls once per year with 30 days' notice. We also share:

- SOC 2 Type 2 report (planned Q3 2026; pre-audit posture available now)
- Penetration-test summary (planned with first paid pilot)
- Sub-processor due-diligence summaries on request

Sovereign Matrix's **cryptographic receipts** themselves are a form of continuous audit evidence — the customer can verify any decision in their own browser tab (`/demo/verify-receipt`).

---

## 9. Breach notification

We notify the Customer of any personal-data breach **without undue delay and in any event within 48 hours** of becoming aware. Notification includes:

- Nature of the breach + categories + approximate volumes of data subjects + records affected.
- Likely consequences.
- Containment + mitigation steps taken.
- Customer-side actions required.

---

## 10. Contact

- **DPO / GDPR queries:** dpo@sovereignmatrix.agency
- **Legal / DPA execution:** legal@sovereignmatrix.agency
- **Security disclosures:** security@sovereignmatrix.agency
- **Operations / incidents:** ops@sovereignmatrix.agency

---

## 11. Changes to this declaration

We post material changes here with **30 days' notice**. Sub-processor additions/changes follow the §4 process. The customer's DPA references the version of this document in effect at signing; we maintain version history at [docs/GDPR-PROCESSOR-HISTORY.md](./GDPR-PROCESSOR-HISTORY.md).

---

**Sovereign Matrix is committed to processing personal data with the integrity that the cryptographic receipts we ship demand. Every receipt is a self-contained, auditor-replayable artifact — by design, we cannot rewrite history.**
