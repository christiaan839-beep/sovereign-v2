# Christiaan de Wet

**Founding Engineer · Sovereign Matrix · AI + Cryptographic Verification**

South Africa · [your.email@domain.com] · [+27 phone] · [LinkedIn] · [GitHub]

> [https://sovereignmatrix.agency](https://sovereignmatrix.agency)
> 145 production agents · 8 LLM providers · 2,565 tests · 7 cryptographic primitives · 215,000 LOC

---

## Profile

I built **Sovereign Matrix** — an agentic-AI platform with 145 production agents, hybrid deterministic + LLM routing, 7 cryptographic primitives, and a 5-layer output verifier — solo, end-to-end, in roughly six months. The platform is live at sovereignmatrix.agency with 215,000 lines of strict-typed TypeScript and 2,565 passing tests.

I am applying for the Head-of-AI role with a candid statement up front: **I do not meet every formal requirement on the listing.** What I bring instead is a working production platform that demonstrates every capability the role asks for, built faster and deeper than most teams of five can ship. The codebase is the resume. The rest of this document explains both sides honestly.

---

## What I have built that maps directly to the role

### Agentic AI pipeline (graph-style orchestration)

- **145 production agents** across 8 LLM providers — Anthropic Claude, Google Gemini, NVIDIA NIM, Cerebras, Groq, Together AI, OpenAI, local Ollama.
- **Unified routing layer** (`src/lib/ai.ts`) — single entry point for every LLM call across the platform. Cascade: local Ollama ($0) → Cerebras (fast) → NIM (free tier) → Claude/Gemini fallback.
- **Multi-agent orchestration:** `agent-factory.ts`, `agent-teams.ts`, `swarm-protocol.ts`, `playbooks.ts`. Functionally analogous to LangGraph — conditional execution flows, shared state machines, dynamic tool-dispatch — but written from first principles in TypeScript so it ships on serverless edge.

### Hybrid deterministic + LLM architecture

- **5-layer output verifier** runs in parallel on every agent output: LlamaGuard content classifier + PII detector + content-policy regex + quality scorer + trust gate.
- **Hallucination detector** ties every claim back to source data.
- **Consensus engine** (`src/lib/consensus.ts`) — generate → critique → revise with two distinct models, verified against the original input.

### Anomaly detection, incident correlation, risk scoring

| Module                | Purpose                                                                                              |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| `drift-detector.ts`   | Output-vs-baseline divergence detection per agent                                                    |
| `shadow-run.ts`       | Re-executes sampled prod runs against previous deploy, catches regressions before customers see them |
| `cost-anomaly.ts`     | Statistical anomaly detection over cost telemetry per tenant + agent                                 |
| `jailbreak-detect.ts` | Adversarial-prompt detection on every input                                                          |
| `bias-auditor.ts`     | Demographic-skew detection for NAIC AI-bias + SR 11-7 compliance                                     |
| `output-guard.ts`     | Trust-gate enforcement before output release                                                         |

### Self-hosted LLM migration plan (already shipped)

- Cascade routing is **self-hosted-first**: local Ollama gets first refusal on every request. Paid LLMs only when Ollama can't meet the quality bar.
- Per-tenant `data-sovereignty=on-prem` flag routes the full request graph to the air-gapped path.
- `cost-forecast.ts` models USD spend per tenant per agent given current model mix — the framework I would use for the third-party-to-self-hosted migration the job description names.

### Cybersecurity primitives — the moat

| Primitive                                 | What it does                                                                       |
| ----------------------------------------- | ---------------------------------------------------------------------------------- |
| `anon-credential.ts`                      | BBS+-shape capability tokens for external auditor replay without tenant disclosure |
| `model-fingerprint.ts`                    | Detects silent provider-side model swaps                                           |
| `receipt-chain.ts` + `receipt-ratchet.ts` | Tamper-evident append-only log for every decision                                  |
| `merkle-receipt-batch.ts`                 | O(log n) Merkle inclusion proofs over batched receipts                             |
| `retention-proof.ts`                      | Cryptographic proof of GDPR Article 17 deletion                                    |
| `blockchain-anchor.ts`                    | Anchors batch roots into Bitcoin / Ethereum for immutable witness                  |
| `envelope-encryption.ts`                  | AES-256-GCM with KEK/DEK split per tenant                                          |

### Multi-tenant SaaS + cloud infrastructure

- Hard tenant-id scoping in every Drizzle ORM query; cross-tenant queries blocked at resolver level.
- 44 PostgreSQL tables on Neon serverless, with per-tenant data residency (US / EU / UK).
- Vercel edge functions, Upstash Redis, Pinecone vector DB, Cloudflare CDN.
- RBAC + admin gates via Clerk; webhook signature verification on 10 webhooks (Stripe, Clerk, HubSpot, Cal.com, Twilio, Telegram, Yoco, Paystack, PayFast, Coinbase Commerce).

---

## Honest gap analysis — what I do not meet on paper

I have read the listing carefully. Here is where I fall short of the formal requirements:

| Requirement                                                | My current state                                                                                                                                                                                    | How I would close the gap                                                                                                                                                                                                                                                                       |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **7+ years AI/ML engineering**                             | Roughly [your-actual-years] years of hands-on AI/ML — less than 7 on paper.                                                                                                                         | My Sovereign Matrix build represents the depth of AI-system engineering most senior engineers ship in 5+ years. The codebase is open; the work speaks. I would rather be evaluated on what I have shipped than years served.                                                                    |
| **Strong Python expertise**                                | TypeScript-dominant (215K LOC). Python presence in `server/python-agents/` (deep-research, telegram-closer, nemoclaw-OS). Comfortable in Python; not my primary daily driver in the last 12 months. | Production Python ramp would take 2-4 weeks. The architectural decisions translate directly.                                                                                                                                                                                                    |
| **Experience with LangGraph specifically**                 | Used the equivalent custom layer in Sovereign Matrix; have not shipped LangGraph in production.                                                                                                     | LangGraph reads as a structured port of patterns I have already implemented from first principles. Productive in week one.                                                                                                                                                                      |
| **Demonstrated leadership / mentoring of technical teams** | Solo founder. No direct reports yet.                                                                                                                                                                | I have engaged a cryptographer reviewer + a security-reviewer agent in the dev loop, and my work is documented at PR-level transparency. Honest answer: I can lead architecture and pair-mentor immediately; running a 6+ person team is new ground I would learn on the job with a strong CTO. |
| **3+ years AWS**                                           | [your-actual-years] years with EC2 / S3 / Lambda / IAM.                                                                                                                                             | Sufficient for the role as described; Sovereign runs on Vercel + Neon + Pinecone but the principles port cleanly.                                                                                                                                                                               |
| **Hands-on fine-tuning of open-source LLMs**               | Limited — I have evaluated + deployed Ollama models, but not done large-scale supervised fine-tuning yet.                                                                                           | The strategic-migration objective in the listing implies a learning curve there for any candidate. I would close this in the first quarter.                                                                                                                                                     |

**The honest verdict:** on a strict checklist, I am a B+ candidate. On the actual question — "can this person own the architecture, ship the multi-agent pipeline, and lead the self-hosted-LLM migration?" — I have already done it once at substantial scale. The codebase is the evidence.

---

## Selected experience

**Founder + Sole Engineer — Sovereign Matrix** · [start date]–present · Remote, South Africa
Built the entire stack solo: 145 agents, 7 cryptographic primitives, 367 API routes, 44 DB tables, multi-tenant architecture, 21 vertical regulatory packs (NERC CIP, SR 11-7, 21 CFR Part 11, EU CSRD/ESRS, FedRAMP, NAIC AI-bias, ICH GCP). ~25 PRs merged in the last 7 days, all green, all production-quality. Open codebase at sovereignmatrix.agency.

**[Previous role title] — [Company]** · [start–end] · [location]

- [Strongest signal achievement]
- [Measurable outcome]
- [Leadership / cross-functional collaboration if applicable]

**[Previous role title] — [Company]** · [start–end] · [location]

- [Achievement 1]
- [Achievement 2]

> Founder note: fill in your 2-3 strongest prior roles above. Lead with cybersecurity / engineering / AI/ML wins. If you have side projects that pre-date Sovereign Matrix, mention them here.

---

## Technical skills (honest)

**Daily / expert:** TypeScript, Next.js 16, React 19, Drizzle ORM, PostgreSQL, Vercel edge, Stripe, Clerk, Tailwind, Vitest, Anthropic SDK, prompt engineering, multi-agent orchestration, cryptographic primitive design (HMAC, Ed25519, Merkle, BBS+ shapes), webhook security.

**Comfortable / production-deployed:** Python, AWS (EC2 / S3 / Lambda / IAM), Pinecone, Ollama / local LLM serving, RAG pipelines, vector + graph data models, OpenTelemetry / Trace Context, Sentry, Upstash Redis.

**Familiar / would ramp in the role:** LangGraph (conceptual model only), supervised fine-tuning at scale, GPU-cluster planning (on-premise), formal Lean / Coq for receipt-spec verification.

---

## Education

[Highest degree, field — University, year]

[Relevant certifications or open-source credentials]

---

## Open-source + writing

- Sovereign Matrix codebase — 215K LOC TypeScript, public PR history.
- Receipts spec at [sovereignmatrix.agency/spec](https://sovereignmatrix.agency/spec).
- Live cryptographic demo at [sovereignmatrix.agency/demo/verify-receipt](https://sovereignmatrix.agency/demo/verify-receipt) — visitor reproduces the HMAC/SHA-256 math on their machine.
- Vertical readiness scoreboard at [sovereignmatrix.agency/readiness](https://sovereignmatrix.agency/readiness) — 100/100 across 5 of 8 verticals, computed programmatically from the open codebase.

---

## Authorisation

- **South Africa work authorisation:** Yes — citizen.
- **Background check:** Will accept.
- **Remote-first:** Yes.
- **Notice / start date:** Immediately available.
- **Salary expectations:** The posted ZAR 115K-135K monthly range works as a starting anchor. Open to discussing equity weighting given the technical leadership scope.

---

## A final, honest framing

I am applying because the role description maps line-for-line to the platform I have built. If the bar is "did this candidate tick every box on the listing", I am not your best applicant. If the bar is "can this candidate own the AI architecture, ship the agentic pipeline, lead the self-hosted-LLM migration, and bring real cybersecurity-grade primitives to the team", I would back myself — and I am willing to prove it with a live 60-minute architecture walkthrough of the Sovereign Matrix codebase before any further conversation.

— Christiaan de Wet
