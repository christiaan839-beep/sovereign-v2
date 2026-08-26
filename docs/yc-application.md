# Y Combinator Application — Sovereign Matrix

**Status:** Draft. Founder edits the personal sections, leaves the product/market sections as-is.

Apply at https://ycombinator.com/apply. Application takes ~2 hours if you use this as the scaffold.

---

## Company

**Company name:** Sovereign Matrix

**Company URL:** https://sovereignmatrix.agency

**Demo video** (60s): Record a Loom showing `/demo/verify-receipt`. Walk through one receipt, hit "show canonical projection", run the `openssl dgst` command in your terminal, get the same hex. That's it. The cryptographic verification IS the demo.

**Phone number:** [your number]

**Country of operation:** [your country] (also serves US, EU, UK)

---

## Founders

**Single founder?** Yes (note: YC accepts solo founders — they just want the answer)

**Background / why you:**

> I built Sovereign Matrix as the cryptographic-receipts layer underneath every AI agent decision. [1–2 sentences on your background — what made you uniquely fit to build this. Mention any past technical work, security/compliance domain knowledge, prior startup or enterprise experience. Be specific. YC reads 10,000 of these and skips fluff.]
>
> I write the code, design the cryptographic primitives, ship the verticals, and own the GTM. Looking to bring in 1 GTM hire post-YC.

**How long known the cofounder(s) you applied with?** N/A — solo.

---

## Product

**What does your company do? (in 50 chars):**

> Cryptographic receipts for AI agent decisions.

**Why now? (in 1500 chars):**

> Three forcing functions converging in 2025-2026: (1) EU CSRD wave-1 (~12,000 issuers) requires limited-assurance audit of AI-generated ESG disclosures starting this year. (2) NAIC's Model Bulletin on AI/ML demands "decisional traceability" for insurance claims AI. (3) Fed SR 11-7, PRA SS1/23, FDA 21 CFR Part 11, ICH GCP — every regulated industry now requires AI decisions to be replayable for auditor verification.
>
> Today the answer is screenshots in a slide deck. Vanta and Drata sell compliance scoreboards but ship no cryptographic primitive — auditors trust the screenshot. We ship the cryptographic layer: HMAC-SHA256 + Ed25519 signed receipts + Merkle inclusion proofs + ZK pass-rate proofs + receipt-chain ratchet + anonymous-credential auditor seats. Auditor verifies the AI decision in their own workpaper system without trusting our database. Same buyer Vanta sold to for $2.45B, 10× larger budget unlock once AI moves into the regulated workflow.

**What's new about your approach? (in 1500 chars):**

> Every existing AI agent platform (Lindy, Clay, Manus, Relevance, CrewAI, Sintra, n8n, Zapier, Bardeen, HubSpot agents) outputs unsigned text. Auditors can't verify the decision without trusting the vendor's database. We output a cryptographically signed receipt with: (1) HMAC-SHA256 over a canonical projection, (2) per-tenant Ed25519 signature, (3) Merkle inclusion proof tying the receipt to a tamper-evident chain, (4) model fingerprint committing the LLM provider/version + behavior canary hash, (5) ZK pass-rate proof letting industry consortiums share aggregate metrics without exposing raw data, (6) anonymous credential capability tokens letting external auditors verify receipts without ever seeing the underlying tenant identity.
>
> The architectural primitive — cryptographic chain-of-custody on every AI decision — does not exist anywhere else in the agent ecosystem. We shipped 7 of these primitives in the last 30 days as composable library modules. They're verifiable in the open codebase.

**What's your business model? (in 1500 chars):**

> Three revenue layers stacked on top of standard SaaS tiers (free / starter / array / node / enterprise from $0–$499/mo):
>
> (1) **Regulatory packs** at $45K–$75K/yr each — modular scoreboards mapping the existing primitives onto a specific framework (CSRD, SR 11-7, NERC CIP, 21 CFR Part 11, FedRAMP). Each pack ships with a vertical landing page and audit-bundle template.
>
> (2) **Auditor Replay Seats** at $50K/seat/yr — read-only access for external auditors to replay receipts via anonymous credentials. Customer never wants to "pay for their auditor's clicks" but happily pays $50K/yr for the seat. Self-service onboarding via OpenAPI 3.1.
>
> (3) **Crypto-receipt API overage** at $0.05/receipt — beyond-plan receipt issuance for high-throughput enterprise tenants. Justified because the receipt itself is the cryptographic artifact, not the LLM call.
>
> Average regulated-industry ACV: $400K–$600K. 4 paid logos = $2M ARR. 25 paid logos = $12M ARR. The Vanta trajectory — same buyer, same procurement vehicle, same 10x ARR multiple at exit.

---

## Traction

**How many users / customers do you have?**

> [Be honest. If pre-revenue: "Zero paying customers today. Eight named accounts in active conversation: 3 Big-4 sustainability practices on the CSRD pack, 2 regional banks on SR 11-7 model risk, 1 CRO clinical-trials site, 2 P&C carriers on the NAIC AI bias compliance posture."]
>
> [Edit when you sign your first design partner.]

**Total revenue this year:** $0 (pre-revenue at YC application time)

**Anything else investors should know? (1500 chars):**

> The codebase is the proof: 140 agent endpoints across 8 LLM providers, 4,500+ tests passing, 38 DB tables, 22 vertical landing pages, 7 cryptographic primitives with frozen public specs. Single founder shipped this in [N] months. Every number here is reproducible from a clone: `npm test`, `npm run gen:registry -- --check`. Live at sovereignmatrix.agency.
>
> The Auditor Replay Seat add-on SKU is wired through Stripe checkout (`src/lib/add-ons.ts` + `/api/payments/stripe/addon-checkout`); the webhook provisioner (`src/lib/add-on-provisioner.ts`) issues the anon-credential after a successful payment. Revenue loop is technically complete — needs the first signed customer to flip on.
>
> Looking for $500K–$1.5M to close 2 paid pilots in 90 days, hire 1 GTM partner, and apply to DARPA SBIR Phase I in parallel. YC's $500K SAFE + the partner-intro network specifically into Vanta / Drata / Anthropic alumni would be transformational.

---

## How will you make money?

The pricing math:

- 1 Big-4 sustainability practice closes the CSRD Regulatory Pack at $65K/yr + 10 Auditor Replay Seats at $50K = **$565K ACV**
- 1 regional bank closes the SR 11-7 Regulatory Pack at $55K + Node tier at $2,388/yr + 5 Replay Seats = **$308K ACV**
- 1 clinical-trial site closes Part 11 Pack at $60K + 3 Replay Seats = **$210K ACV**
- Mix of 4 logos in Year 1 ≈ **$1.2M–$2M ARR**
- Net dollar retention at this ACV historically 130%+ for compliance-tech (Vanta, Drata benchmarks)

---

## Why us?

**Why are we going to be the team that succeeds?** (1500 chars)

> I shipped 7 cryptographic primitives in [N] months as a solo founder, and the codebase is verifiable rather than described. The hard architectural work — specifying each primitive down to a frozen wire format with a public conformance corpus, mapping each onto the specific regulator (NERC CIP, ICH GCP, NAIC, SR 11-7, CSRD), and shipping vertical landing pages that procurement teams can read — is done.
>
> What I need is the GTM motion: warm intros into Big-4 partners, 1 design partner that converts to paid, and the runway to hire the first salesperson. YC's partner network at Vanta and Anthropic alumni specifically solves the wedge problem (Sustainability Assurance partner at Big-4 + Chief Model Risk Officer at a regional bank).

---

## Final notes for the application

1. **Be honest about traction.** YC will dig in. "Zero paying customers, 8 named accounts in conversation" beats inflated numbers every time.
2. **The demo video matters.** Record `/demo/verify-receipt` in 60 seconds. Show the openssl command verifying the signature. That's the moment YC partners go "oh."
3. **Solo founder is fine** but mention you've identified the GTM hire profile and have warm conversations.
4. **Apply early.** Each batch has rolling decisions. Apply within 24 hours of completing this draft.

---

**After submission:** Tweet a 1-line teaser linking `/demo/verify-receipt`. Post on LinkedIn tagging 5 named buyers from `docs/INVESTOR_OUTREACH.md`. DM the 5 Tier-1 partner names in parallel — YC won't be your only path.
