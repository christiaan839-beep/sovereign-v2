# Sovereign Matrix — FMTI Self-Audit

**Generated:** 2026-04-28T01:38:23.419Z
**Method:** `scripts/run-fmti-self-audit.mjs` deterministic rule-based scoring against /api/_meta/transparency.json + /api/_meta/agents.json + repo artifacts.
**Overall:** 89.7% across 17 applicable subdomains (5 N/A).

## Why publish our own audit

External transparency indices (FMTI, EU AI Act baseline, NIST AI RMF, MITRE
ATLAS) are now run by AI auditor agents at <$3 per platform. The bottleneck
for them is documentation fragmentation; the bottleneck for us is making
our claims grep-able. By running the audit against our own consolidated
machine-readable surface BEFORE the external auditor does, we ship the
score first AND we surface internal disagreements between marketing and
implementation. Self-audits make claim-vs-reality drift visible.

## Methodology

1. The 23 FMTI subdomains are encoded in the script as a list of `{id,
   section, verifier}` rules.
2. Each verifier reads ONE specific artifact (file existence, JSON
   field presence, count, etc.) and emits `{ok, score (0..1), evidence}`.
3. N/A subdomains (training data, labor, compute, methods) score 0 and
   carry an `evidence` line explaining why they're upstream-only.
4. The overall score divides total points by APPLICABLE subdomains —
   not penalizing for upstream-layer claims we can't make.

Re-run any time: `node scripts/run-fmti-self-audit.mjs`

## Score by section

### Upstream — Data — 0% (2 subdomains)

| Subdomain | Score | Bucket | Evidence |
|---|---|---|---|
| Data: training corpus size disclosure | 0% | ⚪ N/A | N/A — Sovereign does not train models. Frontier providers (Anthropic, Google, OpenAI, NVIDIA) document their corpora upstream. |
| Data: provenance + licensing | 0% | ⚪ N/A | N/A — see data_size. Out of scope for the orchestration layer. |

### Upstream — Labor — 0% (1 subdomain)

| Subdomain | Score | Bucket | Evidence |
|---|---|---|---|
| Labor: human feedback / annotation | 0% | ⚪ N/A | N/A — orchestration layer; we do not run RLHF or annotation pipelines. |

### Upstream — Compute — 0% (1 subdomain)

| Subdomain | Score | Bucket | Evidence |
|---|---|---|---|
| Compute: training FLOPs disclosure | 0% | ⚪ N/A | N/A — see data_size. |

### Upstream — Methods — 0% (1 subdomain)

| Subdomain | Score | Bucket | Evidence |
|---|---|---|---|
| Methods: architecture + alignment approach | 0% | ⚪ N/A | N/A — frontier-model layer responsibility. |

### Model — Basics — 100% (2 subdomains)

| Subdomain | Score | Bucket | Evidence |
|---|---|---|---|
| Model: input/output modalities per agent | 100% | 🟢 high | Per-agent input/output declared via createAgentRoute.requiredFields + Zod schemas; surfaced in agents.json `signals[]` field. |
| Model: per-agent declared providers + models | 100% | 🟢 high | Every agent's manifest declares models[] and tools[] with provider classification. Coverage: 100% of registered agents (artifacts.agents.count). |

### Model — Access — 100% (2 subdomains)

| Subdomain | Score | Bucket | Evidence |
|---|---|---|---|
| Model access: public API + auth model | 100% | 🟢 high | Self-service API key minting + per-key scope/IP allowlist (api-key-scopes.ts). v1 gateway documented + auth-walled (E2E tested). |
| Model access: pricing transparency | 100% | 🟢 high | Plan tiers on /pricing, per-call rate card at /pricing/per-call, machine-readable feed at /api/_meta/pricing.json, DAG cost preview in visual editor, per-run actual cost on the run detail page (derived from stored _meta.tokenBudget telemetry). |

### Model — Capabilities — 40% (2 subdomains)

| Subdomain | Score | Bucket | Evidence |
|---|---|---|---|
| Capabilities: published evaluations | 60% | 🟡 moderate | 89 golden-set evals across 223 agents (40% coverage). Floor locked at 25% via weekly-health.mjs. Coverage gap to 60%+ tracked as C2. |
| Capabilities: external audits / certifications | 20% | 🔴 low | No SOC 2 Type II / HIPAA BAA yet. Internal audit chain + threat model published. Tracked as WHATS-NOT-ELITE.md §2.4. |

### Model — Risks — 90% (2 subdomains)

| Subdomain | Score | Bucket | Evidence |
|---|---|---|---|
| Risks: identified risks + threat model | 100% | 🟢 high | STRIDE-based threat model at docs/THREAT_MODEL.md. Every claim cites a file or test. |
| Risks: red-team coverage | 80% | 🟡 moderate | 5-layer safety pipeline (jailbreak / PII / content / quality / critic). Adversarial inputs tested via security-hardening.test.ts (36 tests including 3 audit-chain tampering scenarios). |

### Model — Mitigations — 100% (2 subdomains)

| Subdomain | Score | Bucket | Evidence |
|---|---|---|---|
| Mitigations: PII handling | 100% | 🟢 high | Regex+Luhn+IBAN mod-97 PII guard on every agent response. Modes: mask (default), flag (consent-based), skip (synthetic). 8 PII types: ssn, credit_card, iban, swift_bic, phone, email, us_zip, ipv4. 36 unit tests. |
| Mitigations: audit trail / immutability | 100% | 🟢 high | SHA-256 audit-log hash chain (drizzle/0033). Tamper detection via /api/admin/audit/verify-chain (admin) + /api/cron/verify-audit-chain (every 6h). 8 tests including 3 distinct tampering scenarios. |

### Distribution — 92% (3 subdomains)

| Subdomain | Score | Bucket | Evidence |
|---|---|---|---|
| Distribution: terms of service + acceptable use | 100% | 🟢 high | Terms + AUP both published |
| Usage policy: prohibited use disclosure | 95% | 🟢 high | Standalone Acceptable Use Policy at /acceptable-use with 8 prohibited-use categories, the 5-layer safety pipeline, the enforcement flow, and the appeal path. Plus per-agent action tier system (autonomous/confirm/admin-approval) in /api/_meta/agents.json. |
| Usage: monitoring + abuse detection | 80% | 🟡 moderate | Per-model token budgets (token-budget.ts), Upstash sliding-window rate limits, per-provider circuit breakers, audit chain on every authenticated action. |

### Feedback — 95% (2 subdomains)

| Subdomain | Score | Bucket | Evidence |
|---|---|---|---|
| Feedback: vulnerability disclosure program | 100% | 🟢 high | RFC 9116 security.txt published. Defenders ledger at /trust/defenders. 24h ack / 72h triage / 90d disclosure SLA. |
| Feedback: user appeal / agent rerun mechanism | 90% | 🟢 high | Replay mechanism via /api/_replay/verify (cryptographically-checksummed input + output snapshots) PLUS user-facing appeal queue at /dashboard/appeals + /api/appeals. Documented 5-business-day reviewer SLA. Deep-link from run-detail page. |

### Reflexive — 100% (2 subdomains)

| Subdomain | Score | Bucket | Evidence |
|---|---|---|---|
| Reflexive: machine-readable transparency for auditor LLMs | 100% | 🟢 high | /api/_meta/transparency.json + /api/_meta/agents.json — schema-versioned, every claim cited to source artifact, designed for auditor LLM ingestion. Linked from RFC 9116 security.txt via Transparency: field. |
| Reflexive: vendor publishes its own audit | 100% | 🟢 high | This document — docs/FMTI-SELF-AUDIT.md — is the vendor's own audit. Generated by scripts/run-fmti-self-audit.mjs. |

## Disagreements with our marketing

Subdomains where the script's verdict differs from a claim we'd
make on a marketing page — surfaced here so the next sprint can
either fix the data or fix the claim:

- **Capabilities: published evaluations** (60%): 89 golden-set evals across 223 agents (40% coverage). Floor locked at 25% via weekly-health.mjs. Coverage gap to 60%+ tracked as C2.
- **Capabilities: external audits / certifications** (20%): No SOC 2 Type II / HIPAA BAA yet. Internal audit chain + threat model published. Tracked as WHATS-NOT-ELITE.md §2.4.

## Reproducibility

This audit is deterministic — run the same script against the
same commit and you get the same scores. The LLM-driven variant
(Claude 3.5 Sonnet peer-reviews the deterministic scoring) is
the `--with-llm` flag, which requires `ANTHROPIC_API_KEY`. The
peer review is appended above when run.

---

_Generated by `scripts/run-fmti-self-audit.mjs` —
re-run on every deploy to catch drift between marketing claims
and shipped artifacts._
