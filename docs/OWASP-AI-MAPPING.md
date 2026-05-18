# OWASP LLM Top 10 (2025) — VAOS / Guardian / Transparency-Log mapping

A line-by-line cross-walk between the OWASP Top 10 for LLM Applications
(2025 edition) and the primitives shipped in this repository.

This is the single page a security architect asks for when they're
evaluating an AI vendor. "Show me the OWASP Top 10. Now show me what
you do for each one." VAOS + Guardian + ART-Log give specific,
verifiable answers — most of them auditable by a third party with
nothing but the OSS verifier + the published Ed25519 key.

CC0 1.0. Republish freely. Last updated: 2026-05-18.

---

## LLM01: Prompt Injection

**The risk:** an attacker injects instructions into the prompt that
hijack the model's behavior. The model returns content that violates
the operator's policy.

**What we ship:**

- `src/lib/jailbreak-detect.ts` and `src/lib/nemo-guardrails.ts` —
  pre-flight detection of known prompt-injection patterns (`ignore
previous instructions`, role-escape sequences, base64-encoded
  payloads).
- 5-layer output verifier (`src/lib/output-verifier.ts`) runs every
  agent output through jailbreak detection, content policy, PII scan,
  quality scoring, and trust gate **before** the receipt is signed.
- The signed receipt's `safetyResult` field records the verifier's
  verdict per-decision. An auditor can confirm the safety pipeline
  ran and what it found.

**Third-party verifiable:** yes. The `safetyResult.passed` boolean
is signed under the receipt; tampering with it invalidates the
signature.

---

## LLM02: Sensitive Information Disclosure

**The risk:** the model leaks PII, credentials, training data, or
proprietary information in its output.

**What we ship:**

- `hipaaPack` (HIPAA Privacy Rule §164.514 Safe Harbor) — SSN block,
  MRN/DOB/phone warnings. Apache-2.0.
- `pciDssPack` (PCI DSS v4.0 §3.5.1, §3.3.1, §3.3.1.1) — full-PAN
  block (Visa/Mastercard/Amex/Discover), CVV block, magnetic-stripe
  track-data block.
- `masPack` (Singapore PDPA) — NRIC block.
- `gdprRedactionRule` (forthcoming) — EU PII patterns.
- `src/lib/dsar-redact.ts` — DSAR-driven redaction before
  publishing to the transparency log.

**Third-party verifiable:** yes. If a receipt's Guardian verdict is
`block`, the canonical projection records the rule that blocked
it. An auditor can re-run the same Guardian pack offline against
the captured input and confirm the verdict matches.

---

## LLM03: Supply Chain

**The risk:** model weights, plugins, or dependencies are tampered
with mid-supply-chain. The agent runs a compromised dependency.

**What we ship:**

- The OSS package `@sovereign-matrix/verifiable-receipts` is npm-
  signed (`--provenance` flag in `.github/workflows/release-oss.yml`).
- `docs/REPRODUCIBLE.md` walks an external auditor through cloning
  - building from source + sha256-comparing the dist tarball against
    npm's published version.
- `.github/workflows/ci.yml` runs `npm audit signatures` on every
  CI run.
- `npm audit --audit-level=high` blocks PR merges.

**Third-party verifiable:** yes. The npm provenance attestation is
checkable via `npm audit signatures` without trusting us.

---

## LLM04: Data and Model Poisoning

**The risk:** an attacker poisons training data or fine-tuning data
to bias the model's outputs.

**What we ship:**

- VAOS receipts pin `modelUsed` per-decision. If a poisoned model is
  ever discovered, the audit chain can identify every receipt issued
  under that model version.
- `sr117Pack` (Fed SR 11-7 / OCC 2011-12) — model risk management
  rules. Bare-numeric-output block, short-narrative warning.
- `masPack` (MAS FEAT §F.4) — traceability rule warns when a
  financial decision is issued without model lineage in the receipt.

**Third-party verifiable:** yes. Every receipt's `modelUsed` is in
the signed payload — a regulator can query "show me every receipt
signed under model X between dates Y and Z" and verify the chain.

---

## LLM05: Improper Output Handling

**The risk:** downstream systems trust the model's output verbatim
(SQL injection via generated query, XSS via generated HTML, etc.).

**What we ship:**

- Every output passes through `src/lib/content-safety.ts` for the
  most common injection patterns before signing.
- The receipt's signed `output` field carries the EXACT bytes that
  were returned; a downstream consumer can verify the output bytes
  match what was signed and what was approved by the safety pipeline.

**Third-party verifiable:** yes. The `output` field in the canonical
projection is byte-stable.

---

## LLM06: Excessive Agency

**The risk:** an AI agent is given more privileges than it needs —
write-access, payment-rails, etc. — and a prompt-injection or model
hallucination exploits it.

**What we ship:**

- JIT identity tokens (`src/lib/agent-tokens.ts`) — every agent
  invocation gets a one-shot HS256/EdDSA token scoped to the specific
  agent, tenant, user, and permission set. Expires in minutes.
- `src/lib/rbac.ts` — admin-action allow-list.
- `src/lib/webauthn.ts` — hardware-key step-up for any privileged
  action (SOC 2 CC6.1 compliance).
- `cfpbPack` (ECOA §1002.9) — credit decisions REQUIRE explicit
  rationale; bare "approved/denied" outputs are blocked.

**Third-party verifiable:** the JIT tokens are receipt-bound — every
receipt records the token that authorized the agent run.

---

## LLM07: System Prompt Leakage

**The risk:** the system prompt (which often contains business
logic, model constraints, or scratchpad-style reasoning) leaks to
the user via clever prompting.

**What we ship:**

- The canonical projection excludes the system prompt by default;
  it's signed as a `safetyResult.systemPromptHash` (SHA-256 only).
  A receipt audit can confirm the same system prompt was used
  without revealing its content.
- Jailbreak detection blocks `system override`, `dan mode`, and
  similar known leak triggers.

**Third-party verifiable:** the `systemPromptHash` lets an auditor
confirm "every receipt in this batch was produced under the same
system prompt" without seeing the prompt.

---

## LLM08: Vector and Embedding Weaknesses

**The risk:** the retrieval system returns malicious or stale
context that biases the model output.

**What we ship:**

- `src/lib/agent-memory.ts` — every memory write is itself a signed
  receipt. The chain of "which past receipts informed today's
  decision" is reconstructable from public bytes.
- The MemoryMoat surface on the landing page documents this
  explicitly: "audit-grade retrieval, not just smart retrieval".

**Third-party verifiable:** yes. A regulator can ask "which past
decisions informed this output?" and get a list of verifiable
receipt ids.

---

## LLM09: Misinformation

**The risk:** the model confidently produces incorrect or fabricated
information. The user acts on it.

**What we ship:**

- `src/lib/consensus.ts` — `verifiedAi()` runs generate → critique →
  revise with TWO different models for the same prompt. Disagreement
  flags low confidence in the receipt.
- `src/lib/quality-scorer.ts` — heuristic quality score gates output
  before signing.
- `csrdPack` (EU CSRD §3.5) — source-citation rule for sustainability
  reports.
- `fcaPack` (FCA FG24/2) — financial AI outputs require per-decision
  explainability anchor.
- `euAiActPack` (EU AI Act Art. 15) — high-risk AI outputs require
  accuracy / confidence attestation.

**Third-party verifiable:** the `safetyResult.score` field is signed.
Operators can set a contractual minimum (e.g. "all receipts in
production must show score > 0.85") and an auditor can verify
compliance.

---

## LLM10: Unbounded Consumption

**The risk:** an attacker triggers expensive agent runs to exhaust
the operator's AI budget.

**What we ship:**

- `src/lib/budget-guard.ts` — per-tenant daily AI-spend cap enforced
  pre-flight on every `ai()` call. Free-tier providers (NIM, Ollama,
  Cerebras) bypass; paid providers (Claude, Gemini) check the meter.
- `src/lib/rate-limit.ts` — Upstash-backed distributed rate limiter
  per IP / per user / per endpoint.
- `src/lib/plan-enforcement.ts` — quota enforcement per plan tier
  (free = 50 runs/mo, starter = 200, etc.).
- The AI router cascades through providers cheapest-first
  (Ollama → Cerebras → NIM → paid) — Wave 37 cost audit closed
  18+ misrouted Claude calls.

**Third-party verifiable:** the receipt's `durationMs` is signed.
Cost-per-decision is reproducible from receipts.

---

## Bonus — what OWASP doesn't (yet) cover but we do

### Post-quantum cryptographic forward security

Every receipt can be dual-signed with Ed25519 + ML-DSA-65 (FIPS 204).
Receipts signed today verify in 2050 even after a
cryptographically-relevant quantum computer (CRQC) breaks Ed25519.
See `docs/specs/vaos-3.0.md`.

### Tamper-evident publication via transparency log

RFC 6962-style Merkle log. Every receipt's leaf hash is appended.
Independent witnesses (any third party can run `npx @sovereign-matrix/verifiable-receipts-witness`)
co-sign STHs, making vendor-controlled log forks mathematically
detectable. See `docs/specs/transparency-log.md`.

### Bitcoin-anchored timestamp integrity

Tree heads anchor to Bitcoin via OpenTimestamps. The timing is
pinned to a chain the vendor does not control.

### CC0 wire-format specification

VAOS 1.0 / 2.0 / 3.0 are public-domain specs. The wire format isn't
captured by any single vendor — anyone can implement, anyone can
verify.

---

## How to use this document

**For procurement reviewers:** paste this URL into your vendor
questionnaire response section. Every claim above is verifiable
against the OSS package + the public endpoints.

**For security architects:** treat this as the starting point for
your threat model. For each LLM0X item, identify which Guardian pack

- which signed receipt field gives you the audit trail you need.

**For other AI vendors:** fork this doc. Replace "Sovereign Matrix"
with your name. Map your stack to each OWASP item. If you arrive at
"no answer" for any item, that's the gap to close.

---

## Sources

- OWASP Top 10 for LLM Applications 2025 — <https://owasp.org/www-project-top-10-for-large-language-model-applications/>
- VAOS 1.0/2.0/3.0 specs — `docs/specs/`
- AI Receipt Transparency Log spec — `docs/specs/transparency-log.md`
- IETF Internet-Draft — `docs/specs/draft-dewet-vaos-receipts-00.md`
- OSS package — `@sovereign-matrix/verifiable-receipts` on npm
- Whitepaper — `docs/WHITEPAPER.md`

---

## License

CC0 1.0 (public domain). Fork, embed, paste into procurement
responses without restriction.

For corrections or additions: `spec@sovereignmatrix.agency`.
