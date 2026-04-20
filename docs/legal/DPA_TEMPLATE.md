# Data Processing Agreement — Template

> **⚠️ NOT LEGAL ADVICE.** This template meets GDPR Art. 28 / POPIA
> Chapter 3 / CCPA service-provider requirements as of April 2026.
> Have it reviewed by counsel in the Customer's jurisdiction before
> signing. Updated: 2026-04-20.

---

## DATA PROCESSING AGREEMENT

This Data Processing Agreement (**"DPA"**) is incorporated into and
forms part of the Master Service Agreement (**"MSA"**) between
**[CUSTOMER_NAME]** (**"Controller"**) and **Sovereign Matrix**
(**"Processor"**), effective **[EFFECTIVE_DATE]**.

If there's a conflict between this DPA and the MSA, this DPA controls
with respect to personal data.

## 1. Definitions

Terms used in this DPA have the meanings given in the EU General Data
Protection Regulation 2016/679 (**"GDPR"**), as applicable:

- **"Personal Data"** — any information relating to an identified or
  identifiable natural person.
- **"Processing"** — any operation performed on Personal Data.
- **"Data Subject"** — an identified or identifiable natural person.
- **"Sub-processor"** — any third-party processor engaged by
  Sovereign to process Personal Data.
- **"Supervisory Authority"** — an EU data protection authority or,
  where applicable, the South African Information Regulator.

## 2. Scope

2.1 Sovereign processes Personal Data on behalf of Customer to
provide the Service. The subject matter, duration, nature, purpose,
and categories of data are described in Annex I.

2.2 Customer is the Controller. Sovereign is the Processor. Where
Sovereign engages Sub-processors, they are sub-processors to Customer.

## 3. Customer's obligations as Controller

3.1 Customer warrants it has a lawful basis for the Processing it
instructs Sovereign to perform (GDPR Art. 6).

3.2 Customer is responsible for its own compliance with applicable
privacy laws, including providing notices to Data Subjects and
obtaining consents where required.

3.3 Customer instructs Sovereign only via:
- The Service configuration (e.g., agent runs, team invites);
- Written instructions to support@sovereignmatrix.agency;
- Terms of the MSA and this DPA.

3.4 Customer must not submit Special Categories of Personal Data
(GDPR Art. 9) — health data, biometric identifiers, political
opinions, etc. — unless Sovereign has explicitly agreed in writing.

## 4. Sovereign's obligations as Processor

4.1 **Process only on instructions**: Sovereign processes Personal
Data only on Customer's documented instructions, except where
required by EU or Member State law. If EU or Member State law
requires processing, Sovereign will inform Customer before processing,
unless prohibited by law.

4.2 **Confidentiality**: All persons authorized to process Personal
Data are bound by confidentiality obligations.

4.3 **Security measures**: Sovereign implements the technical and
organizational measures described in Annex II, reviewed annually.

4.4 **Assistance to Customer**: Sovereign assists Customer in:
- Responding to Data Subject requests (Art. 12–22);
- Security incident notification (Art. 33–34);
- Data Protection Impact Assessments (Art. 35–36).

4.5 **Data subject requests**: If Sovereign receives a request directly
from a Data Subject, Sovereign will forward it to Customer within 5
business days without responding to the Data Subject (unless required
by law).

4.6 **Records of Processing**: Sovereign maintains records per GDPR
Art. 30(2) and makes them available to the Supervisory Authority on
request.

4.7 **Audit rights**: On 30 days' notice, Customer may audit Sovereign's
compliance at Customer's expense, not more than once per year, unless
triggered by a Security Incident. Sovereign may provide SOC 2 or
equivalent reports in lieu of on-site audit.

4.8 **Deletion / return**: On termination, Sovereign will delete or
return all Personal Data within 30 days, except where retention is
required by law. Customer may export its data self-serve via
`/api/_audit/export?scope=self` at any time.

## 5. Sub-processors

5.1 Customer authorizes Sovereign to engage the Sub-processors listed
in Annex III.

5.2 Sovereign will notify Customer via email at least 30 days before
adding a new Sub-processor. Customer may object in writing within 30
days; if the objection cannot be resolved, Customer may terminate the
affected Order Form without penalty.

5.3 Sovereign imposes the same data protection obligations on each
Sub-processor via contract.

## 6. International transfers

6.1 Personal Data may be transferred outside the EEA / UK / South
Africa to Sub-processors in the United States and other jurisdictions.

6.2 For transfers to countries without an adequacy decision, the
Parties rely on:
- **Standard Contractual Clauses** (EU Commission Implementing
  Decision (EU) 2021/914) incorporated by reference; or
- **UK International Data Transfer Addendum** where applicable;
- Sovereign's participation in the EU–U.S. Data Privacy Framework
  (where certified).

6.3 The Parties execute the SCCs by signing this DPA:
- **Module 2** (Controller-to-Processor) for transfers from Customer
  to Sovereign;
- **Module 3** (Processor-to-Processor) for onward transfers to
  Sub-processors.
- Docking clause enabled.
- Governing law: [Republic of Ireland / Netherlands — negotiable].

## 7. Security incidents

7.1 Sovereign will notify Customer within 72 hours of becoming aware
of a Security Incident affecting Customer Personal Data, providing:
- The nature of the incident and categories/approximate number of
  Data Subjects affected;
- Likely consequences;
- Measures taken or proposed to address the incident;
- Contact details for follow-up.

7.2 Further information will be provided as it becomes available.

## 8. Liability

8.1 The limitation of liability in the MSA applies to this DPA.

8.2 Where a Supervisory Authority imposes a fine on a Party due to
the other Party's breach of this DPA, the breaching Party indemnifies
the other for that fine, subject to the MSA's liability cap.

## 9. Term & termination

9.1 This DPA runs concurrently with the MSA.

9.2 On termination of the MSA, Sovereign will act per Section 4.8
regarding Personal Data.

## 10. General

10.1 **Governing law**: Same as the MSA, subject to mandatory data
protection laws of the Data Subject's jurisdiction.

10.2 **Amendments**: Only valid if in writing and signed by both
Parties.

10.3 **Severability**: If a provision is unenforceable, the rest
remains in effect.

---

**[Signature blocks for both Parties]**

---

## Annex I — Details of Processing

| Item | Description |
|---|---|
| Subject matter | Provision of AI agent orchestration SaaS (the Service) |
| Duration | For the Subscription Term defined in the MSA / Order Form |
| Nature and purpose | Customer uses the Service to orchestrate AI agents (research, content generation, notifications). Sovereign processes Personal Data solely to operate the Service on Customer's behalf. |
| Categories of data | Names, email addresses, company information, content submitted by Customer for AI processing |
| Categories of Data Subjects | Customer's employees, Customer's customers, Customer's prospects, public B2B contacts researched via the Service |
| Special categories | None unless explicitly agreed (see Section 3.4) |
| Retention period | For the Subscription Term + 30 days post-termination |
| Deletion methodology | Full database hard-delete via `/api/_audit/delete` endpoint |

## Annex II — Security measures

Sovereign implements the measures described in `docs/security/SECURITY_QUESTIONNAIRE.md`, including:

1. **Access control**: Role-based permissions; MFA supported; 10-token-per-user cap
2. **Encryption**: TLS 1.3 in transit; AES-256-GCM at rest; PBKDF2-210k for user-derived keys
3. **Tenant isolation**: Postgres Row-Level Security on all tenant tables
4. **Input validation**: Zod schemas on every API endpoint
5. **Output safety**: 5-layer safety pipeline (LlamaGuard, PII, content, quality, critic)
6. **Audit logging**: `audit_logs` + `execution_audit` + Sentry — 30/7-day retention
7. **Secret management**: Vercel env (no secrets in code); quarterly rotation for critical keys
8. **Backup & DR**: Neon PITR (7-day window); monthly restore drill
9. **Incident response**: Documented runbook; 72-hour notification target
10. **Sub-processor contracts**: DPAs with all sub-processors in Annex III

## Annex III — Authorized Sub-processors

| Sub-processor | Purpose | Location | Contract type |
|---|---|---|---|
| Vercel Inc. | Application hosting | US, EU | DPA + SCCs |
| Neon, Inc. | Postgres database hosting | US, EU | DPA + SCCs |
| Clerk Inc. | Authentication | US | DPA + SCCs |
| Stripe Inc. | Payment processing | US, Global | DPA + SCCs |
| Upstash Inc. | Redis rate limiting | US, EU | DPA + SCCs |
| Anthropic PBC | AI model (Claude) | US | DPA + SCCs |
| NVIDIA Corp. | AI model (NIM) | US | DPA + SCCs |
| Google LLC | AI model (Gemini) | US | Google's DPA + SCCs |
| Functional Software Inc. (Sentry) | Error monitoring (PII-scrubbed) | US | DPA + SCCs |
| Resend Inc. | Transactional email | US | DPA + SCCs |

Last updated: 2026-04-20. Changes require 30-day customer notice per
Section 5.2.

---

## Customer-friendly clarifications (not part of the executable DPA)

### What Personal Data we actually process
- **You upload to an agent**: names, emails, company info in prompts
- **We collect for billing**: your admin email + Stripe customer ID
- **We collect for ops**: login timestamps, IP addresses for rate limiting
- **We DO NOT collect**: browsing history, device fingerprints, cookies
  beyond the minimum needed for authentication

### What happens if you delete your account
1. Subscription cancels immediately
2. Data hard-deleted from primary DB within 24 hours
3. Backups age out of PITR window within 7 days (Neon)
4. Sub-processor deletion happens within 30 days (per their policies)
5. Billing records retained 7 years for tax compliance (South Africa + US)

### International transfer mechanisms
- **EU Customers**: SCCs Module 2 + EU-US Data Privacy Framework (where certified)
- **UK Customers**: UK IDTA (International Data Transfer Addendum)
- **South African Customers**: Section 72 of POPIA met via SCCs
- **Swiss Customers**: Swiss Federal Act on Data Protection recognized
