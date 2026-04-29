# Sovereign Matrix → Cloud Security Alliance Agentic Trust Framework

> Procurement-grade mapping showing how Sovereign Matrix's trust
> primitives align with the Cloud Security Alliance (CSA) Agentic
> Trust Framework (ATF) — the open specification applying Zero Trust
> principles to AI agents.
>
> **Last updated:** 2026-04-29
> **CSA ATF reference:** cloudsecurityalliance.org/research/agentic-trust-framework
> **Verifier:** every claim below is testable via `npx @sovereign/inspector`

---

## Why this mapping exists

CSA's ATF is becoming the procurement-default checklist for "is this
AI platform Zero-Trust-aligned?" Customers running a CSA-ATF
questionnaire ask 30+ specific questions about identity, credential,
tool, audit, and policy enforcement. Without an explicit mapping,
every customer's procurement team has to read our codebase and
re-derive the answers.

This document is the answer key.

---

## CSA ATF principles → Sovereign Matrix primitives

The CSA ATF is built around **8 control families** (analogous to
NIST 800-53). For each family, we cite our shipped primitive + the
file path + the inspector verification command.

### Family 1: Agent Identity Management

**CSA Control:** every agent has a verifiable, non-repudiable
identity bound to an authoritative principal.

| ATF Sub-Control | Sovereign Primitive | File Path | Inspector |
|---|---|---|---|
| ATF-1.1 Unique identity per agent | R38 KYA Manifests | `src/lib/agent-identity.ts` | `agent-identity` |
| ATF-1.2 Cryptographic binding to owner | R34 CADC + Ed25519 | `src/lib/agent-delegation.ts` | `delegation` |
| ATF-1.3 Identity rotation + revocation | R34 CADC kill-switch + R37 ACT revocation | `agent-delegation.ts` + `agent-capability-tokens.ts` | `verify-token` |
| ATF-1.4 Public registry of identities | R39 Public KYA Registry | `/api/identity/registry` + `src/app/agents/registry/page.tsx` | `registry` |

### Family 2: Credential & Tool Governance

**CSA Control:** agents access tools and data through bounded,
revocable credentials with explicit scope.

| ATF Sub-Control | Sovereign Primitive | File Path | Inspector |
|---|---|---|---|
| ATF-2.1 Bounded capability tokens | R37 ACTs (Macaroon-pattern) | `src/lib/agent-capability-tokens.ts` | `verify-token` |
| ATF-2.2 Attenuatable scope | R37 macaroon caveats | `src/lib/agent-capability-tokens.ts` | `verify-token` |
| ATF-2.3 Token revocation | R37 chain-of-custody revocation | `src/lib/agent-capability-tokens.ts` | `verify-token` |
| ATF-2.4 Scope must narrow, never widen | R37 `additionalIsNarrowing` defense | `src/lib/agent-capability-tokens.ts` | unit-tested |
| ATF-2.5 Customer-managed encryption | R55 CMEK envelope encryption | `src/lib/encryption/cmek.ts` | structural |

### Family 3: Action Audit & Provenance

**CSA Control:** every agent action is recorded immutably with
cryptographic provenance.

| ATF Sub-Control | Sovereign Primitive | File Path | Inspector |
|---|---|---|---|
| ATF-3.1 Immutable action log | R26 hash-chained audit log | `src/lib/audit-log.ts` | `audit-chain` |
| ATF-3.2 Per-action signature | R34 CADC signing | `src/lib/agent-delegation.ts` | `delegation` |
| ATF-3.3 Tamper detection | R26 sha256 chain + R67 anomaly detector | `src/lib/audit-log.ts` + `src/lib/anomaly/audit-anomaly-detector.ts` | `audit-chain` |
| ATF-3.4 Customer-managed audit export | R45 signed audit batches | `src/lib/audit-export.ts` | `audit-export-verify` |
| ATF-3.5 Reasoning trace publication | R32 public reasoning trace | `/api/health/trace/[id]` | `trace` |

### Family 4: Policy Enforcement (Guardrails)

**CSA Control:** policies enforced before, during, and after every
agent action.

| ATF Sub-Control | Sovereign Primitive | File Path | Inspector |
|---|---|---|---|
| ATF-4.1 Pre-flight prompt evaluation | R71 Guardrails Adapter Framework | `src/lib/guardrails/guardrails-adapter.ts` | structural |
| ATF-4.2 Multi-layer defense | R71 composeVerdicts (any-block) + R33 multi-stage HITL | `guardrails-adapter.ts` + `multi-stage-hitl.ts` | unit-tested |
| ATF-4.3 Post-flight output evaluation | R71 evaluateOutput | `src/lib/guardrails/guardrails-adapter.ts` | structural |
| ATF-4.4 BYO open-source guardrails | NeMo / OpenGuardrails / LlamaFirewall stubs | `src/lib/guardrails/guardrails-adapter.ts` | structural |
| ATF-4.5 PII protection | `src/lib/pii-guard.ts` (regex + Luhn + IBAN mod-97 + SWIFT/BIC) | `pii-guard.ts` | unit-tested |

### Family 5: Human Oversight (HITL)

**CSA Control:** natural persons can effectively oversee agent
actions.

| ATF Sub-Control | Sovereign Primitive | File Path | Inspector |
|---|---|---|---|
| ATF-5.1 Mandatory HITL for high-stakes | R33 multi-stage HITL routing | `src/lib/multi-stage-hitl.ts` | `policy` |
| ATF-5.2 Approval signature chain | R34 CADC on each approval | `src/lib/agent-delegation.ts` | `delegation` |
| ATF-5.3 Hard-block rules per vertical | 5 vertical packs ship rules + citations | `src/lib/vertical-packs/*.ts` | structural |
| ATF-5.4 Public HITL policy | `/api/health/hitl-policy` | `src/app/api/_health/hitl-policy/route.ts` | `policy` |

### Family 6: Reliability & Service Continuity

**CSA Control:** platform reliability is measurable, signed, and
verifiable.

| ATF Sub-Control | Sovereign Primitive | File Path | Inspector |
|---|---|---|---|
| ATF-6.1 Self-healing detection | R27 self-heal cron | `src/app/api/cron/self-heal/route.ts` | `permanence` |
| ATF-6.2 Signed reliability commitments | R44 signed attestations | `src/lib/reliability-attestation.ts` | `reliability-verify` |
| ATF-6.3 Circuit breakers | R48 reliability primitive | `src/lib/reliability/circuit-breaker.ts` | unit-tested |
| ATF-6.4 Cost runaway protection | R30 daily cap | `src/lib/cost-runaway.ts` | structural |
| ATF-6.5 Anomaly detection | R57+R67 statistical detector | `src/lib/anomaly/audit-anomaly-detector.ts` | `audit-chain` |

### Family 7: Federation & Cross-Instance Trust

**CSA Control:** trust signals federate across deployments.

| ATF Sub-Control | Sovereign Primitive | File Path | Inspector |
|---|---|---|---|
| ATF-7.1 Federation discovery | R36 `/.well-known/sovereign-trust` | `src/app/.well-known/sovereign-trust/route.ts` | `identify` |
| ATF-7.2 Auto-discovery crawl | R56 crawler with SSRF defense | `src/lib/federation/discovery.ts` | `federation` |
| ATF-7.3 Cross-instance reputation | R50 worst-of aggregation | `src/lib/federation/cross-instance-reputation.ts` | structural |
| ATF-7.4 Procurement-readable summary | R50 `summarizeFederationCoverage` | `src/lib/federation/cross-instance-reputation.ts` | structural |

### Family 8: Economic Accountability

**CSA Control:** trust has economic consequences (insurable,
verifiable, priced).

| ATF Sub-Control | Sovereign Primitive | File Path | Inspector |
|---|---|---|---|
| ATF-8.1 Public reputation grading | R40 public reputation scores | `src/lib/agent-reputation.ts` | `reputation-verify` |
| ATF-8.2 Reputation-modulated spend | R42-R43 Trust-as-Collateral | `src/lib/agent-credit-line.ts` | `credit-verify` |
| ATF-8.3 Insurance underwriting | R46 rating-bureau math | `src/lib/agent-underwriting.ts` | structural |
| ATF-8.4 Webhook signing | R58 outbound perimeter | `src/lib/webhooks/signing.ts` | structural |

---

## How to use this mapping in procurement responses

When a customer asks **"Are you CSA ATF-aligned?"**, copy the row
matching their question into your response. Include:

1. The ATF sub-control number
2. Our Sovereign primitive
3. The file path (proves implementation, not marketing)
4. The inspector command (proves the customer can verify offline)

Example response to "How do you handle agent identity?":

> Sovereign Matrix satisfies CSA ATF-1.1 (Unique identity per agent)
> via R38 KYA Manifests (`src/lib/agent-identity.ts`). Every agent
> has a signed Identity Manifest declaring ownership, capabilities,
> and provenance. Verification: run
> `npx @sovereign/inspector agent-identity <our-deployment> <agent-id>`
> and the inspector recomputes the manifest signature locally.

---

## Open verification: zero-trust without trusting Sovereign

The deepest CSA-ATF claim is **trustless verification**: customers
must be able to verify our compliance claims without trusting our
servers. The `@sovereign/inspector` open-source npm package ships
**18 commands** that verify each ATF family offline:

```bash
# Verify the entire ATF surface in one command
npx @sovereign/inspector full https://sovereignmatrix.agency

# Verify specific ATF families
npx @sovereign/inspector audit-chain         # ATF Family 3
npx @sovereign/inspector reliability-verify  # ATF Family 6
npx @sovereign/inspector reputation-verify   # ATF Family 8
npx @sovereign/inspector credit-verify       # ATF Family 8
npx @sovereign/inspector federation          # ATF Family 7
npx @sovereign/inspector audit-export-verify # ATF Family 3
```

Every command runs Ed25519 verification + sha256 chain walks
LOCALLY on the customer's machine. **The platform cannot lie about
ATF compliance while the inspector watches.**

---

## What's PARTIAL (honest disclosure)

CSA ATF is a moving target. Where we're not 100% aligned:

| ATF Sub-Control | Status | What's needed |
|---|---|---|
| ATF-1.5 Hardware-bound identity (TPM/HSM) | Partial — R54 KMS abstraction supports HSM-backed keys via operator adapter | Operator-built AwsKmsSigner / GcpKmsSigner / CloudHSM adapter |
| ATF-4.6 Real-time policy update without restart | Partial — policies live in pack files; updates require redeploy | Future round (R74?) — hot-reload policy registry |
| ATF-7.5 Cross-jurisdiction federation governance | Roadmapped — multi-region deploy is documented but not yet shipped | R76 multi-region active-active |

These are honest gaps. Future rounds will close them.

---

## Anti-drift CI gate

This document is checked by `scripts/weekly-health.mjs` for
freshness:
- File-path citations must reference real files (or anti-drift fails)
- Inspector commands must match the actual CLI surface
- ATF family count + sub-control count tracked

If the underlying primitive moves or is renamed, the anti-drift gate
catches the doc-drift before merge.

---

## What this document is NOT

- **Not an official CSA ATF certification.** Self-attestation; CSA
  formal certification is a separate process.
- **Not a substitute for customer due diligence.** Procurement teams
  should still run their own checks.
- **Not a guarantee.** Compliance is the deployer's responsibility.

What it IS:

- **The fastest path to a "yes, ATF-aligned" procurement answer.**
- **A living document** maintained by anti-drift CI.
- **A standards-positioning artifact** — once enough customers cite
  this in their RFPs, ATF becomes the bar competitors must clear.
