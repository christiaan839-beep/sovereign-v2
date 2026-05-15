# Christiaan de Wet

**Founding Engineer · AI Systems & Cryptographic Verification**

Cape Town, South Africa · Remote-first
**christiaan@sovereignmatrix.agency** · **+27 79 162 3348**
[sovereignmatrix.agency](https://sovereignmatrix.agency) · [github.com/christiaan839-beep](https://github.com/christiaan839-beep) · [LinkedIn — Christiaan de Wet](https://linkedin.com/in/christiaan-de-wet)

---

## Summary

I built **Sovereign Matrix** — a production agentic-AI platform with **145 agents** across **8 LLM providers**, **7 unique cryptographic primitives**, **215,000 lines** of strict-typed TypeScript, and **2,565 passing tests** — solo, end-to-end, in roughly six months. The platform is live at [sovereignmatrix.agency](https://sovereignmatrix.agency).

Strongest at the intersection of **AI systems engineering** (multi-agent orchestration, hybrid deterministic + LLM routing, cost-efficient model dispatch) and **cryptographic verification** (signed receipts, Merkle inclusion proofs, anonymous credentials, retention proofs, blockchain anchoring). The work is reviewable; the codebase is the resume.

**Most relevant for:** Founding AI Engineer · Senior AI Engineer · AI / ML Lead · Head of AI at seed–Series A · Technical Co-founder · Engineering Lead at agentic-AI, cybersecurity, or cryptographic-verification startups.

---

## Core capabilities

| Domain                           | What I have shipped                                                                                                                                                                                                                                                          |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Multi-agent orchestration**    | Custom agent factory + teams + swarm protocol over 145 production agents. Functionally analogous to LangGraph — conditional flows, shared state machines, dynamic tool dispatch — built from first principles in TypeScript for serverless edge.                             |
| **Hybrid AI architecture**       | 5-layer deterministic output verifier (LlamaGuard + PII + content-policy + quality + trust gate) wrapped around LLM cognition. Hallucination detector ties every claim to source data.                                                                                       |
| **Cost-efficient model routing** | Cascade router (local Ollama → Cerebras → NIM → paid Claude/Gemini) with budget-, plan-, and trust-gated decisioning. Self-hosted-first by default — paid LLMs only when the open model cannot meet the quality bar.                                                         |
| **Cryptographic primitives**     | HMAC-SHA256 + Ed25519 receipts · Merkle batching with O(log n) inclusion proofs · receipt-chain ratchet · anonymous-credential auditor tokens · verifiable model fingerprinting · retention proofs · blockchain anchoring · AES-256-GCM envelope encryption (KEK/DEK split). |
| **Multi-tenant SaaS**            | 44 PostgreSQL tables (Drizzle, Neon) with hard tenant-id scoping at every query. Per-tenant data residency (US/EU/UK). RBAC via Clerk. White-label rewrites.                                                                                                                 |
| **Anomaly + risk**               | Drift detector, shadow-run regression detector, statistical cost-anomaly baselining, jailbreak detector, bias auditor, NEMO Guardrails integration.                                                                                                                          |
| **Compliance engineering**       | SOC 2 Type 2 evidence collector mapping 24 TSC controls. RFC 9116 disclosure. GDPR Article 28 Processor declaration. Regulatory packs for CSRD, SR 11-7, NERC CIP, 21 CFR Part 11, FedRAMP, NAIC AI Bias, ICH GCP, ICH E2B.                                                  |

---

## Sovereign Matrix — Founder & Sole Engineer

[Start month/year]–present · Remote, Cape Town · [sovereignmatrix.agency](https://sovereignmatrix.agency)

Designed, built, and operated a production agentic-AI platform end-to-end. Recent velocity: ~25 production PRs merged per week, all green, all reviewable.

### Engineering footprint (verifiable)

- **215,000 lines** of strict-typed TypeScript across 1,238 files; **2,565 automated tests** at 100% pass rate.
- **145 agent endpoints** across 8 LLM providers (Anthropic Claude, Google Gemini, NVIDIA NIM, Cerebras, Groq, Together AI, OpenAI, local Ollama).
- **367 API routes**, **44 PostgreSQL tables**, **222 library modules**.
- Live stack: Vercel edge functions · Neon serverless Postgres · Upstash Redis · Pinecone vector DB · Clerk · Stripe · Sentry · OpenTelemetry tracing.

### Architecture decisions that mattered

- **Unified LLM router** (`src/lib/ai.ts`) — the single entry point for every model call across the platform. Enables cascade routing, cost governance, plan-tier gating, and observability at one boundary.
- **Per-tenant data residency** — primitive that routes the full request graph to a tenant's chosen region without application-code changes.
- **Cryptographic receipt fabric** — every agent decision produces a tamper-evident artifact an external auditor verifies in their own browser, without trusting our database.
- **Envelope encryption** — AES-256-GCM with KEK/DEK split for BYOK customer keys at rest.

### Cryptographic moat shipped

- `anon-credential.ts` — BBS+-shape capability tokens for third-party auditor replay without tenant disclosure.
- `model-fingerprint.ts` — detects silent provider-side model swaps via behaviour-canary commitments.
- `receipt-chain.ts` + `receipt-ratchet.ts` — tamper-evident append-only log.
- `merkle-receipt-batch.ts` — O(log n) inclusion proofs over batched receipts.
- `retention-proof.ts` — cryptographic proof of GDPR Article 17 deletion.
- `blockchain-anchor.ts` — Bitcoin + Ethereum anchoring of batch roots.
- `envelope-encryption.ts`, `watermark.ts`, `timestamp-authority.ts`.

### Cybersecurity + safety

- 15 dedicated security modules: `auth-guard`, `api-guard`, `input-sanitizer`, `jailbreak-detect`, `nemo-guardrails`, `content-safety`, `output-guard`, `rate-limit`, others.
- Webhook signature verification on 10 webhooks (Stripe, Clerk, HubSpot, Cal.com, Twilio, Telegram, Yoco, Paystack, PayFast, Coinbase Commerce).
- Coordinated-disclosure policy at `/.well-known/security.txt` (RFC 9116).

### Open + verifiable

- Live demo at [sovereignmatrix.agency/demo/verify-receipt](https://sovereignmatrix.agency/demo/verify-receipt) — visitor reproduces the HMAC / SHA-256 math on their own machine.
- Vertical-readiness scoreboard at [sovereignmatrix.agency/readiness](https://sovereignmatrix.agency/readiness) — programmatic 0-100 score per vertical, computed from the open codebase.
- 25 vertical landing pages mapped to specific regulators (CSRD, SR 11-7, 21 CFR Part 11, NERC CIP, NAIC AI Bias, FedRAMP, ICH E2B, ICH GCP).

---

## Earlier experience

**[Previous role title] — [Company]** · [start–end] · [Cape Town / remote]

- [Strongest signal — what you built / shipped / measurable outcome]
- [Second achievement — leadership, cross-functional, or technical depth]

**[Previous role title] — [Company]** · [start–end] · [location]

- [Achievement 1]
- [Achievement 2]

> Fill these two blocks with your strongest prior roles. Lead with measurable wins; transferable skills (systems design, ownership, shipping cadence) carry as much weight as job-title fit.

---

## Technical skills

**Daily / production-deployed (last 12 months)**
TypeScript · Next.js 16 · React 19 · Drizzle ORM · PostgreSQL · Vercel edge · Stripe · Clerk · Anthropic SDK · prompt engineering · multi-agent orchestration · HMAC / Ed25519 / Merkle primitives · webhook security · Vitest

**Comfortable / production-tested**
Python · AWS (S3, Lambda, IAM, EC2, CloudFront) · Pinecone · Ollama / local LLM serving · RAG pipelines · graph data models · OpenTelemetry / Trace Context · Sentry · Upstash Redis · Tailwind · Framer Motion

**Familiar / will ramp in role**
LangGraph (conceptual model only — built equivalent custom layer in production) · supervised fine-tuning at scale · GPU-cluster planning · Lean / Coq for formal verification

---

## Education

**[Highest degree, field]** — [University, year]
[Relevant certifications]

---

## What I am looking for

A founding-engineer or senior-AI seat at a seed or Series A company where:

- The codebase is the proof, not the resume.
- AI agents need real verification primitives (compliance, audit, regulated workflows).
- Solo + small-team velocity is the operating mode.
- The team values **honest gap acknowledgement** over inflated CVs.

Open to full-time, technical co-founder, or fractional / advisory engagements during the bridge period.

---

## Honest gap notes

- **Years on a strict checklist:** Under 7 years of paid AI/ML employment. The Sovereign Matrix codebase represents the depth typically seen at 5–7 years of senior work. Evaluate the output.
- **Python primacy:** TypeScript-dominant in the last 12 months. Comfortable in Python (server/python-agents directory in Sovereign) — 2–4 week ramp to production-Python comfort.
- **Large-team leadership:** Have not led a 6+ person engineering team yet. Will pair-mentor and lead architecture immediately; team-scale leadership is growth ground I would learn alongside a strong CTO.

---

## Authorisation + logistics

- **South Africa citizen** — work authorisation confirmed.
- **Background check** — will accept.
- **Remote-first**, immediately available.
- **Notice period:** 0 days.

— Christiaan de Wet
**christiaan@sovereignmatrix.agency** · **+27 79 162 3348** · Cape Town, South Africa
