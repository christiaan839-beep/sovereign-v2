# VAOS 2.0 — Verifiable Agent Output Specification (Ed25519)

| Field          | Value                                                          |
| -------------- | -------------------------------------------------------------- |
| Version        | 2.0                                                            |
| Supersedes     | VAOS 1.0 (HMAC-SHA256) — see `docs/specs/vaos-1.0.md`          |
| Status         | Draft (open for comment)                                       |
| Editor         | Sovereign Matrix — `spec@sovereignmatrix.agency`               |
| License        | CC0 1.0 (public domain)                                        |
| Reference impl | `@sovereign-matrix/verifiable-receipts` (Apache-2.0)           |
| Discussion     | https://github.com/christiaan839-beep/sovereign-v2/discussions |

> The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174).

---

## 1. Abstract

VAOS 2.0 promotes the receipt-signing primitive of VAOS 1.0 from
shared-secret HMAC-SHA256 to **public-key Ed25519 (Curve25519)** as
specified in [RFC 8032](https://www.rfc-editor.org/rfc/rfc8032).

Why: HMAC requires the verifier to hold the same secret the issuer
used to sign. That defeats independent third-party verification — a
regulator, customer, or counterparty would have to be in possession
of the issuer's signing key. Ed25519 splits the credential: the
issuer holds the secret key, the world holds the public key, and any
verifier can independently confirm a receipt without contacting the
issuer.

VAOS 2.0 is **fully wire-compatible** with VAOS 1.0 verifiers via
the wire-format prefix: VAOS 1.0 receipts carry `v1=<base64-hmac>`;
VAOS 2.0 receipts carry `v2=<base64-ed25519>`. A verifier that
implements both can fall back to v1 when the issuer has not published
a v2 key. See §6.

This document is in the public domain. Implementations are
encouraged.

---

## 2. Motivation

A 2026 regulated buyer asks: "if your AI made a decision that ends
up in front of a judge, what evidence can you hand the court that
the decision was defensible at the moment it was made?"

VAOS 1.0 already answers that question for parties who share a
secret with the issuer. VAOS 2.0 answers it for parties who do not:

- **Auditors** who must independently re-derive the math without
  trusting the issuer's infrastructure.
- **Counterparties** in a multi-party workflow (insurer ↔ broker ↔
  reinsurer) where a single shared secret is not appropriate.
- **Long-term retention** scenarios (7–25 year regulatory horizons)
  where the issuer's HMAC key may have rotated multiple times but
  the original Ed25519 public key remains on file.

---

## 3. Terminology

The vocabulary of VAOS 1.0 §3 carries forward unchanged. Additions:

- **Issuer key** — the issuer's Ed25519 secret key (32 bytes).
  Held only by the issuer's signing infrastructure.
- **Verification key** — the issuer's Ed25519 public key (32 bytes).
  Published openly — typically at
  `https://<issuer>/.well-known/sovereign-receipts/ed25519.pem`.
- **Wire signature** — a string of the form `v2=<base64>` where
  `<base64>` is the 64-byte Ed25519 signature output, base64-encoded
  with standard alphabet (no URL-safe substitution).

---

## 4. Receipt Structure

Receipt JSON shape is unchanged from VAOS 1.0 §4. The only field
whose semantics change is `signature`:

- VAOS 1.0: `signature` MUST be of the form `v1=<base64-hmac>`.
- VAOS 2.0: `signature` MUST be of the form `v2=<base64-ed25519>`.

A receipt MUST NOT carry both `v1=` and `v2=` simultaneously. To
publish a dual-signed receipt (for transition periods or post-
quantum hardening), see VAOS 3.0.

---

## 5. Canonical Projection

The canonicalization algorithm of VAOS 1.0 §6 (`sortKeysDeep` over
the receipt body, JSON-stringified without whitespace) carries
forward unchanged.

VAOS 2.0 verifiers MUST byte-stringify with the same projection. A
2.0 signature over a payload canonicalized under a different
algorithm is invalid. Conforming implementations SHOULD share the
canonicalization code path between v1 and v2 to avoid drift.

---

## 6. Signature

### 6.1 Generation

The issuer:

1. Computes the canonical projection per §5.
2. Signs the resulting UTF-8 byte string with their Ed25519 secret
   key per [RFC 8032 §5.1.6](https://www.rfc-editor.org/rfc/rfc8032#section-5.1.6).
3. Base64-encodes the 64-byte signature with the standard alphabet
   (RFC 4648 §4).
4. Prefixes the encoded signature with `v2=`.
5. Sets the receipt's `signature` field to the resulting string.

### 6.2 Wire format

```
v2=<base64-of-64-byte-Ed25519-signature>
```

The `v2=` prefix is REQUIRED. A verifier MUST reject any receipt
whose `signature` field does not begin with a recognized version
prefix.

### 6.3 Key publication

Issuers MUST publish their Ed25519 verification key at a stable
URL. The RECOMMENDED location is:

```
https://<issuer-domain>/.well-known/sovereign-receipts/ed25519.pem
```

The published key MUST be in PEM format (RFC 7468) and MUST be
served with `Content-Type: application/x-pem-file` and
`Access-Control-Allow-Origin: *`.

Issuers SHOULD set a short cache TTL (≤ 300 seconds) so emergency
key rotations propagate within one deploy cycle.

---

## 7. Verification Procedure

Given a receipt and the issuer's verification key, a verifier:

1. Parses `signature`. If the prefix is `v1=`, fall back to VAOS 1.0
   §8. If the prefix is `v2=`, continue. Any other prefix → reject.
2. Strips the `v2=` prefix and base64-decodes the remainder.
3. Recomputes the canonical projection of the receipt per §5.
4. Calls the host's Ed25519 verification primitive
   (e.g. `crypto.verify(null, message, publicKey, signature)` in
   Node.js, or `ed25519.verify` in any other library) with the
   canonical bytes, the decoded signature, and the verification key.
5. Returns true iff the primitive returns true.

A verifier MUST NOT execute side-effects (DB writes, network calls,
log lines containing the receipt body) before the signature check
returns true. Side-effects on an unverified receipt are how
upstream-injection attacks succeed.

### 7.1 HTTP API (informational)

Issuers MAY expose a verification endpoint for clients without
Ed25519 libraries:

```
GET /api/verify?receiptId=<id>
→ 200 { "valid": true | false, "scheme": "ed25519" | "hmac-sha256" }
```

This endpoint is a convenience. It is NOT a substitute for
independent client-side verification — the only verifier whose
trust assumption is "the math holds" is one that runs in the
auditor's own process against the published Ed25519 key.

---

## 8. Visibility

The visibility rules of VAOS 1.0 §9 carry forward unchanged.

VAOS 2.0 adds one explicit rule: the verification key (public Ed25519
bytes) MAY be cached, mirrored, or pinned by any verifier without
restriction. It is, by construction, a public key.

The secret key MUST NOT be transmitted, logged, or stored outside
the issuer's signing infrastructure. Compromise of the secret key
invalidates every receipt signed under that key. Issuers SHOULD
publish a key-rotation manifest at
`https://<issuer>/.well-known/sovereign-receipts/keys.json` listing
the active and retired public keys with their `not_before` /
`not_after` timestamps.

---

## 9. Threat Model

Ed25519 inherits the threat model of [RFC 8032 §8](https://www.rfc-editor.org/rfc/rfc8032#section-8).
For VAOS 2.0 specifically:

| Threat                              | Mitigation                                                                                                              |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Forged signature without secret key | Cryptographically infeasible (≥ 128-bit security level against classical adversaries).                                  |
| Issuer secret-key exfiltration      | Out of scope — store the secret key in a KMS / HSM and rotate it. The VAOS-2.0 layer signs whatever the host hands it.  |
| Cross-protocol confusion (v1 ↔ v2)  | The `v1=` / `v2=` prefix MUST be a hard branch in the verifier. Implementations MUST NOT attempt fallback verification. |
| Quantum cryptanalysis (CRQC)        | Ed25519 is broken under a sufficiently large quantum computer. Migrate to VAOS 3.0 (dual-sign with ML-DSA-65) before    |
|                                     | retention horizons cross the projected quantum-adversary timeline. See §10.                                             |
| Canonicalization drift              | Implementations MUST share the projection code path with VAOS 1.0. The reference impl in                                |
|                                     | `@sovereign-matrix/verifiable-receipts` is the conformance test.                                                        |

---

## 10. Versioning

VAOS uses a major-version-prefix scheme on the wire. Major versions
are not backwards-compatible signatures (a v1 signature does not
verify under v2, and vice versa), but a single verifier
implementation MAY accept multiple major versions concurrently.

Future versions:

- **VAOS 3.0** — Ed25519 + ML-DSA-65 dual-signing for post-quantum
  forward security. See `docs/specs/vaos-3.0.md`.
- **VAOS 4.0+** — reserved for a future signature primitive when
  ML-DSA-65 itself is deprecated. The wire prefix `v4=` is
  reserved.

---

## 11. Test Vectors

### 11.1 Vector A — minimal Receipt

```json
{
  "v": 1,
  "id": "rcpt_test_001",
  "agentName": "echo",
  "modelUsed": "nim-nemotron",
  "input": { "prompt": "hello" },
  "output": { "text": "hello" },
  "safetyResult": { "passed": true, "score": 1.0 },
  "durationMs": 42,
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

Canonical projection (UTF-8 bytes):

```
{"v":1,"id":"rcpt_test_001","agentName":"echo","modelUsed":"nim-nemotron","input":{"prompt":"hello"},"output":{"text":"hello"},"safetyResult":{"passed":true,"score":1},"durationMs":42,"createdAt":"2026-01-01T00:00:00.000Z"}
```

(Reference implementations: see the `signRun()` and
`canonicalizeRun()` helpers in `src/lib/agent-runs.ts` of the
Sovereign Matrix repository, and the `verifyManifest()` helper in
`@sovereign-matrix/verifiable-receipts`.)

### 11.2 Vector B — tampered payload rejection

Take Vector A's canonical projection, mutate any byte, and rerun
`crypto.verify`. A conforming verifier MUST return `false`. There
is no "close enough" — Ed25519 verification is all-or-nothing.

---

## 12. Acknowledgements

VAOS 2.0 is informed by the design of:

- [RFC 8032](https://www.rfc-editor.org/rfc/rfc8032) — Edwards-curve
  Digital Signature Algorithm.
- [Sigstore](https://www.sigstore.dev/) — public-key transparency
  for software artifacts (analogous role for source code).
- [Signal Protocol](https://signal.org/docs/) — Ed25519 in a
  production setting.

---

## 13. Contact

`spec@sovereignmatrix.agency` for editorial feedback.
`security@sovereignmatrix.agency` for security disclosures.
