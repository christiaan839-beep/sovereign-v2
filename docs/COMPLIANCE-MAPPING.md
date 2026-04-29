# Sovereign Matrix — Compliance Control Mapping

> Procurement-grade mapping from regulatory frameworks to specific
> files in this codebase. When a procurement officer asks
> *"how do you satisfy [control]?"* — we answer with a line number,
> not a marketing claim.
>
> This is the document that converts "we built it" into "we can prove it."
>
> **Last updated:** 2026-04-29 (R45 cumulative)
> **Maintained by:** anti-drift gates in `scripts/weekly-health.mjs`
> **Verifier:** every claim below is testable via
> `npx @sovereign/inspector full https://sovereignmatrix.agency`

---

## How to use this document

1. Procurement / auditor sends a control questionnaire.
2. Find the control row below.
3. Copy the file paths + test names into your response.
4. (Optional) Run the linked inspector command on a live deployment
   to demonstrate the control is *operational*, not just *documented*.

The goal is to make every "yes, we have that" *evidenced* in the source.

---

## SOC 2 Trust Service Criteria mapping

The AICPA SOC 2 framework is the de-facto procurement standard for
B2B SaaS. Type I = "controls designed correctly." Type II = "controls
operated effectively over a 3-12 month observation period."

### CC1 — Control Environment

| Criterion | How we satisfy it | File path / artifact |
|---|---|---|
| CC1.1 — Integrity & ethical values | Public, signed Constitution; documented platform principles | `docs/PROJECT-CONSTITUTION.md` |
| CC1.2 — Board independence | (Future) Sovereign Foundation governance — R47 | TBD R47 |
| CC1.3 — Org structure & responsibility | ADR pattern with decision authorities listed | `docs/adr/*.md` |
| CC1.4 — Hire competent people | (Process) — out of code scope | n/a |
| CC1.5 — Hold individuals accountable | Hash-chained audit log; admin actions cryptographically signed | `src/lib/audit-log.ts` |

### CC2 — Communication & Information

| Criterion | How we satisfy it | File path / artifact |
|---|---|---|
| CC2.1 — Internal info quality | Anti-drift gate runs on every PR; 360 invariants | `scripts/weekly-health.mjs`, `.github/workflows/ci.yml` |
| CC2.2 — Internal communication | ADRs, threat model, succession plan | `docs/adr/`, `docs/THREAT_MODEL.md`, `docs/SUCCESSION.md` |
| CC2.3 — External communication | Public reliability page, public threat model, public verifier | `/reliability`, `/security`, `@sovereign/inspector` |

### CC3 — Risk Assessment

| Criterion | How we satisfy it | File path / artifact |
|---|---|---|
| CC3.1 — Specifies suitable objectives | Constitution Principle 1-7 + ADR rationale | `docs/PROJECT-CONSTITUTION.md` |
| CC3.2 — Identifies + analyzes risk | STRIDE-based threat model | `docs/THREAT_MODEL.md` |
| CC3.3 — Considers fraud risk | API-key scoping, IP allowlist, audit chain | `src/lib/api-key-scopes.ts`, `src/lib/audit-log.ts` |
| CC3.4 — Identifies change risk | Anti-drift CI gate fails the build on regression | `scripts/weekly-health.mjs` (running on every PR) |

### CC4 — Monitoring Activities

| Criterion | How we satisfy it | File path / artifact |
|---|---|---|
| CC4.1 — Selects ongoing eval | Daily self-heal cron writes platform health snapshots | `src/app/api/cron/self-heal/route.ts` |
| CC4.2 — Evaluates + communicates deficiencies | `/api/health/permanence` + `/reliability` page | `src/app/api/_health/permanence/route.ts` |

### CC5 — Control Activities

| Criterion | How we satisfy it | File path / artifact |
|---|---|---|
| CC5.1 — Selects + develops controls | Defense-in-depth: DB CHECK constraints + app validators + crypto signatures | (every migration; `agent-credit-line.ts`; `agent-delegation.ts`) |
| CC5.2 — Selects + develops technology controls | Pure-function evaluators with unit tests | `src/lib/__tests__/` (240 test files, 3247 tests) |
| CC5.3 — Deploys via policies + procedures | Migration pattern (idempotent), ADR pattern, cron pattern | `drizzle/`, `docs/adr/`, `vercel.json` |

### CC6 — Logical & Physical Access

| Criterion | How we satisfy it | File path / artifact |
|---|---|---|
| CC6.1 — Implements logical access | Clerk authentication + Ed25519 user signing keys | `src/lib/agent-delegation.ts`, Clerk middleware |
| CC6.2 — Authentication | Multi-factor available via Clerk; user signing keys are ed25519 | `@clerk/nextjs`, `src/lib/agent-delegation.ts` |
| CC6.3 — Authorization (least-privilege) | API-key scoping (R34 migration 0034); per-agent ACTs (R37) | `src/lib/api-key-scopes.ts`, `src/lib/agent-capability-tokens.ts` |
| CC6.4 — Restricts physical access | (Vercel + Neon — both SOC 2 Type II attested) | Vendor attestations |
| CC6.5 — Protects against logical threats | PII scrubber, rate limit, CSRF, content policy | `src/lib/pii-guard.ts`, `src/lib/auth-guard.ts`, `src/lib/output-verifier.ts` |
| CC6.6 — Restricts removable media | (Out of scope — managed environment) | n/a |
| CC6.7 — Restricts data transmission | TLS-everywhere via Vercel + ingress; canonical-JSON-signed payloads | Vercel TLS, `src/lib/agent-delegation.ts` (canonical signing) |
| CC6.8 — Restricts physical access (data) | (Vendor — Neon Postgres) | Neon attestation |

### CC7 — System Operations

| Criterion | How we satisfy it | File path / artifact |
|---|---|---|
| CC7.1 — Detects security events | Audit chain integrity verified every 6h | `src/app/api/cron/verify-audit-chain/route.ts` |
| CC7.2 — Monitors system performance + availability | Self-heal cron + signed reliability attestations (R44) | `src/app/api/cron/self-heal/route.ts`, `src/lib/reliability-attestation.ts` |
| CC7.3 — Evaluates + responds to anomalies | Anomaly events logged; cost-runaway pause; circuit breaker | `src/lib/cost-runaway.ts`, `src/lib/audit-log.ts` |
| CC7.4 — Implements incident response | `/incidents` public page + admin replay viewer | `src/app/incidents/page.tsx`, `src/app/api/admin/replay/route.ts` |
| CC7.5 — Identifies + responds to breaches | Hash-chained audit log breaks loudly on tampering | `src/lib/audit-log.ts` (verifyAuditChain) |

### CC8 — Change Management

| Criterion | How we satisfy it | File path / artifact |
|---|---|---|
| CC8.1 — Authorizes changes | GitHub PR + reviewer requirements (process) | `.github/workflows/` |
| CC8.2 — Designs + develops changes | ADR pattern, threat-model review, anti-drift gate | `docs/adr/`, `docs/THREAT_MODEL.md` |
| CC8.3 — Tests changes | 3247 unit tests + 240 test files + CI | `src/lib/__tests__/`, `.github/workflows/ci.yml` |
| CC8.4 — Authorizes implementation | (Process) — PR approval required | GitHub branch protection |

### CC9 — Risk Mitigation

| Criterion | How we satisfy it | File path / artifact |
|---|---|---|
| CC9.1 — Identifies + selects risk responses | Cost-runaway cap, multi-stage HITL, R42 credit line | `src/lib/cost-runaway.ts`, `src/lib/multi-stage-hitl.ts`, `src/lib/agent-credit-line.ts` |
| CC9.2 — Implements business continuity | Open-source inspector + customer-managed audit export | `packages/inspector/`, `src/lib/audit-export.ts` |

### Additional principles (Confidentiality, Privacy, Availability)

| Principle | How we satisfy it | File path |
|---|---|---|
| C1.1 — Identifies confidential info | PII scrubber tags every output; per-tenant scoping | `src/lib/pii-guard.ts`, `src/lib/tenant-scope.ts` |
| C1.2 — Disposes of confidential info | (Future) — auto-delete-after-N-days for tenant data | TBD |
| P1.1 — Notice provided to data subjects | `/privacy` policy page | `src/app/privacy/page.tsx` |
| P3.1 — Limits collection of PII | PII guard scrubs SSN, credit card, IBAN, SWIFT, phone, email | `src/lib/pii-guard.ts` |
| P5.1 — Provides transparency | Constitution + threat model + reliability attestation | `docs/PROJECT-CONSTITUTION.md`, `/api/health/reliability/attestation` |
| A1.1 — System availability commitments | Signed reliability attestation, daily | `src/app/api/cron/sign-reliability-attestation/route.ts` |
| A1.2 — Recovers from disruptions | Self-heal cron, cost-runaway auto-unpause at UTC midnight | `src/app/api/cron/self-heal/route.ts` |

---

## EU AI Act mapping (Title III — High-Risk AI Systems)

The EU AI Act entered into force August 2024. Most agent platforms
deployed in the EU will fall under Article 6 (high-risk AI systems)
— this mapping is for that case.

| Article | Requirement | How we satisfy it | File path |
|---|---|---|---|
| **Article 9** | Risk management system | STRIDE threat model + ongoing evaluation via anti-drift | `docs/THREAT_MODEL.md`, `scripts/weekly-health.mjs` |
| **Article 10** | Data governance | PII guard, tenant scoping, customer-managed audit export | `src/lib/pii-guard.ts`, `src/lib/audit-export.ts` |
| **Article 11** | Technical documentation | ADR-0001 → ADR-0009 + this mapping doc | `docs/adr/`, `docs/COMPLIANCE-MAPPING.md` |
| **Article 12** | Record-keeping (logging) | Hash-chained audit log; customer-managed export | `src/lib/audit-log.ts`, `src/lib/audit-export.ts` |
| **Article 13** | Transparency to deployers | Public agent registry + public reputation + public credit lines | `/agents/registry`, `/api/identity/reputation/[agentId]`, `/api/identity/credit/[agentId]` |
| **Article 14** | Human oversight | R33 multi-stage HITL — sequential human approvals | `src/lib/multi-stage-hitl.ts`, `src/lib/hitl-routing-rules.ts` |
| **Article 15** | Accuracy, robustness, cybersecurity | R26 audit chain, R44 signed reliability, output verifier | `src/lib/audit-log.ts`, `src/lib/reliability-attestation.ts`, `src/lib/output-verifier.ts` |
| **Article 16** | Quality management system | Anti-drift gate + 3247 tests + ADR pattern | `scripts/weekly-health.mjs`, `src/lib/__tests__/`, `docs/adr/` |
| **Article 17** | Conformity assessment | (Future) — third-party verification via the inspector | `packages/inspector/` |
| **Article 19** | Automatically generated logs | All agent actions are auto-logged with crypto signatures (R34) | `src/lib/agent-delegation.ts`, `src/lib/audit-log.ts` |
| **Article 60** | Real-world testing | Multi-stage HITL routing + circuit breakers | `src/lib/multi-stage-hitl.ts`, `src/lib/cost-runaway.ts` |

**Key win for EU procurement:** Article 14 mandates that natural
persons can effectively oversee high-risk AI. R33 multi-stage HITL +
R34 user-signed delegations satisfy this *cryptographically*. Most
competitors satisfy it with a "manager review" UI — we satisfy it
with a signed audit trail that proves the human was in the loop.

---

## HIPAA mapping (covered entities + business associate scenarios)

For healthcare agent deployments. Sovereign Matrix is positioned to
function as a Business Associate; the BAA must be executed before
PHI is processed.

| Requirement | How we satisfy it | File path |
|---|---|---|
| **§164.308(a)(1)(ii)(D)** — Information system activity review | Hash-chained audit log; verify-audit-chain cron every 6h | `src/lib/audit-log.ts`, `src/app/api/cron/verify-audit-chain/route.ts` |
| **§164.308(a)(3)** — Workforce security | Clerk MFA + per-user signing keys (R34) | Clerk + `src/lib/agent-delegation.ts` |
| **§164.308(a)(4)** — Information access management | API key scoping + tenant isolation + ACT capability tokens | `src/lib/api-key-scopes.ts`, `src/lib/tenant-scope.ts`, `src/lib/agent-capability-tokens.ts` |
| **§164.308(a)(5)** — Security awareness training | (Process — out of code scope) | n/a |
| **§164.308(a)(6)** — Security incident procedures | `/incidents` page + admin replay + audit-chain integrity | `src/app/incidents/page.tsx`, `src/app/api/admin/replay/route.ts` |
| **§164.308(a)(7)** — Contingency plan | Self-heal cron + customer-managed audit export ensures continuity | `src/app/api/cron/self-heal/route.ts`, `src/lib/audit-export.ts` |
| **§164.308(b)** — Business associate contracts | (Process — execute BAA before processing PHI) | n/a |
| **§164.310(a)** — Facility access controls | (Vendor — Vercel + Neon) | Vendor attestations |
| **§164.312(a)(1)** — Access control | Per-tenant scoping + R34 user signing + ACT capability | `src/lib/tenant-scope.ts`, `src/lib/agent-delegation.ts`, `src/lib/agent-capability-tokens.ts` |
| **§164.312(b)** — Audit controls | Hash-chained audit log; immutable; verifier-grade | `src/lib/audit-log.ts`, `packages/inspector/src/verify.mjs` |
| **§164.312(c)** — Integrity controls | sha256 hash chain breaks loudly on tampering | `src/lib/audit-log.ts` |
| **§164.312(d)** — Person/entity authentication | Clerk + Ed25519 user signing keys | Clerk + `src/lib/agent-delegation.ts` |
| **§164.312(e)** — Transmission security | TLS via Vercel; canonical-JSON-signed payloads | Vercel + `src/lib/agent-delegation.ts` |
| **§164.402** — Breach notification | Hash-chain integrity check surfaces tampering immediately | `src/app/api/cron/verify-audit-chain/route.ts` |

---

## NIST AI RMF (AI Risk Management Framework) mapping

| Function | Subfunction | How we satisfy it | File path |
|---|---|---|---|
| **GOVERN** | GOVERN-1 (organizational) | Constitution + ADRs | `docs/PROJECT-CONSTITUTION.md`, `docs/adr/` |
| **MAP** | MAP-1 (context) | Threat model + agent identity manifests | `docs/THREAT_MODEL.md`, `src/lib/agent-identity.ts` |
| **MAP** | MAP-2 (categorization) | OWASP LLM Top 10 capability manifests per agent | `src/lib/agent-manifest-overrides.ts` |
| **MEASURE** | MEASURE-1 (metrics) | Reputation scores, credit lines, reliability attestations | `src/lib/agent-reputation.ts`, `src/lib/agent-credit-line.ts`, `src/lib/reliability-attestation.ts` |
| **MEASURE** | MEASURE-2 (effectiveness) | Anti-drift gate + reliability attestation chain | `scripts/weekly-health.mjs`, `src/lib/reliability-attestation.ts` |
| **MANAGE** | MANAGE-1 (response) | Multi-stage HITL + cost-runaway pause + ACT revocation | `src/lib/multi-stage-hitl.ts`, `src/lib/cost-runaway.ts`, `src/lib/agent-capability-tokens.ts` |

---

## Verification — anyone can run this

Every claim above is independently verifiable:

```bash
# Install the trustless verifier
npm install -g @sovereign/inspector

# Run the full audit
sovereign-inspect full https://sovereignmatrix.agency

# Verify reliability commitment cryptographically
sovereign-inspect reliability-verify https://sovereignmatrix.agency

# Verify any agent's reputation
sovereign-inspect reputation-verify https://sovereignmatrix.agency <agentId>

# Verify any agent's credit line
sovereign-inspect credit-verify https://sovereignmatrix.agency <agentId>

# Verify a saved audit-log export (years later)
cat my-saved-export.json | sovereign-inspect audit-export-verify
```

If any of these fail, the procurement decision is *don't sign*. That's
how strong the trust contract is.

---

## What this document is NOT

- **Not a legal opinion.** Engage qualified counsel for your specific
  regulatory profile.
- **Not a substitute for an audit.** Type II SOC 2 requires a 3-12
  month observation period by an independent CPA firm.
- **Not a guarantee of compliance.** Compliance is the deployer's
  responsibility; this document maps OUR controls to common
  frameworks so you can answer specific questionnaire items quickly.

What it IS:

- **A starting point** for a compliance officer's questionnaire response.
- **A living document** maintained by the anti-drift CI gate.
- **A procurement accelerator** — turning weeks of "do you support X?"
  into hours of "yes, here's the file path + the verifier command."

---

## Maintenance

Add a row whenever a new control is satisfied. Remove a row only if
the underlying capability is removed (which should also fail an
anti-drift gate). The CI gate verifies that file paths cited here
exist; broken links fail the build.
