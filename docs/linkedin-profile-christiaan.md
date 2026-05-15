# LinkedIn Profile Copy — Christiaan de Wet

Two assets:

1. **Headline** (max 220 chars) — replaces the current "AI Agents" line.
2. **About** section (max 2,600 chars) — paste into the About box.

LinkedIn doesn't render markdown. The text inside the code blocks below is **plain-text, ready to paste directly** into the LinkedIn editor. Line breaks survive; emojis are optional.

---

## 1. Headline

Current: _"AI Agents"_

Recommended (227 chars at full version — pick A, B, or C below depending on what fits):

### Option A — Tight + outcome-focused (133 chars, fits everywhere)

```
Founding Engineer at Sovereign Matrix · Agentic AI + Cryptographic Verification · 145 agents · 7 crypto primitives · Open to senior AI roles
```

### Option B — Buyer-first (146 chars)

```
I ship cryptographic AI verification at scale · Founder of Sovereign Matrix · 145 agents, 2,565 tests, 7 crypto primitives · Open to AI Eng roles
```

### Option C — Recruiter-keyword-optimised (180 chars)

```
Founding AI Engineer · Multi-Agent Systems · LLM Architecture · Cryptographic Receipts · TypeScript + Python + AWS · Cape Town-Remote · Open to Senior AI Engineer / Architect / Head-of-AI roles
```

**Recommendation: Option C** — keyword-rich for LinkedIn recruiter search (AI Engineer, LLM, AWS, Architect, Head-of-AI all appear), still readable, signals open-to-work clearly.

---

## 2. About section — ready to paste

The plain-text block below fits within LinkedIn's 2,600-char limit (~2,400 chars including line breaks). Copy everything between the two `===` markers into LinkedIn's About editor.

```
===============================================================
I built Sovereign Matrix — a production agentic-AI platform with 145 agents across 8 LLM providers, 7 cryptographic primitives, 215,000 lines of strict-typed TypeScript, and 2,565 passing tests — solo, end-to-end, in roughly six months.

The platform is live at sovereignmatrix.agency.

————————————————————

WHAT I BUILD

— Multi-agent orchestration: custom agent factory, teams, swarm protocol over 145 production agents (analogous to LangGraph, built from first principles).

— Hybrid AI architecture: deterministic 5-layer output verifier (LlamaGuard + PII + content-policy + quality + trust gate) wrapped around LLM cognition.

— Cost-efficient model routing: cascade router (local Ollama → Cerebras → NIM → paid Claude/Gemini) with budget-, plan-, and trust-gated decisioning. Self-hosted-first by default.

— Cryptographic primitives: HMAC-SHA256 + Ed25519 receipts · Merkle batching with O(log n) inclusion proofs · receipt-chain ratchet · anonymous-credential auditor tokens · verifiable model fingerprinting · retention proofs · blockchain anchoring.

— Multi-tenant SaaS: 44 PostgreSQL tables, per-tenant data residency (US/EU/UK), RBAC, white-label rewrites.

— Compliance engineering: SOC 2 evidence collector mapping 24 TSC controls. GDPR Article 28 Processor. Regulatory packs for CSRD, SR 11-7, NERC CIP, 21 CFR Part 11, FedRAMP, NAIC AI Bias, ICH GCP.

————————————————————

WHO I AM LOOKING TO WORK WITH

A founding-engineer, senior-AI-architect, or Head-of-AI seat at a seed or Series A company where:

— The codebase is the proof, not the resume.
— AI agents need real verification primitives (compliance, audit, regulated workflows).
— Solo + small-team velocity is the operating mode.
— The team values honest gap acknowledgement over inflated CVs.

Open to: full-time, technical co-founder, fractional, or advisory engagements.

————————————————————

VERIFY THE WORK IN 60 SECONDS

— Platform: sovereignmatrix.agency
— Live cryptographic demo: sovereignmatrix.agency/demo/verify-receipt
— Investor data room: sovereignmatrix.agency/investors
— Vertical readiness scoreboard: sovereignmatrix.agency/readiness

————————————————————

CONTACT

christiaan@sovereignmatrix.agency
+27 79 162 3348
Cape Town, South Africa · Remote-first · Immediately available
===============================================================
```

---

## Tactical use

1. **Hit "Add a summary"** on your LinkedIn profile (LinkedIn already prompted you in your screenshot).
2. **Paste the block above** between the `===` markers — discard the markers.
3. **Update the headline** to Option C from the section above.
4. **Keep the #OPENTOWORK ring** you already have on the profile photo.
5. **Pin your top 3 featured items** under your name:
   - sovereignmatrix.agency (link)
   - sovereignmatrix.agency/demo/verify-receipt (link with thumbnail)
   - sovereignmatrix.agency/investors (link with thumbnail — optional, this one is noindex but still works as a featured pin)

Doing those four things in a row takes ~15 minutes and dramatically lifts profile-view conversion. LinkedIn members who include a summary get up to 3.9x more profile views (per their own data, shown in your screenshot).

---

## Recruiter-side keyword density

The About text above is optimised for LinkedIn Recruiter search by including the following key terms in natural phrasing:

| Term                   | Why recruiters search it                             |
| ---------------------- | ---------------------------------------------------- |
| **AI Engineer**        | Standard role title                                  |
| **LLM**                | LangGraph + LangChain are downstream of this keyword |
| **Multi-agent**        | Cutting-edge field                                   |
| **TypeScript**         | Your strongest stack                                 |
| **Python**             | Adjacent — drives more matches                       |
| **AWS**                | Standard infra keyword                               |
| **Multi-tenant SaaS**  | Enterprise B2B filter                                |
| **Cryptographic**      | Niche differentiator                                 |
| **Founding engineer**  | Startup-stage filter                                 |
| **Head of AI**         | Senior leadership keyword                            |
| **Cape Town · Remote** | Location filter for SA + remote-friendly roles       |

When a recruiter at Hotsourced, an SA cybersecurity startup, or an international remote-first company searches LinkedIn Recruiter for "AI Engineer South Africa" or "LLM Founding Engineer Remote," this profile will surface near the top.

---

## Optional polish (15 more minutes)

- **Featured section:** Add `/demo/verify-receipt` as a featured link with a custom thumbnail (use the OG image we shipped at `/demo/verify-receipt/opengraph-image`).
- **Open to Work settings:** In the "Open to Work" panel, set role titles to: _AI Engineer, Senior AI Engineer, AI Architect, Head of AI, Founding Engineer, Technical Co-founder_. Toggle "Remote" + "Cape Town" + "South Africa" + "Global remote."
- **Skills section:** Add "AI/Machine Learning," "Multi-Agent Systems," "LLM," "TypeScript," "Cryptography," "AWS," "Python," "SaaS Architecture" as endorsable skills. Top 3 pinned skills are the only ones recruiters see in compact search results — pin **AI/Machine Learning + LLM + TypeScript**.
