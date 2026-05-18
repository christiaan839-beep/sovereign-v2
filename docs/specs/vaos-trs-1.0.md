# VAOS-TRS 1.0 — Threshold Receipt Signatures

**Status:** Frozen with `@sovereign-matrix/verifiable-receipts` v0.3.x and forward.
**License:** Apache 2.0 (this specification + the reference implementation).
**Contact:** spec@sovereignmatrix.agency

VAOS-TRS is a wire-format primitive for **m-of-n threshold cosigning of
receipts**. A receipt under TRS is canonical only when at least `m` of
`n` designated issuers have independently signed the same canonical
bytes. The trust model flips from "trust this one issuer" to "trust
the m-quorum of the n-issuer registry" — no single issuer can fraud
the receipt because at least `m-1` independent parties would need to
collude.

This document is the **frozen wire spec**. Any deviation breaks
interoperability and is forbidden in v1.x.

---

## 1. Why this exists

Most receipt-layer products today have a single trust root: the issuer.
If the issuer's signing key is compromised, every receipt the issuer
ever produced can be forged retroactively.

The TLS / TUF / Sigstore / Certificate-Transparency ecosystems all
solved this through cosigning + transparency federation. TRS brings
that same primitive to the receipt layer:

- **Receipt-layer analogue of Bitcoin multisig** — m-of-n on the
  signature side of a verifiable claim.
- **Receipt-layer analogue of TLS notary federation** (Convergence,
  Perspectives) — multiple independent witnesses attest to the same
  observation.
- **Receipt-layer analogue of RFC 9162 §4 cross-witness** — the same
  signed object commits multiple parties.

Even Mastercard Agent Pay and Visa Agentic Commerce don't ship m-of-n
cosigning at the receipt layer. We do, in Apache 2.0.

---

## 2. Wire format

The TRS envelope is layered on top of the existing VAOS 2.0/3.0
canonical projection. The bytes each individual issuer signs are
identical to what they would sign in pure VAOS 2.0 — the envelope
simply aggregates their signatures into a single document.

```json
{
  "scheme": "trs1",
  "canonical": "<exact UTF-8 bytes each cosigner signs>",
  "contentHash": "<hex sha256(canonical)>",
  "threshold": { "m": 2, "n": 3 },
  "authorizedIssuers": ["issuer-eu", "issuer-us", "issuer-apac"],
  "cosigners": [
    {
      "issuerId": "issuer-eu",
      "signature": "v2=base64encodedsig==",
      "publicKeyUrl": "https://eu.example/.well-known/.../ed25519.pem"
    },
    {
      "issuerId": "issuer-us",
      "signature": "v2=base64encodedsig==",
      "publicKeyUrl": "https://us.example/.well-known/.../ed25519.pem"
    }
  ],
  "assembledAt": "2026-05-18T15:00:00Z"
}
```

### 2.1 Required fields

| Field               | Type     | Required | Description                                                                   |
| ------------------- | -------- | -------- | ----------------------------------------------------------------------------- |
| `scheme`            | string   | ✅       | MUST be exactly `"trs1"`.                                                     |
| `canonical`         | string   | ✅       | The UTF-8 bytes each cosigner signs (identical to VAOS 2.0 canonical).        |
| `contentHash`       | string   | ✅       | Hex `sha256(canonical)` — cross-check primitive.                              |
| `threshold.m`       | integer  | ✅       | Minimum valid signatures required, ≥ 1.                                       |
| `threshold.n`       | integer  | ✅       | Total designated issuers, ≥ m.                                                |
| `authorizedIssuers` | string[] | ✅       | Exactly `n` distinct issuer ids. Order is canonical (lexicographic).          |
| `cosigners`         | object[] | ✅       | Zero or more contributions. Each MUST have a unique `issuerId` + `signature`. |
| `assembledAt`       | string   | ✅       | ISO 8601 of when this envelope was assembled.                                 |

### 2.2 Optional fields on each cosigner

| Field          | Type   | Description                                            |
| -------------- | ------ | ------------------------------------------------------ |
| `publicKeyUrl` | string | Verifier hint: HTTPS URL where the issuer's PEM lives. |

---

## 3. Verification algorithm

```
function verifyThresholdAttestation(attestation, opts) {
  if attestation.scheme != "trs1": return unknown_scheme
  if sha256(attestation.canonical) != attestation.contentHash:
    return content_hash_mismatch

  authorized = set(attestation.authorizedIssuers)
  seen       = set()
  verifying  = []
  rejected   = []

  for cosigner in attestation.cosigners:
    if cosigner.issuerId not in authorized:
      rejected += {issuerId, "not in authorizedIssuers"}
      continue
    if cosigner.issuerId in seen:
      rejected += {issuerId, "duplicate"}
      continue
    seen += cosigner.issuerId
    ok = opts.verifyIssuerSignature(
      attestation.canonical,
      cosigner.signature,
      cosigner.issuerId,
    )
    if not ok:
      rejected += {issuerId, "did not verify"}
      continue
    verifying += cosigner.issuerId

  if len(verifying) >= attestation.threshold.m:
    return OK
  return insufficient_valid_signatures
}
```

Order of operations is critical:

1. **Scheme tag check first.** Reject unknown schemes immediately.
2. **contentHash before signature loop.** A tampered canonical with
   the old hash is caught here without burning crypto cycles.
3. **Authorized-set check before signature verify.** A rogue
   cosigner with a valid signature under a key NOT in the
   authorizedIssuers list is rejected without trusting the
   signature.
4. **Duplicate detection.** Same issuer can't double-count.
5. **Per-cosigner signature verification** via caller-supplied callback.
6. **Count check** at the end: ≥ m valid, authorized, unique → OK.

---

## 4. Threat model

In scope:

- A compromised single issuer signing a forged canonical → blocked
  by the m-of-n requirement (would need m-1 collaborators).
- A rogue cosigner with no key relationship to the issuer registry →
  rejected at the authorizedIssuers check.
- A man-in-the-middle that strips legitimate cosigner signatures →
  fails the threshold count.
- A tampered envelope where the canonical changed but
  contentHash didn't → caught by contentHash mismatch.

Out of scope:

- Compromise of `m` distinct issuer keys simultaneously. This is the
  cost of choosing a low `m`; operators MUST pick `m` ≥ `ceil(n/2 + 1)`
  for Byzantine-fault-tolerance against half-the-issuers compromise.
- The verifier's own key resolution being compromised. (Mitigated by
  fetching pubkey URLs over HTTPS + pinning to the issuer registry
  at `/.well-known/sovereign-receipts/issuers.json`.)

---

## 5. Reference implementation

Apache 2.0 — `packages/verifiable-receipts/src/threshold.ts` and tests
at `packages/verifiable-receipts/tests/threshold.test.ts` (17 tests
covering happy paths + every adversarial rejection path enumerated
above).

Python + Go verifier-side ports land in their respective SDKs in
v0.2 once the wire format stabilizes in production.

---

## 6. Composition with VAOS 2.0 and VAOS 3.0

A TRS cosigner signature is byte-identical to a VAOS 2.0 (`v2=`) or
VAOS 3.0 (`v3=`) signature — same Ed25519 (or Ed25519 + ML-DSA-65 dual)
primitive over the same canonical bytes. This means:

- An issuer that already runs VAOS 2.0 can participate in TRS with
  no key changes.
- A receipt can be downgraded from TRS → VAOS 2.0 by picking any
  single verifying cosigner — useful for legacy verifiers.
- The threshold envelope can also be transparency-logged: log the
  full `ThresholdAttestation` JSON as a leaf in the RFC 9162 tree.

---

## 7. Frozen wire format

Any change to §2 (wire shape, required fields) constitutes a new
major version. v1.1+ additions MUST be backwards-compatible
(additive optional fields only).

To extend with a new signature algorithm beyond Ed25519, introduce
a new scheme tag `trs2` rather than modifying `trs1`.

---

## 8. License

Apache 2.0 © Sovereign Matrix.

This specification is **frozen with this package version**. A wire
envelope minted today verifies under any future verifier that retains
v1 support. The math is the contract.
