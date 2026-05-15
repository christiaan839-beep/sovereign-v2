# Cover Letter — Head of Artificial Intelligence

**Posted by:** Hotsourced · **Role:** AI Engineering Lead — Agentic Systems & LLM Architecture
**Applicant:** Christiaan de Wet · **Date:** 15 May 2026

---

Dear hiring team,

I want to be straight with you up front: **on the strict checklist of this job posting, I do not tick every box.** I am applying anyway because I have spent the last six months building a working agentic-AI platform that maps directly to almost every responsibility in the role description, and I would rather be evaluated on what I have shipped than on years served.

The platform is **Sovereign Matrix** ([sovereignmatrix.agency](https://sovereignmatrix.agency)). Solo founder, sole engineer. 145 production agents across 8 LLM providers, 215,000 lines of strict-typed TypeScript, 2,565 passing tests, 7 cryptographic primitives, multi-tenant by default, deployed and live. The code is open and I will walk through any module on the call.

## Where the role description matches what I have already shipped

**"Extend and optimise the multi-agent pipeline built on graph-based orchestration frameworks."**
Sovereign Matrix is exactly this. 145 agents orchestrated via a custom factory (`src/lib/agent-factory.ts`), agent-teams + swarm-protocol modules, and a deterministic playbook DSL. It is functionally the LangGraph layer rebuilt from first principles — conditional execution flows, shared state machines, dynamic tool-dispatch — written in TypeScript so it ships on serverless edge.

**"Enhance deterministic routing, shared state machines, and conditional execution flows."**
The Sovereign router (`src/lib/ai.ts`) is the single entry point for every LLM call across the platform. Cascade routing prioritises self-hosted Ollama → Cerebras → NIM → paid Claude / Gemini fallback. Budget-, plan-, and trust-gated decisioning at the request boundary. This is "deterministic frameworks + LLM cognition" already shipped.

**"Improve dynamic tool/skill dispatch for cost-efficient and accurate agent behaviour."**
Already there. Per-tenant per-agent cost-anomaly detection (`cost-anomaly.ts`), drift detector (`drift-detector.ts`), shadow-run regression detector (`shadow-run.ts`), hallucination guard (`output-verifier.ts` layer 6) that rejects unsupported claims before they reach the customer.

**"Implement advanced capabilities such as incident correlation, anomaly detection, and risk scoring."**
This is the heart of the platform. Drift detection, cost anomalies, jailbreak detection, bias auditing, NEMO Guardrails — every one is shipped, tested, committing cryptographic receipts on every run. The receipt fabric itself (HMAC-SHA256 + Ed25519 + Merkle inclusion proofs + receipt-chain ratchet + anonymous-credential auditor seats + verifiable model fingerprinting + zero-knowledge cross-tenant pass-rate proofs + blockchain anchoring) is the most defensible cybersecurity moat I have seen any agentic-AI platform ship to date.

**"Lead the transition from third-party LLM services to self-hosted open-source models."**
The Sovereign cascade is already self-hosted-first. Ollama gets first refusal on every request; paid LLMs only when local cannot meet the quality bar. Migrating a tenant to fully self-hosted is a configuration flag (`data-sovereignty=on-prem`). The cost-modelling framework (`cost-forecast.ts`) for the phased migration is already in place.

**"Secure, multi-tenant SaaS architectures … threat frameworks and incident response workflows."**
15 dedicated security modules. Hard tenant-id scoping in every Drizzle query. Webhook signature verification on 10 webhooks. RFC 9116 disclosure policy (`/.well-known/security.txt`). GDPR Article 28 Data Processor declaration. SOC 2 Type 2 control-evidence collector that maps 24 TSC controls to existing modules.

## Where I do not match — being honest

| Requirement                        | Honest reality                                                                                                                                                                                                              |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7+ years AI/ML engineering         | Fewer than 7 on paper. The Sovereign Matrix build represents the depth of AI-system engineering most senior engineers ship in 5+ years; I would rather be judged on the codebase than the calendar.                         |
| Strong Python in production        | TypeScript-dominant the last 12 months. Comfortable in Python (server/python-agents directory in Sovereign), but not my primary daily driver. 2-4 week ramp.                                                                |
| LangGraph specifically             | Have not shipped LangGraph in production. Built the equivalent custom layer in Sovereign. Productive in week one.                                                                                                           |
| Demonstrated team mentorship       | Solo founder; no direct reports yet. I can lead architecture and pair-mentor immediately. Running a 6+ person team is new ground I would learn alongside a strong CTO.                                                      |
| Large-scale supervised fine-tuning | Limited — I have deployed open-source models, not done supervised fine-tuning at scale. The strategic-migration objective in the listing implies a learning curve for any candidate; I would close it in the first quarter. |

I have read the qualification list carefully. On a strict checklist I am a B+ candidate. On the actual question — _"can this person own the architecture, ship the multi-agent pipeline, lead the self-hosted-LLM migration, and bring cybersecurity-grade primitives to the team?"_ — I have already done it once at substantial scale. The codebase is the evidence.

## What I bring beyond the job description

- A working production platform you can clone and run today. Open repository, PR-level transparency.
- South African work authorisation (citizen). POPIA-native primitives already shipped — cookie banner, GDPR/POPIA Data Processor doc, audit logging with hashed user_id.
- Pre-mapped regulatory packs for the verticals your customers operate in: NERC CIP, SR 11-7, NAIC AI-bias, 21 CFR Part 11, EU CSRD/ESRS, FedRAMP, ICH GCP, NIST AI RMF.
- A bias toward shipping. Approximately 25 production PRs in the last 7 days, all green, all reviewable.

## On the conflict-of-interest question (worth surfacing)

Sovereign Matrix is mid-fundraise. I am open about that and would address it transparently with the CTO at the first conversation. My intent is that the role here — AI architecture for a cybersecurity startup — is so close to what I already build that the two efforts are complementary rather than competitive: Sovereign sells the verification layer to regulated enterprises; the client platform serves SMB / mid-market security operations. I am happy to sign a focused NDA or non-compete on overlapping IP.

## Logistics

- **South Africa citizen, remote-ready, immediately available.**
- **3+ years AWS:** Yes — S3, Lambda, IAM, EC2, CloudFront.
- **Background check:** Will accept.
- **Salary:** The posted ZAR 115K-135K monthly range works as a starting anchor. Happy to discuss equity weighting given the technical leadership scope.

The shortest path to a high-confidence hiring decision is a 60-minute architecture deep-dive — I will walk through the Sovereign codebase live and answer every question the team has, including the ones the listing does not. I look forward to it.

— Christiaan de Wet
[your.email@domain.com] · [+27 phone] · [LinkedIn]
[https://sovereignmatrix.agency](https://sovereignmatrix.agency) · [/demo/verify-receipt](https://sovereignmatrix.agency/demo/verify-receipt)
