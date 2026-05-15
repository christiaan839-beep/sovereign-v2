# [Your Name]

**Founding AI / Cryptography Engineer · Solo founder, Sovereign Matrix**

[your-city, South Africa] · [your.email@domain.com] · [your linkedin] · [your github]

> The cryptographic verification layer underneath every AI agent decision.
> [https://sovereignmatrix.agency](https://sovereignmatrix.agency) · 145 agents · 2,565 tests · 7 cryptographic primitives.

---

## Profile

Solo technical founder of **Sovereign Matrix** — a multi-tenant agentic-AI platform with 145 production agents across 8 LLM providers, 367 API routes, 215,000 lines of strict TypeScript, and 7 unique cryptographic primitives committed to every agent decision. Built the end-to-end stack: deterministic routing + LLM cascade, 5-layer output verifier (LlamaGuard + PII + content policy + quality + trust gate), drift + hallucination + bias detection, multi-tenant data residency, envelope encryption, anomaly detection, and incident-correlation infrastructure. Deep experience in hybrid AI architectures (deterministic frameworks + LLM cognition), cost-efficient model routing, prompt engineering at scale, and the security primitives that make agentic AI defensible inside regulated workflows.

---

## Selected Project — Sovereign Matrix (sovereignmatrix.agency)

Engineering lead, architect, and sole engineer. Built from zero to a 215K-LOC production platform in ~6 months.

**Agentic AI infrastructure**

- **145 production agents** across 8 LLM providers (Anthropic Claude, Google Gemini, NVIDIA NIM, Cerebras, Groq, Together AI, OpenAI, local Ollama). Unified routing via `src/lib/ai.ts` — single entry point for every LLM call.
- **Cascade routing** prioritising cost-efficient open-source models first: local Ollama ($0) → Cerebras (fast) → NIM (free tier) → Claude / Gemini fallback. Token optimisation + cost governance via `src/lib/budget-controls.ts` and `src/lib/cost-anomaly.ts`.
- **Multi-agent orchestration** via `src/lib/agent-factory.ts`, `src/lib/agent-teams.ts`, `src/lib/swarm-protocol.ts`, `src/lib/playbooks.ts`. Deterministic tool-dispatch + skill-routing layers separate from LLM cognition.
- **Hybrid deterministic + LLM architecture** — every agent run passes through a 5-layer verifier (LlamaGuard content classifier + PII detector + content-policy regex + quality scorer + trust gate) before output is committed. Hallucination detector ties every claim to source data.
- **Cognitive layer for complex reasoning** — consensus engine (`src/lib/consensus.ts`) runs generate→critique→revise with two distinct models; verifies output against the original input + source citations.

**Anomaly detection, incident correlation, risk scoring**

- `src/lib/drift-detector.ts` — compares every agent run against baseline; flags model drift beyond MRMG tolerance.
- `src/lib/shadow-run.ts` — re-executes sampled production runs against the previous deployment; catches output regressions before customers see them.
- `src/lib/cost-anomaly.ts` — statistical anomaly detection over cost telemetry per tenant + agent (with relative-spike fallback for flat baselines).
- `src/lib/jailbreak-detect.ts` — adversarial-prompt detection on every input. NEMO Guardrails integration for output-safety policy enforcement.
- `src/lib/bias-auditor.ts` — demographic-skew detection over agent output, for NAIC AI-bias and SR 11-7 compliance.

**Hybrid LLM infrastructure + self-hosted model migration**

- Routing primitive supports air-gapped deployment via local Ollama for any tenant flagged `data-sovereignty=on-prem`. Already wired for FedRAMP-style federal deployments.
- Cost-modelling framework (`src/lib/cost-forecast.ts`) projects USD spend per tenant per agent given current model mix; designed for the third-party-to-self-hosted migration plan.
- Quota + budget controls per tenant per agent per day, enforced at the request boundary before LLM call.

**RAG, vector + graph databases, distributed systems**

- `src/lib/rag.ts` — tokenised retrieval-augmented generation with semantic memory layered on top.
- Pinecone integration for vector retrieval; `graphNodes` + `graphEdges` tables for graph memory.
- 44 PostgreSQL tables (Drizzle ORM, Neon serverless), strict tenant scoping at every query.
- Tenant data-residency primitive routes per-tenant traffic to US / EU / UK regions.

**Cybersecurity primitives shipped (the moat)**

| Module                                    | Purpose                                                                                         |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `anon-credential.ts`                      | BBS+-shape anonymous capability tokens for third-party auditor replay without tenant disclosure |
| `model-fingerprint.ts`                    | Verifiable model identity + behaviour canary — detects silent provider-side model swaps         |
| `receipt-chain.ts` + `receipt-ratchet.ts` | Tamper-evident append-only log for every agent decision                                         |
| `merkle-receipt-batch.ts`                 | O(log n) Merkle inclusion proofs over batched receipts                                          |
| `retention-proof.ts`                      | Cryptographic proof of GDPR-Article-17 deletion                                                 |
| `blockchain-anchor.ts`                    | Anchor batch roots into Bitcoin / Ethereum for ultimate immutability                            |
| `watermark.ts`                            | Content-provenance watermarking on every output                                                 |
| `envelope-encryption.ts`                  | AES-256-GCM with KEK/DEK split per tenant                                                       |
| `timestamp-authority.ts`                  | RFC 3161-style trusted timestamping                                                             |

**Multi-tenant SaaS architecture**

- Hard tenant_id scoping in every Drizzle query; cross-tenant queries blocked at the resolver level.
- RBAC + admin gates via `src/lib/auth-guard.ts`, `src/lib/api-guard.ts`, Clerk-backed auth.
- White-label rewrites: `/client/:id/:path` → tenant-scoped portal.
- Per-tenant rate limiting (Upstash), circuit breakers, retry queues.

**Observability + compliance**

- W3C Trace Context tracing across every agent run; Sentry breadcrumbs at handler boundaries.
- SOC 2 Type 2 control evidence collector (`src/lib/soc2-evidence.ts`) — 24 TSC controls mapped across all 5 categories.
- 21 CFR Part 11, ICH GCP, NERC CIP, SR 11-7, EU CSRD/ESRS, FedRAMP, NAIC regulatory packs published.
- Audit-bundle subscription delivers monthly cryptographic-evidence packages to external auditors.

**Quality bar**

- **2,565 tests** across 180+ test files (Vitest). 100% pass rate.
- **Strict TypeScript** — 0 build errors, only 6 `@ts-expect-error` suppressions across 215K LOC.
- 0 lint errors, 188 pre-existing warnings (cosmetic).
- 173 cooks (atomic feature units) shipped in the last 30 days, ~25 merged pull requests in the last 7 days.

---

## Selected Technical Skills

**Languages:** TypeScript (expert, 215K LOC production), Python (server/python-agents + ML scripts), SQL.
**LLM stack:** Anthropic SDK, Google Gemini SDK, NVIDIA NIM, Cerebras, Groq, Together AI, Ollama (self-hosted), prompt engineering, token optimisation, fine-tuning workflows.
**Orchestration:** Custom multi-agent factory, agent-teams, swarm-protocol; experience with the LangGraph / LangChain conceptual model.
**Cryptography:** HMAC-SHA256, Ed25519, Merkle trees, KZG/IPA commitments (conceptual), envelope encryption (KEK/DEK), constant-time crypto, BBS+ signature shapes.
**Cybersecurity:** Output safety, jailbreak detection, content policy, RBAC, multi-tenant isolation, webhook signature verification, RFC 9116 disclosure, SOC 2 evidence engineering.
**Cloud + infra:** AWS (EC2, S3, Lambda, IAM), Vercel edge functions, Neon serverless Postgres, Pinecone, Upstash Redis, Cloudflare CDN. GPU planning for on-premise model deployment.
**Data:** RAG, vector DBs (Pinecone), graph DBs (Neon graph schema), Drizzle ORM, streaming aggregations, idempotency design.
**Observability:** Sentry, OpenTelemetry / Trace Context, custom telemetry, anomaly + drift detection.
**Frameworks:** Next.js 16, React 19, Drizzle, Clerk, Stripe, Tailwind v4, Framer Motion, Vitest.

---

## Experience

**Founder & AI Engineering Lead — Sovereign Matrix** · [start month/year]–present · Remote (South Africa)
Designed and built the entire stack solo. See "Selected Project" above for primitives + architecture detail. Open codebase reviewable at the company URL.

**[Previous role title] — [Company]** · [start–end] · [location]

- [Achievement 1 — what you built / shipped]
- [Achievement 2 — measurable outcome with numbers]
- [Achievement 3 — leadership / mentorship if applicable]

**[Previous role title] — [Company]** · [start–end] · [location]

- [Achievement 1]
- [Achievement 2]

**[Previous role title] — [Company]** · [start–end] · [location]

- [Achievement 1]
- [Achievement 2]

> **Note for the founder:** Fill in your 2-3 prior roles above with the strongest signal you have. Cybersecurity + AI/ML wins go at the top. If you have 7+ total years across AI/ML, security-engineering, or systems-design, the rest of this resume carries the day.

---

## Education

**[Degree], [Field]** — [University], [year]

[Additional certifications: AWS Solutions Architect, SOC 2 Lead Auditor, etc. — fill in what you hold]

---

## Open-source + writing

- Sovereign Matrix codebase (above): 215K LOC TypeScript, public.
- Receipts spec at [sovereignmatrix.agency/spec](https://sovereignmatrix.agency/spec) — the canonical protocol every Sovereign primitive composes against.
- Live cryptographic demo at [sovereignmatrix.agency/demo/verify-receipt](https://sovereignmatrix.agency/demo/verify-receipt) — visitor reproduces the HMAC/SHA-256 math on their own machine.
- Vertical readiness scoreboard at [sovereignmatrix.agency/readiness](https://sovereignmatrix.agency/readiness) — 100/100 across 5 of 8 verticals, computed programmatically from the open codebase.

---

## Authorisation

- **South Africa work authorisation:** Yes — citizen.
- **Background check:** Will accept.
- **Remote-first:** Yes, currently operating remotely with the Sovereign Matrix platform.
