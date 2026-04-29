# @sovereign/inspector

> **Trustless verifier for Sovereign Matrix.** Verify any deployment's
> audit chain, delegation chain, HITL routing policy, and platform
> health WITHOUT trusting the platform itself. All verification math
> runs locally on your machine.

[![npm](https://img.shields.io/npm/v/@sovereign/inspector.svg)](https://www.npmjs.com/package/@sovereign/inspector)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## What is this?

Most "compliance" claims by software platforms boil down to *"trust
us, we hash it."* Sovereign Matrix takes the opposite stance:
**don't trust us — verify us.**

This package gives third parties (auditors, customers, competitors,
regulators) the cryptographic primitives to verify Sovereign trust
artifacts independently. If our claims are true, your verification
passes locally. If we ever lied, your verification fails immediately.

The math is the truth — Sovereign servers cannot be a trust anchor
because the cryptography is reproducible.

## Install

```bash
npm install -g @sovereign/inspector
```

Requires Node 20+.

## CLI usage

```bash
# Run all checks against a Sovereign deployment
sovereign-inspect full https://sovereignmatrix.agency

# Show the SHIPPED HITL routing policy (procurement-readable)
sovereign-inspect policy https://sovereignmatrix.agency

# Self-service deploy diagnostic
sovereign-inspect diagnose https://sovereignmatrix.agency

# Verify a delegation locally — math runs on YOUR machine, not their server
echo '{"userPublicKey":"...", "delegation":{...}}' | \
  sovereign-inspect delegation https://sovereignmatrix.agency

# Verify an audit log array (paste from /api/admin/audit/...)
sovereign-inspect audit-chain < audit.json

# Show an agent's reputation score with full signal breakdown (R40)
sovereign-inspect reputation https://sovereignmatrix.agency travel-agent

# Trustless: fetch raw signals + recompute the score locally + compare (R41)
sovereign-inspect reputation-verify https://sovereignmatrix.agency travel-agent

# Show an agent's Trust-as-Collateral credit line (R42)
sovereign-inspect credit https://sovereignmatrix.agency travel-agent

# Trustless: recompute the credit line locally + compare to the
# platform's published claim. Catches fabricated credit lines (R42).
sovereign-inspect credit-verify https://sovereignmatrix.agency travel-agent

# ── Agentic Commerce ACAT (R91) ──
# Verify an Agentic Commerce Authorization Token offline. The merchant
# pulls the ACAT from `metadata.sovereign_acat` on a Stripe
# PaymentIntent (or any rail's equivalent), then verifies it BEFORE
# charging. No Sovereign network call required.
cat acat.b64 | sovereign-inspect verify-acat \
  --pubkey "<expectedUserPublicKey>" \
  --amount 73420 \
  --currency USD \
  --merchant acme-shop \
  --category marketplace_b2c

# Verify a Stripe chargeback evidence packet — the artifact a merchant
# uploads when an agent-initiated purchase is disputed. The packet is
# self-contained: any auditor or court can re-run the verification.
cat evidence.json | sovereign-inspect verify-evidence \
  --pubkey "<expectedUserPublicKey>"
```

Exit codes:
- `0` — all verifications pass
- `1` — one or more verifications failed
- `2` — usage / argument error

## Library usage

```js
import {
  verifyDelegation,
  verifyAgentAction,
  verifyAuditChain,
} from "@sovereign/inspector/verify";

const result = verifyDelegation({
  delegation: {
    userId: "user_alice",
    agentName: "travel-agent",
    agentPublicKey: "...",
    scope: { max_cents: 5000 },
    issuedAt: "2026-04-28T00:00:00Z",
    expiresAt: "2027-04-28T00:00:00Z",
    delegationMessage: "v1\nuser:user_alice\n...",
    userSignature: "...",
  },
  userPublicKey: "...",
});

if (result.valid) {
  console.log("Delegation cryptographically valid");
} else {
  console.error(`Invalid: ${result.reason}`);
}
```

### Verify an ACAT (R91) inside your checkout pipeline

```js
import {
  decodeACATFromHeader,
  verifyACAT,
} from "@sovereign/inspector/acat";

// In your Stripe webhook handler, after the merchant has verified
// the Stripe signature with `stripe.webhooks.constructEvent(...)`:
const pi = event.data.object;
const tokenB64 =
  pi.metadata.sovereign_acat_chunked === "1"
    // Reassemble chunked metadata if the token is split across keys.
    ? Array.from({ length: Number(pi.metadata.sovereign_acat_parts) },
        (_, i) => pi.metadata[`sovereign_acat_part_${i + 1}`]).join("")
    : pi.metadata.sovereign_acat;

const token = decodeACATFromHeader(tokenB64);
const result = verifyACAT({
  token,
  expectedUserPublicKey: lookupUserPubkey(token.userId),
  cart: {
    amountCents: pi.amount,
    currency: pi.currency.toUpperCase(),
    merchantId: pi.transfer_data?.destination ?? "self",
    category: "marketplace_b2c",
  },
});

if (!result.valid) {
  // 12 distinct reasons — log them, refund the agent, alert the user.
  await refund(pi.id, `acat-invalid:${result.reason}`);
}
```

### Verify a chargeback evidence packet (court-defensible)

```js
import { verifyStripeChargebackEvidence } from "@sovereign/inspector/acat";

const result = verifyStripeChargebackEvidence({
  evidence: JSON.parse(uploadedEvidenceJson),
  expectedUserPublicKey,
});
// result.ok ⇒ packet untampered; result.reason ⇒ specific tamper site.
```

## What gets verified

### Delegation chain

- Ed25519 signature over canonical delegation message
- Expiry not yet reached
- Revocation signature (if any) is also signed by the same user key
  — defends against forged kill-switch attempts

### Per-action signatures

- Agent's signature over the action digest
- Chain hash matches: `sha256(prev_hash || action_digest || agent_signature)`
- Tampering with any past row breaks every subsequent chain hash

### Audit log chain (R26 pattern)

- Each row's `row_hash = sha256(prev_hash || userId || action || resource || details_canonical || createdAt_iso)`
- Walks the entire chain forward; reports the FIRST broken row

### Public agent reputation (R40 + R41 trustless loop)

- Fetches raw on-chain signals (reversal rate, HITL denials, audit
  integrity, manifest age, anomaly events) from
  `/api/identity/reputation/<agentId>/signals`
- Recomputes the letter grade + numeric score with the same pure
  function the platform uses
- Compares to the platform's published score; mismatch = fabricated
  reputation

### Trust-as-Collateral credit lines (R42)

- Reputation grade modulates the daily spend cap via a canonical
  multiplier table: A+ → 5×, A → 3×, B → 1×, F → 0.25×
- Inspector recomputes `effectiveDailyLimitCents = round(base × multiplier)`
  locally from the published grade + base
- Catches fabricated credit lines (platform claiming higher autonomy
  than the grade justifies, or vice versa)

### Agentic Commerce Authorization Tokens — ACAT (R91)

- Ed25519 signature over the canonical ACAT message (matches the
  R34 user delegation pattern)
- Chain hash binds attenuated tokens to their parent
  (`sha256(parentChainHash || message || signature)`)
- Macaroon-pattern attenuation invariant: a re-signed child token
  may NEVER widen scope (max-amount, expiry, merchants, categories)
- 12 distinct verification failure reasons (procurement-grade granularity):
  `message_mismatch`, `signature_invalid`, `user_pubkey_mismatch`,
  `expired`, `not_yet_valid`, `scope_violation`, `merchant_not_allowed`,
  `category_excluded`, `category_not_allowed`, `single_use_consumed`,
  `chain_hash_mismatch`, `amount_exceeds_scope`

### Stripe chargeback evidence packets (R92)

- Self-contained JSON artifact: ACAT + audit chain excerpt +
  re-verification result at evidence-assembly time
- Verifier re-signs the embedded ACAT, recomputes the chain hash,
  and walks the audit chain `prevHash` links
- Distinguishes ACAT tampering from audit-chain-break: if the merchant
  doctored the evidence after the dispute landed, the inspector points
  at the exact failure site

## Why this matters

Most agent platforms ship audit/compliance features as **claims**.
The verifier matters when:

1. **Customer disputes:** "the agent did X without my approval" can
   be settled by a third-party verification of the signature chain.
2. **Procurement audits:** auditors run this CLI on your deployment
   without needing your source access or staff time.
3. **Acquisition risk:** if Sovereign ever vanishes, customers can
   still verify their historical audit trails forever — the math
   survives our company.
4. **Competitive trust:** any vendor claiming "we're audited" can be
   asked: "publish a verifier I can run myself." Most can't.

## Implementation notes

- Pure Node 20+ — no external dependencies beyond `node:crypto`
- Ed25519 (RFC 8410) for signatures
- Canonical JSON for hash determinism
- All functions are pure given their inputs (no I/O, no clock unless explicit)
- Identical implementation to the server-side `src/lib/agent-delegation.ts`
  in [github.com/christiaan839-beep/sovereign-v2](https://github.com/christiaan839-beep/sovereign-v2)

## License

MIT

## Links

- [Sovereign Matrix](https://sovereignmatrix.agency)
- [Agentic Commerce documentation](https://sovereignmatrix.agency/agentic-commerce)
- [Public reliability page](https://sovereignmatrix.agency/reliability)
- [HITL policy endpoint](https://sovereignmatrix.agency/api/health/hitl-policy)
