# VAPT 1.0 — Verifiable Agentic Payment Token

**Status:** Frozen with `@sovereign-matrix/verifiable-receipts` v0.2.x and forward.
**License:** Apache 2.0 (this specification + the reference implementation).
**Contact:** spec@sovereignmatrix.agency

VAPT is a wire-format primitive for **transaction-scoped tokens minted
by autonomous AI agents under verified human authority**. It is the
open-source analogue of Mastercard Agent Pay and Visa Agentic Commerce
— same security model, no vendor lock-in.

The token cryptographically binds:

1. A verified human user (`userId`)
2. A specific autonomous agent (`agentId`)
3. A bounded transaction envelope (`maxAmount`, `currency`, `merchantAllowlist`)
4. A bounded validity window (`issuedAt`, `expiresAt` — max 1 hour)

A merchant accepting a VAPT settles against it without ever seeing the
user's underlying payment credentials. The transaction layer (Stripe,
Adyen, PayPal, UPI) accepts a verified VAPT as evidence of authorized
intent, then issues its own settlement.

This document is the **frozen wire spec**. Any deviation breaks
interoperability and is forbidden in v1.x.

---

## 1. Why this exists

Gemini's 2026 "Agentic Transition" research correctly identifies
identity attribution as the primary security failure of the early
agentic era. A naive deployment hands an agent the user's full Stripe
key or bank API token — single compromised agent = total user loss.

The fix is a token that:

- carries **only the authority the agent actually needs** (scope to
  one or a few merchants, amount, currency, expiry),
- is **cryptographically signed by the user** (or the user's delegate
  keypair under explicit pre-authorization),
- can be **independently verified by the merchant** without consulting
  the issuing platform,
- is **single-use by default** (replay protection at the merchant +
  settlement layer).

VAPT defines this primitive in the public domain so every regulated-AI
vendor can adopt it without licensing fees.

---

## 2. Wire format

```
vapt1.<base64url(canonical_json)>.<base64url(ed25519_signature)>
```

- Prefix MUST be exactly `vapt1.` (lowercase).
- Two `.` separators divide the prefix, payload, and signature sections.
- Payload section is base64url-encoded (RFC 4648 §5, no padding) UTF-8
  bytes of the canonical JSON.
- Signature section is base64url-encoded Ed25519 signature bytes (RFC 8032) over the canonical UTF-8 bytes.

A verifier MUST reject any token that doesn't match this shape exactly.

### 2.1 Canonical JSON

The payload is a JSON object with **lexicographically sorted keys**.
This canonicalization is sufficient because v1 carries no nested
objects whose key order would matter. v2 (when shipped) MUST adopt
full RFC 8785 (JSON Canonicalization Scheme).

### 2.2 Required fields

| Field       | Type    | Required | Description                                                            |
| ----------- | ------- | -------- | ---------------------------------------------------------------------- |
| `scheme`    | string  | ✅       | MUST be exactly `"vapt1"`.                                             |
| `tokenId`   | string  | ✅       | Stable unique id (UUID recommended).                                   |
| `userId`    | string  | ✅       | Opaque user identifier the issuer uses to identify the human.          |
| `agentId`   | string  | ✅       | Opaque agent identifier — agent slug + run id is typical.              |
| `maxAmount` | number  | ✅       | Maximum spend in the smallest currency unit (e.g. cents).              |
| `currency`  | string  | ✅       | ISO 4217 three-letter code (USD, EUR, ZAR, JPY, …).                    |
| `issuedAt`  | string  | ✅       | ISO 8601 instant the token was minted.                                 |
| `expiresAt` | string  | ✅       | ISO 8601 instant the token stops being valid. Max 1h after `issuedAt`. |
| `singleUse` | boolean | ✅       | Hint to settlement layer that the token must not be reused.            |

### 2.3 Optional fields

| Field               | Type       | Description                                                                                |
| ------------------- | ---------- | ------------------------------------------------------------------------------------------ |
| `merchantAllowlist` | `string[]` | List of accepted merchant ids. Empty array = no merchants accepted. Absent = any merchant. |
| `purpose`           | string     | Free-form human-readable description for the audit trail.                                  |

Verifiers MUST tolerate additional fields per Postel's law for forward
compatibility, but MUST NOT use them in security-critical decisions.

---

## 3. Verification algorithm

A verifier accepting a VAPT against a proposed settlement transaction
MUST run ALL of these checks. ANY failure means the token is invalid.

```
function verifyVapt(token, opts) {
  parsed = parseVapt(token)
  if !parsed: return malformed
  if !verifySignature(parsed.canonical, parsed.signature, opts.publicKeyMaterial):
    return invalid_signature
  now = opts.now
  if now < parseISO(parsed.payload.issuedAt):
    return not_yet_valid
  if now > parseISO(parsed.payload.expiresAt):
    return expired
  if opts.proposedAmount <= 0:
    return invalid_amount
  if opts.proposedAmount > parsed.payload.maxAmount:
    return amount_exceeds_ceiling
  if opts.proposedCurrency != parsed.payload.currency:
    return currency_mismatch
  if parsed.payload.merchantAllowlist is array:
    if length(merchantAllowlist) == 0:
      return no_merchants_accepted
    if opts.proposedMerchantId not in merchantAllowlist:
      return merchant_not_allowed
  return OK
}
```

Order of operations matters: **signature verification MUST be first**.
A verifier that checks claims before signature gives an attacker a
forgeable oracle for which fields would have passed.

### 3.1 Replay protection

The verifier emits `vaptHash(token)` = SHA-256 of the canonical bytes.
The settlement layer records this hash against the executed transaction.
A second presentation of the same token (regardless of `singleUse`
flag) MUST be rejected by checking the recorded hash set.

---

## 4. Security properties

| Property                             | Mechanism                                                               |
| ------------------------------------ | ----------------------------------------------------------------------- |
| User authority bound to agent action | Ed25519 signature by user (or delegated) keypair                        |
| Replay protection                    | `tokenId` + canonical-bytes SHA-256 recorded by settlement              |
| Bounded blast radius                 | `maxAmount` + `currency` + optional `merchantAllowlist`                 |
| Bounded time                         | `expiresAt` capped at 1h from `issuedAt`                                |
| Tamper detection                     | Signature is over canonical bytes — any modification fails verification |
| Single-merchant misuse blocked       | `merchantAllowlist` checked at verification                             |

Properties NOT provided in v1:

- **Threshold approval** — adding m-of-n co-signers is a v2 candidate.
- **Per-spend tracking** — verifiers know `maxAmount`, not historical spend. The settlement layer aggregates.
- **Post-quantum** — Ed25519 only. ML-DSA-65 dual-sign extension lands in v1.1 once a pure-Python ML-DSA verifier ships.

---

## 5. Threat model

In scope:

- A compromised agent runtime attempting to settle a higher amount than
  the user authorized.
- A compromised merchant attempting to replay a captured token.
- A network adversary attempting to forge a token under a different
  user's identity.
- A malicious agent attempting to redirect settlement to an
  unauthorized merchant.

Out of scope:

- Compromise of the user's private signing key. (Mitigated by short
  lifetimes + low `maxAmount` caps + HSM key custody at issuance.)
- Settlement-layer fraud after a valid VAPT is presented. (That's
  the responsibility of Stripe / Adyen / PayPal etc.)

---

## 6. Reference implementation

Apache 2.0, lives at:

- `packages/verifiable-receipts/src/vapt.ts` (TypeScript)
- `packages/verifiable-receipts/tests/vapt.test.ts` (22 tests)

Python verifier-side will land in
`packages/verifiable-receipts-py/sovereign_matrix/verifiable_receipts/vapt.py`
in v0.2 of the Python SDK.

---

## 7. Frozen wire format

Any change to §2 (wire shape, required fields) constitutes a new major
version. v1.1+ additions MUST be backwards-compatible (additive
optional fields only).

To extend with a new signature algorithm (e.g. ML-DSA-65 dual-sign),
introduce a new scheme tag `vapt2` rather than modifying `vapt1`.

---

## 8. License

Apache 2.0 © Sovereign Matrix.

This specification is **frozen with this package version**. A wire token
minted today verifies under any future verifier that retains v1 support.
The math is the contract.
