# VAOS 3.0 — Verifiable Agent Output Specification (Post-Quantum Dual-Sign)

| Field          | Value                                                          |
| -------------- | -------------------------------------------------------------- |
| Version        | 3.0                                                            |
| Supersedes     | VAOS 2.0 (Ed25519) — see `docs/specs/vaos-2.0.md`              |
| Status         | Draft (open for comment)                                       |
| Editor         | Sovereign Matrix — `spec@sovereignmatrix.agency`               |
| License        | CC0 1.0 (public domain)                                        |
| Reference impl | `@sovereign-matrix/verifiable-receipts` (Apache-2.0)           |
| Discussion     | https://github.com/christiaan839-beep/sovereign-v2/discussions |

> The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174).

---

## 1. Abstract

VAOS 3.0 promotes the signature primitive of VAOS 2.0 from
single-signature Ed25519 to **dual-signature Ed25519 + ML-DSA-65
(Dilithium3)** as standardized in
[NIST FIPS 204](https://csrc.nist.gov/pubs/fips/204/final).

Why: regulated-AI retention horizons routinely span 7–25 years
(clinical trial records, tax audits, insurance subrogation, pharma
ICSR retention under EU GVP Module VI). That horizon crosses the
projected timeline for a cryptographically-relevant quantum computer
(CRQC) capable of breaking Ed25519 via Shor's algorithm. A VAOS 2.0
receipt signed today MAY become forgeable in 2040.

VAOS 3.0 hedges that risk by signing every receipt with **both**
Ed25519 and ML-DSA-65. A verifier in 2040 — running against a CRQC-
hardened library — can confirm the ML-DSA-65 signature alone, even
if Ed25519 has fallen. A verifier in 2026 — running against today's
classical libraries — can confirm Ed25519 alone, and treat the
ML-DSA-65 signature as forward-secure ballast.

VAOS 3.0 is **fully wire-compatible** with VAOS 2.0 verifiers via
the version prefix system: a v3 verifier MUST accept v2 receipts;
a v2 verifier MAY reject v3 receipts or attempt fallback to the
Ed25519 half. See §6.

This document is in the public domain. Implementations are
encouraged.

---

## 2. Motivation

NIST's August 2024 standardization of FIPS 203 (ML-KEM) and FIPS 204
(ML-DSA) created the first interoperable, peer-reviewed post-quantum
signature family. The "harvest now, decrypt later" attack class —
where an adversary records signed records today and forges new ones
against the stored public key once a CRQC arrives — is unmitigable
for Ed25519-only receipts. ML-DSA-65 hedges it.

The dual-signature pattern (a classical signature paired with a
post-quantum signature) is the conservative migration strategy
recommended by NIST SP 1800-38 and adopted by IETF's hybrid
PKIX work. Dual-sign:

- preserves classical security against today's adversaries;
- adds post-quantum security against future adversaries;
- requires no key-management retirement schedule;
- lets verifiers upgrade asynchronously.

The cost is bytes (an ML-DSA-65 signature is 3293 bytes vs.
Ed25519's 64 bytes) and CPU (signing is ~30× slower; verification
~3× slower). For audit receipts — which are rare, small, and
sign-once / verify-many — the trade is overwhelmingly correct.

---

## 3. Terminology

VAOS 2.0 §3 carries forward. Additions:

- **PQ secret key** — issuer's ML-DSA-65 secret key, 4032 bytes.
- **PQ verification key** — issuer's ML-DSA-65 public key, 1952
  bytes. Published at
  `https://<issuer>/.well-known/sovereign-receipts/mldsa65.b64`.
- **Dual signature** — a string of the form
  `v3=<base64-ed25519>.<base64-mldsa65>` carrying both signatures
  concatenated with a literal `.` separator. The Ed25519 half is
  the same 64-byte signature that would be emitted under VAOS 2.0;
  the ML-DSA-65 half is the 3293-byte ML-DSA-65 signature output.

---

## 4. Receipt Structure

Receipt JSON shape is unchanged from VAOS 2.0 §4. Only the format
of `signature` is upgraded:

- VAOS 1.0: `v1=<base64-hmac>`
- VAOS 2.0: `v2=<base64-ed25519>`
- VAOS 3.0: `v3=<base64-ed25519>.<base64-mldsa65>`

A receipt MUST carry exactly one signature field with exactly one
version prefix.

---

## 5. Canonical Projection

The canonicalization algorithm of VAOS 1.0 §6 carries forward
unchanged. Both signatures in a VAOS 3.0 dual signature MUST be
computed over **the same** UTF-8 byte string produced by that
projection. Implementations MUST NOT recanonicalize the payload
between the two signing operations.

---

## 6. Signature

### 6.1 Generation

The issuer:

1. Computes the canonical projection per §5.
2. Signs the resulting UTF-8 byte string with their Ed25519 secret
   key per [RFC 8032 §5.1.6](https://www.rfc-editor.org/rfc/rfc8032#section-5.1.6).
3. Signs the **same** UTF-8 byte string with their ML-DSA-65 secret
   key per [FIPS 204 §6](https://csrc.nist.gov/pubs/fips/204/final).
4. Base64-encodes each signature with the standard alphabet
   (RFC 4648 §4).
5. Constructs the wire string
   `v3=<base64-ed25519>.<base64-mldsa65>`.
6. Sets the receipt's `signature` field to the resulting string.

### 6.2 Wire format

```
v3=<base64-of-64-byte-Ed25519-sig>.<base64-of-3293-byte-ML-DSA-65-sig>
```

A verifier MUST treat the literal `.` as the only valid separator
and MUST reject any wire string whose halves do not decode to the
expected algorithm output lengths.

### 6.3 Key publication

VAOS 2.0 §6.3 carries forward for the Ed25519 verification key.
Additionally, the ML-DSA-65 verification key MUST be published at:

```
https://<issuer-domain>/.well-known/sovereign-receipts/mldsa65.b64
```

The published key MUST be base64-encoded (raw 1952 bytes, standard
alphabet) and MUST be served with `Content-Type: text/plain;
charset=utf-8` and `Access-Control-Allow-Origin: *`.

---

## 7. Verification Procedure

Given a v3 receipt, the Ed25519 verification key, and the ML-DSA-65
verification key, a verifier:

1. Parses the version prefix.
   - `v1=` → fall back to VAOS 1.0 §8.
   - `v2=` → fall back to VAOS 2.0 §7.
   - `v3=` → continue.
   - Anything else → reject.
2. Splits the post-prefix string on the literal `.` separator.
   Expect exactly two halves; reject if not.
3. Base64-decodes each half. Reject if either fails to decode.
4. Recomputes the canonical projection of the receipt per §5.
5. Calls the host's Ed25519 verifier with the canonical bytes, the
   decoded Ed25519 signature, and the Ed25519 verification key.
6. Calls the host's ML-DSA-65 verifier with the canonical bytes,
   the decoded ML-DSA-65 signature, and the ML-DSA-65 verification
   key.
7. Returns a verdict object:

```ts
interface DualSigVerdict {
  ok: boolean; // true iff BOTH primitives returned true
  ed25519: boolean; // result of the Ed25519 check
  mldsa65: boolean; // result of the ML-DSA-65 check
}
```

### 7.1 Asymmetric verification (forward-compatibility)

A conforming verifier MUST report the per-primitive results even
when one half fails. This lets a 2040 auditor — running against a
CRQC-hardened library that ignores Ed25519 — accept the receipt on
the ML-DSA-65 half alone, while logging that the Ed25519 half no
longer holds.

Issuers SHOULD treat any receipt with `ed25519: false, mldsa65:
true` as evidence of a CRQC-class adversary and rotate keys
accordingly.

---

## 8. Visibility

VAOS 2.0 §8 carries forward. Additions:

The ML-DSA-65 verification key (1952 bytes) is, by construction,
public. Issuers MAY mirror it via CDN, IPFS, or any other content-
addressable system.

The ML-DSA-65 secret key MUST NOT be transmitted, logged, or
stored outside the issuer's signing infrastructure. Compromise
invalidates every v3 signature in retention under that key — but
**not** the v2 (Ed25519) half, which remains independently
verifiable under the Ed25519 key.

---

## 9. Threat Model

| Threat                                             | Mitigation                                                                                                                       |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --- | --------------------------- |
| Classical-adversary forgery (no CRQC)              | Ed25519 + ML-DSA-65 — defeating either requires breaking the underlying lattice or curve. Computationally infeasible.            |
| CRQC adversary forgery of stored receipts          | Ed25519 falls; ML-DSA-65 holds. Verifier reports `ed25519:false, mldsa65:true`; the receipt is still authentic under §7.1.       |
| Substitution of the ML-DSA-65 half only            | Both halves sign **the same** canonical bytes. Substituting one half breaks `ok=true && (ed25519                                 |     | mldsa65) === ok` invariant. |
| Algorithm-confusion attack (force v2 verification) | `v2=` and `v3=` are hard-branched in the verifier. A v2 verifier processing a v3 wire string MUST fail at the prefix check.      |
| Side-channel leakage from ML-DSA-65 signer         | Use a constant-time implementation. The reference `@noble/post-quantum` is audited and constant-time on hot paths.               |
| Quantum-period downgrade attack                    | An adversary that strips the ML-DSA-65 half and re-presents the receipt as v2 cannot do so without forging a fresh v2 signature. |
| Canonicalization drift                             | Both halves consume the same projected bytes from §5. Conforming implementations share one canonicalization function.            |

---

## 10. Versioning

VAOS 3.0 is the last specified version under the current signature-
prefix scheme. Future revisions (VAOS 4.0+) reserve the `v4=`
prefix for the next post-quantum signature family — anticipated
candidates include FN-DSA (Falcon) and SLH-DSA (SPHINCS+, FIPS 205).

A conforming v3 verifier MUST reject any wire prefix it does not
recognize. Forward-compatibility is **opt-in by major version**, not
implicit.

---

## 11. Test Vectors

### 11.1 Vector A — Ed25519 half

Use VAOS 2.0 Test Vector A (§11.1) unchanged. The Ed25519 half of a
v3 wire string is byte-equivalent to a v2 wire string.

### 11.2 Vector B — ML-DSA-65 half

Reference implementation `@noble/post-quantum` exposes
`ml_dsa65.sign(secretKey, message)` and `ml_dsa65.verify(publicKey,
message, signature)`. A conforming verifier MUST produce
`mldsa65: true` for any signature produced by this primitive over
the canonical projection bytes.

### 11.3 Vector C — verifier conformance

Run the reference implementation's `verifyDualSig()` helper against
both halves of a v3 receipt with both keys. A conforming verifier
MUST produce the same `DualSigVerdict` envelope as the reference
implementation across all 64 possible 2×2 cases (Ed25519 valid /
invalid × ML-DSA-65 valid / invalid).

---

## 12. Acknowledgements

VAOS 3.0 is informed by the design of:

- [NIST FIPS 204](https://csrc.nist.gov/pubs/fips/204/final) —
  ML-DSA standardization.
- [NIST SP 1800-38](https://www.nccoe.nist.gov/projects/migration-post-quantum-cryptography)
  — dual-signature migration playbook.
- The IETF [hybrid PKIX working group](https://datatracker.ietf.org/wg/lamps/about/)
  — composite signature schemes in X.509.
- [`@noble/post-quantum`](https://github.com/paulmillr/noble-post-quantum)
  — the audited ML-DSA-65 reference implementation used by Sovereign
  Matrix.

---

## 13. Contact

`spec@sovereignmatrix.agency` for editorial feedback.
`security@sovereignmatrix.agency` for security disclosures.
