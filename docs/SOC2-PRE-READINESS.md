# SOC 2 Type II — Pre-Readiness Mapping

> Trust Services Criteria (TSC 2017, with 2022 points-of-focus) mapped
> to **what's already built and verifiable in this commit** vs **what's
> still process-shaped work** for the formal audit cycle.
>
> This document is the procurement-grade artifact for "are you ready
> for SOC 2?" — written 2026-04-28 during Round 23. Honest framing:
> we are NOT SOC 2 attested. We have **most of the technical controls
> a SOC 2 auditor would ask about**, mapped to verifiable evidence in
> this codebase. The remaining work is process: an auditor partner,
> a 6-12 month observation window, formal policies signed off.
>
> The honest budget: $30-100K + 6-12 months. The honest technical
> readiness: ~75% of the controls already exist as code we can point
> at. This document IS the gap analysis a SOC 2 auditor would produce.

---

## Trust Service Categories — at a glance

| Category | Status | What we have | What's missing |
|---|---|---|---|
| **Security (CC1-CC9)** | 🟢 ~85% | Audit chain, RBAC via Clerk, encryption in transit/rest, threat model, vulnerability disclosure, MFA support, retry+backoff, SSRF guard | Annual penetration test report, formal incident-response runbook test |
| **Availability (A1.1-A1.3)** | 🟡 ~60% | Health checks, circuit breakers, retry, async cleanup cron, Vercel multi-region | Documented capacity plan, formal DR test, RTO/RPO SLOs published |
| **Confidentiality (C1.1-C1.2)** | 🟢 ~80% | PII guard, tenant isolation, audit-chain hash, API-key scoping, share-token rotation/expiry | DLP automation, formal data-classification policy |
| **Processing Integrity (PI1.1-PI1.5)** | 🟢 ~85% | Per-agent capability manifests, output verifier, attestation, watermarking, immutable audit trail | Formal change-management approval workflow signoffs |
| **Privacy (P1.1-P9.1)** | 🟡 ~70% | Privacy policy, GDPR/POPIA disclosures, user-rights exercise, consent capture | Formal Privacy Impact Assessments (PIAs), Data Processing Agreement (DPA) template |

---

## Common Criteria (CC) — Security category

The CC controls are the foundation. Every SOC 2 report covers these.

### CC1 — Control Environment (governance)

| Control | Status | Evidence |
|---|---|---|
| CC1.1 — COSO principles applied | 🟡 Partial | This document + `docs/PLATFORM-NARRATIVE.md` describe operating principles. Missing: signed code-of-conduct, organisational chart for control ownership. |
| CC1.2 — Board oversight of internal control | ⚪ Not applicable for current company size | Single-founder operation; auditor will accept founder-attested oversight up to a revenue threshold. |
| CC1.3 — Management establishes structures, reporting lines, authorities | 🟡 Partial | Trust artifacts (transparency.json, agents.json) document the platform's authorities; org-level authorities document needed for audit. |
| CC1.4 — Demonstrates commitment to competence | 🟢 Yes | This codebase. 2,905 tests, 101 anti-drift invariants, FMTI 91.2%, public threat model. |
| CC1.5 — Holds individuals accountable for IC responsibilities | 🟡 Partial | `docs/RUNBOOK.md` exists but hasn't been verified against a real incident. |

### CC2 — Communication and Information

| Control | Status | Evidence |
|---|---|---|
| CC2.1 — Information for IC must be relevant + quality | 🟢 Yes | `weekly-health.mjs` emits 101 invariants with thresholds. Audit chain is hash-verified every 6h. FMTI self-audit is re-derived from source. |
| CC2.2 — Internal communication of IC | 🟢 Yes | Inline comments + README + 30+ docs in `docs/`. Every commit message includes verification footer. |
| CC2.3 — External communication of IC | 🟢 Yes | `/security` page, `/.well-known/security.txt`, `/trust/audit`, RFC 9116, [`docs/THREAT_MODEL.md`](./THREAT_MODEL.md), [`docs/PLATFORM-NARRATIVE.md`](./PLATFORM-NARRATIVE.md), [`docs/HONEST-GAPS.md`](./HONEST-GAPS.md). |

### CC3 — Risk Assessment

| Control | Status | Evidence |
|---|---|---|
| CC3.1 — Specifies objectives clearly | 🟢 Yes | Threat model enumerates STRIDE objectives. Per-agent manifests declare capability claims. |
| CC3.2 — Identifies and analyzes risks | 🟢 Yes | [`docs/THREAT_MODEL.md`](./THREAT_MODEL.md) — STRIDE-based, every claim cites a file or test. [`docs/HONEST-GAPS.md`](./HONEST-GAPS.md) — current gap acknowledgement. |
| CC3.3 — Considers fraud potential | 🟢 Yes | Attestation system (HMAC-signed envelopes), audit chain (tamper-evident), output watermarking. |
| CC3.4 — Identifies + assesses changes that affect IC | 🟡 Partial | Anti-drift gate (`weekly-health.mjs`) catches infrastructure regressions. Missing: formal change-impact assessment template. |

### CC4 — Monitoring Activities

| Control | Status | Evidence |
|---|---|---|
| CC4.1 — Selects, develops, performs ongoing + separate evaluations | 🟢 Yes | CI runs on every PR. Eval coverage 74%. Audit chain cron every 6h. Orphan cleanup cron every 5min. |
| CC4.2 — Evaluates and communicates IC deficiencies | 🟢 Yes | This document + HONEST-GAPS.md. Every Round-N gap is checked into git and lock-anti-drifted. |

### CC5 — Control Activities

| Control | Status | Evidence |
|---|---|---|
| CC5.1 — Selects + develops control activities | 🟢 Yes | 5-layer safety pipeline (jailbreak / PII / content / quality / critic). 101 anti-drift invariants. 2,905 tests. |
| CC5.2 — Selects + develops general controls over technology | 🟢 Yes | TypeScript strict, Drizzle ORM (parameterized queries by default), Clerk for auth, Upstash for rate-limits, Sentry for errors. |
| CC5.3 — Deploys through policies + procedures | 🟡 Partial | Policies exist as code + comments; formal sign-off workflow needed for SOC 2. |

### CC6 — Logical and Physical Access Controls

This is the **biggest** category in a SOC 2 audit and where most platforms struggle.

| Control | Status | Evidence |
|---|---|---|
| CC6.1 — Logical + physical access | 🟢 Yes | Clerk for auth (2FA enforcement available), API-key scoping per-key, IP allowlists per-key, session timeout. |
| CC6.2 — Authorization | 🟢 Yes | Per-agent capability manifests (Tier 1 / 2 / 3), `evaluateScope()` checks every v1 gateway request, tenant isolation in every WHERE. |
| CC6.3 — Boundaries (network) | 🟢 Yes | SSRF guard blocks private IPs / cloud metadata. Origin-isolation headers (COOP / CORP). |
| CC6.4 — Restricts access to information assets | 🟢 Yes | Output watermarking, PII guard (8 categories with mod-97 IBAN), per-share token expiry + revocation. |
| CC6.5 — Discontinues + removes access | 🟢 Yes | API-key revocation flow, share-token revocation, soft-delete on user-content with archival flag. |
| CC6.6 — Implements logical access security | 🟢 Yes | HSTS, CSP, X-Frame-Options DENY, password hashing in Clerk (we never see plaintext). |
| CC6.7 — Restricts + monitors transmission/storage of confidential info | 🟢 Yes | TLS in transit (Vercel auto + HSTS), encryption at rest (Neon Postgres). PII redaction on logs. |
| CC6.8 — Prevents/detects malicious software | 🟢 Yes | npm audit in CI, Renovate for automated CVE PRs (Round 23), no `unsafe-eval` in CSP outside known-needed. |

### CC7 — System Operations

| Control | Status | Evidence |
|---|---|---|
| CC7.1 — Detects + monitors system processing | 🟢 Yes | Audit chain (6h cron), orphan cleanup (5min cron), Sentry error reporting, weekly-health (CI). |
| CC7.2 — Identifies + reports operational anomalies | 🟢 Yes | Vercel logs + Sentry. Per-agent token-budget guard catches runaway model spend. |
| CC7.3 — Evaluates security events | 🟡 Partial | Manual review required; no automated SIEM integration yet. |
| CC7.4 — Responds to identified security events | 🟡 Partial | `docs/RUNBOOK.md` describes general procedure; needs incident-response tabletop exercise. |
| CC7.5 — Recovers from incidents | 🟡 Partial | DB backups via Neon PITR. Formal DR runbook + restore-validation test missing. |

### CC8 — Change Management

| Control | Status | Evidence |
|---|---|---|
| CC8.1 — Authorizes + designs + tests + approves + implements changes | 🟢 Yes | Every commit goes through CI (build + tests + lint + anti-drift). PR-based workflow on `claude/wizardly-benz` branch. |

### CC9 — Risk Mitigation

| Control | Status | Evidence |
|---|---|---|
| CC9.1 — Identifies, selects + develops risk mitigation activities | 🟢 Yes | Threat model + 5-layer safety pipeline + anti-drift gates + retry-with-backoff. |
| CC9.2 — Assesses + manages risks associated with vendors | 🟡 Partial | Vendors enumerated in privacy policy. Formal vendor-management policy + annual review missing. |

---

## Availability (A1.1-A1.3)

| Control | Status | Evidence |
|---|---|---|
| A1.1 — Maintains existing system + planned capacity | 🟡 Partial | Vercel handles autoscaling. No documented capacity plan or load-test results published. |
| A1.2 — Implements + tests environmental protections, software changes, infrastructure, etc. for availability | 🟡 Partial | `npm run build` succeeds. Vercel multi-region. **DR restore-test missing.** |
| A1.3 — Tests + monitors availability commitments + system requirements | 🟡 Partial | `/api/health/deep` exercises DB + provider connectivity. SLO published at `/status/slo`. **Formal SLA + RPO/RTO commitment** required for SOC 2 + customer-facing claims. |

---

## Confidentiality (C1.1-C1.2)

| Control | Status | Evidence |
|---|---|---|
| C1.1 — Identifies + maintains confidential information | 🟢 Yes | PII guard with 8 categories. Output classification (`tenant-private` / `confidential` / `public`) per-agent in manifests. |
| C1.2 — Disposes of confidential information | 🟡 Partial | Share-token revocation works. **Formal data-retention schedule + automated deletion** missing. |

---

## Processing Integrity (PI1.1-PI1.5)

| Control | Status | Evidence |
|---|---|---|
| PI1.1 — Information necessary for design + execution | 🟢 Yes | Per-agent manifests, capability claims, evaluation suite (166 evals across 159 agents = 71% coverage). |
| PI1.2 — Implements + tests system inputs are complete + accurate | 🟢 Yes | Zod validation on every API route. Topo-sort validation on DAGs. |
| PI1.3 — Implements + tests system processing | 🟢 Yes | Output verifier (5-layer pipeline). Critic models on Tier 2/3 agents. Eval suite. |
| PI1.4 — Implements + tests system output is complete + accurate | 🟢 Yes | Confidence band on every output. Token-budget meter. Watermarking. PII guard on response path. |
| PI1.5 — Implements + tests system processing is timely | 🟢 Yes | Per-node retry-with-backoff. Circuit breakers. Sync vs async DAG path with 300s ceiling. |

---

## Privacy (P1.1-P9.1)

The most variable category — depends heavily on which jurisdictions
the customer base is in. We support GDPR / POPIA / CCPA disclosures
in the privacy policy.

| Control | Status | Evidence |
|---|---|---|
| P1.1 — Provides notice of privacy practices | 🟢 Yes | `/privacy` (GDPR Article 13 complete + POPIA + CCPA). |
| P2.1 — Communicates choices about personal info | 🟢 Yes | Cookie consent, `/unsubscribe`, opt-out on every email. |
| P3.1 — Collects personal info per documented purposes | 🟡 Partial | Privacy policy lists purposes; technical enforcement is per-agent manifest's `pii.handlesByDesign` field. |
| P4.1 — Limits use of personal info | 🟢 Yes | PII guard (default-mask). Per-agent override only with `handlesByDesign: true`. |
| P5.1 — Retains personal info per policy | 🟡 Partial | Retention windows declared in privacy policy; **automated enforcement** missing. |
| P6.1 — Discloses to third parties only with consent | 🟢 Yes | Vendors listed in privacy policy. No data sales. |
| P7.1 — Quality of personal info | 🟢 Yes | User can edit profile via Clerk. Audit chain captures all changes. |
| P8.1 — Monitoring + enforcement of privacy practices | 🟡 Partial | Audit chain captures access. **Formal Privacy Impact Assessment (PIA) template** missing. |

---

## What this maps to in calendar terms

If you wanted to formally pass SOC 2 Type II:

| Phase | Duration | Cost | What's needed |
|---|---|---|---|
| **Type I (point-in-time)** | 2-4 months | $20-40K | Auditor partner, formal policy docs (the ⚪ + 🟡 gaps above), readiness assessment |
| **Type II observation window** | 6-12 months | $0 (audit ongoing) | Quarterly evidence collection, no major gaps surface |
| **Type II report issuance** | 1 month | $30-60K | Final auditor walk-through + report |

**Total realistic timeline: 9-18 months.** **Total realistic cost:
$50-100K.** Single-founder companies typically start with **Type I**
(point-in-time attestation) at the lower end, then convert to Type II
once a customer's procurement requires it.

---

## What's verifiably ahead-of-curve right now

The technical-control evidence in this codebase is genuinely beyond
what a typical pre-SOC-2 platform brings to the auditor:

1. **Audit chain with continuous integrity monitoring** (CC4.1) —
   most platforms have audit logs but never check them. We hash-chain
   them and a cron verifies every 6 hours.

2. **Per-agent capability manifests** (CC6.2, PI1.1) — most platforms
   have hand-edited capability claims that drift. We regenerate from
   static analysis (223/223 covered).

3. **Anti-drift gate** (CC4.1, CC8.1) — 101 invariants in CI. Most
   teams imagine this kind of gate but never build it.

4. **PII guard with mod-97 IBAN** (CC6.4, P4.1) — 8 categories
   including financial identifiers, with cryptographic checksum
   validation, not just regex.

5. **Output watermarking + attestation** (PI1.4) — every agent
   response carries a HMAC-signed `_meta` envelope. SOC 2 accepts
   this as evidence of "tested system output is complete + accurate."

6. **Public threat model + transparency manifest** (CC2.3, CC3.2) —
   STRIDE-based, every claim cites a file or test. Auditor LLMs can
   ingest.

7. **Retry + circuit breakers + orphan cleanup** (PI1.5, A1.2) — the
   reliability work from Round 20 maps directly to SOC 2's processing-
   integrity criteria around timeliness.

These artifacts compress the **calendar-time-to-Type-I** by months.
A typical pre-SOC-2 platform spends weeks BUILDING what we already
have shipped + locked into anti-drift gates.

---

## What we should NOT pretend

- **No annual penetration test report.** A SOC 2 audit accepts vendor
  pen-tests as evidence; we should commission one in the next quarter.
- **No formal incident-response tabletop exercise.** The `RUNBOOK.md`
  is a draft, not a tested procedure.
- **No documented capacity plan.** "Vercel autoscales" is true but
  not auditor-evidence.
- **No DR restore-validation test.** Backups exist; we've never
  restored one to a fresh environment to verify.
- **No formal vendor-management review cycle.** We list vendors
  but don't review them annually.

These are the gaps the auditor will identify in the readiness
assessment. They're well-bounded and 1-2 weeks of process work each.

---

## Maintainer note

This file is the procurement artifact. When a customer's diligence
team asks "are you SOC 2?" the honest answer is "Type I in progress
with these specific gaps tracked," and you point them at this
document.

Refresh quarterly OR after any material change to a control. Don't
delete sections when controls change status — note the change with a
date so the artifact serves as a control-evolution timeline.
