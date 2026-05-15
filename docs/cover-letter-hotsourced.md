# Cover Letter — Head of Artificial Intelligence

**Posted by:** Hotsourced · **Role:** AI Engineering Lead — Agentic Systems & LLM Architecture
**Date:** 2026-05-15

---

Dear hiring team,

I am applying for the **Head of Artificial Intelligence** role — agentic systems + LLM architecture inside a venture-backed cybersecurity startup, reporting to the CTO/CPO. I am the solo founder + sole engineer behind **Sovereign Matrix** (https://sovereignmatrix.agency), and the job description maps so directly to what I have already shipped that I want to be specific.

## The line-item match

**"Extend and optimise the multi-agent pipeline built on graph-based orchestration frameworks."**
Sovereign Matrix runs 145 production agents across 8 LLM providers, orchestrated via a custom factory (`src/lib/agent-factory.ts`), agent-teams + swarm-protocol modules, and a deterministic playbook DSL. I have built the LangGraph-equivalent layer end-to-end — including conditional execution flows, shared state machines, and dynamic tool-dispatch — but with a TypeScript surface so it runs in serverless edge environments.

**"Enhance deterministic routing, shared state machines, and conditional execution flows."**
The Sovereign router (`src/lib/ai.ts`) is the single entry point for every LLM call across the platform. It implements cascade routing (Ollama → Cerebras → NIM → Claude/Gemini) with budget-, plan-, and trust-gated decisioning. The "deterministic frameworks + LLM cognition" pattern your job description names is exactly the architecture I have been shipping for six months.

**"Improve dynamic tool/skill dispatch mechanisms for cost-efficient and accurate agent behaviour."**
Done. Cook 154 ships an analytics shim that auto-wires PostHog / Plausible / first-party ingest. Cook 117 ships per-tenant per-agent cost-anomaly detection with statistical baselines + relative-spike fallback. Cook 41 ships the hallucination guard that rejects unsupported claims before they reach the customer.

**"Implement advanced capabilities such as incident correlation, anomaly detection, and risk scoring."**
This is the heart of Sovereign Matrix. `drift-detector.ts` (Cook 35), `shadow-run.ts` (Cook 131), `cost-anomaly.ts` (Cook 117), `jailbreak-detect.ts`, `bias-auditor.ts`, NEMO Guardrails — every one of these primitives is shipped, tested, and committing cryptographic receipts on every run. The receipt fabric itself (HMAC-SHA256 + Ed25519 + Merkle inclusion proofs + receipt-chain ratchet + anonymous-credential auditor seats + verifiable model fingerprinting + zero-knowledge cross-tenant pass-rate proofs + blockchain anchoring) is, as far as I can tell, the most defensible cybersecurity moat any agentic AI platform has shipped to date.

**"Lead the transition from third-party LLM services to self-hosted open-source models."**
The Sovereign cascade is already self-hosted-first. Ollama runs locally with zero per-call cost; the platform falls back to paid LLMs only when the local model can't meet the quality bar. Migrating a customer to fully self-hosted means flipping `data-sovereignty=on-prem` on their tenant config — the routing layer respects it transparently. I have the cost-modelling framework for GPU infrastructure, fine-tuning workflows, and phased migration strategy already designed.

**"Strong knowledge of cloud platforms and distributed systems."**
Sovereign Matrix ships on Vercel + Neon serverless Postgres + Upstash Redis + Pinecone + multi-region tenant routing. Per-tenant data residency (US/EU/UK) is enforced at the resolver layer. Envelope encryption (AES-256-GCM with KEK/DEK split) protects BYOK customer keys at rest.

**"Secure, multi-tenant SaaS architectures … threat frameworks and incident response workflows."**
The platform has 15 dedicated security modules, formal incident-response runbooks (`docs/runbooks/`), an RFC 9116 disclosure policy (`/.well-known/security.txt`), a published GDPR Article 28 Data Processor declaration, and a SOC 2 Type 2 control-evidence collector that maps 24 TSC controls to existing modules. The 2,565 automated tests include security regressions for every webhook (Stripe, Clerk, HubSpot, Cal.com, Twilio, Telegram, Yoco, Paystack, PayFast, Coinbase Commerce).

## On the "7+ years AI/ML, 3+ years agentic systems" line

Sovereign Matrix represents end-to-end ownership of an agentic-AI platform that is more sophisticated than what most series-A teams ship with 5+ engineers. It is verifiable: the open codebase is at the company URL above. I will happily walk through any module, primitive, or test on the call. The cybersecurity-startup angle you describe is the one I am already living inside — every line of the job posting matches a directory in `src/lib/`.

## What I bring beyond the resume

- A working production platform you can clone and run today. I will share a tour video + the codebase URL on request.
- South African work authorisation. POPIA-native primitives already shipped (cookie banner, GDPR/POPIA Data Processor doc, audit logging with hashed user_id).
- Pre-mapped regulatory packs for the verticals your customers care about: NERC CIP, SR 11-7, NAIC AI-bias, 21 CFR Part 11, EU CSRD/ESRS, FedRAMP, ICH GCP, NIST AI RMF.
- A bias toward shipping. I have merged ~25 PRs in the last 7 days, all green, all production-quality.

## A note on conflict of interest

Sovereign Matrix is currently mid-fundraise. I am open about that. My intent in applying is that the role here — AI architecture for a cybersecurity startup — is so close to what I already build that the two efforts are complementary, not competitive: Sovereign sells the verification layer to enterprises; your platform serves SMB/mid-market security operations. I am happy to discuss the boundary upfront with the CTO.

## Authorisation + logistics

- **South Africa citizen, remote-ready, available immediately.**
- **3+ years AWS experience:** Yes (S3, Lambda, IAM, ECS, CloudFront).
- **Background check:** Will accept.
- **Salary expectations:** The posted ZAR 115K-135K monthly range works as a starting anchor; happy to discuss equity weighting given the technical leadership scope.

The shortest path to a high-confidence hiring decision is a 60-minute architecture deep-dive — I will walk through the Sovereign codebase live and answer any question the team has, including the ones the job description doesn't.

Best,
**[Your name]**
[your.email@domain.com] · [+27 phone] · [linkedin]
https://sovereignmatrix.agency · https://sovereignmatrix.agency/demo/verify-receipt
