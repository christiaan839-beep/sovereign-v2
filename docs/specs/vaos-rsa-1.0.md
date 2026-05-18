# VAOS-RSA 1.0 — Receipt Streaming Attestation

**Status:** Frozen with `@sovereign-matrix/verifiable-receipts` v0.3.x and forward.
**License:** Apache 2.0 (this specification + the reference implementation).
**Contact:** spec@sovereignmatrix.agency

VAOS-RSA defines a **Merkle-rooted commitment over the full chunk
sequence of an LLM stream**, enabling auditors to prove "chunk N
at position k had this exact content" against a single signed
envelope.

This document is the **frozen wire spec**. Any deviation breaks
interoperability and is forbidden in v1.x.

---

## 1. Why this exists

Most agent platforms today sign only the **final** output of an LLM
stream. That misses the tampering surface that matters most: an
attacker (or buggy proxy, or malicious middlebox) can inject, drop,
or modify tokens mid-stream and the final-output signature still
verifies, because it commits only to the concatenated bytes the
issuer saw last.

VAOS-RSA fixes this by signing the **Merkle root** of all chunk
hashes alongside the final concatenated output:

```
chunk_0 ─┐
chunk_1 ─┤
chunk_2 ─┼── Merkle tree (RFC 9162 leaf+inner hashes) ── merkleRoot ─┐
chunk_3 ─┤                                                            ├─ signed
chunk_4 ─┘                                                            │
                                                          finalOutput ┘
```

An auditor can then:

- Prove **chunk N at position k** was part of the original stream
  (inclusion proof against the signed Merkle root).
- Prove the stream had exactly N chunks (the count is signed).
- Prove the concatenated final output matches the chunk sequence
  (each chunk's content is committed separately via Merkle leaf).

This composes with the existing transparency log: the same
RFC 9162 leaf/inner hash primitives already in
`@sovereign-matrix/verifiable-receipts/transparency` apply.

---

## 2. Wire format

The streaming envelope:

```json
{
  "scheme": "rsa1",
  "streamId": "stream_01HXXXXXXX",
  "totalChunks": 42,
  "merkleRoot": "abc123def456...",
  "finalOutput": "Hello, world!",
  "finalOutputHash": "deadbeef...",
  "finishedAt": "2026-05-18T15:00:00Z"
}
```

The issuer signs `canonicalizeStreamAttestation(envelope)` — see §3 —
with their existing VAOS 2.0 Ed25519 (or VAOS 3.0 ML-DSA dual) key.
**No new signing primitive.**

### 2.1 Required fields

| Field             | Type    | Required | Description                                                         |
| ----------------- | ------- | -------- | ------------------------------------------------------------------- |
| `scheme`          | string  | ✅       | MUST be exactly `"rsa1"`.                                           |
| `streamId`        | string  | ✅       | Stable id for the stream — typically `runId + ":" + agentSlug`.     |
| `totalChunks`     | integer | ✅       | Number of chunks emitted, ≥ 1.                                      |
| `merkleRoot`      | string  | ✅       | Hex-encoded SHA-256 of the Merkle tree root over chunk leaf-hashes. |
| `finalOutput`     | string  | ✅       | Concatenated chunk content.                                         |
| `finalOutputHash` | string  | ✅       | Hex `sha256(finalOutput)` — cross-check primitive.                  |
| `finishedAt`      | string  | ✅       | ISO 8601 instant of the last emitted chunk.                         |

---

## 3. Canonical projection

The issuer signs the UTF-8 bytes of:

```js
JSON.stringify({
  finalOutput,
  finalOutputHash,
  finishedAt,
  merkleRoot,
  scheme,
  streamId,
  totalChunks,
});
```

**Key order is fixed alphabetically** for v1. v2 (when shipped)
MUST switch to full RFC 8785 (JSON Canonicalization Scheme); v1
carries no nested objects so simple alphabetical sort suffices.

Verifiers MUST tolerate additive fields on the envelope per
Postel's law, but MUST NOT use them in security-critical
decisions.

---

## 4. Merkle tree construction

Identical to RFC 9162 / RFC 6962:

```
leafHash(chunk_bytes)   = SHA-256(0x00 || chunk_bytes)
innerHash(left, right)  = SHA-256(0x01 || left || right)
```

For each emitted chunk in strict index order (0, 1, 2, …):

1. Compute `leaf_i = leafHash(chunk_i.content)`.
2. Append `leaf_i` to the ordered leaf list.

When the stream finalizes:

3. Compute `merkleRoot = treeRoot(leaves)` per RFC 6962 §2.1 MTH.
4. Compute `finalOutput = concat(chunk_i.content for i in 0..N)`.
5. Compute `finalOutputHash = SHA-256(finalOutput)`.
6. Assemble the envelope (§2) and sign the canonical projection (§3).

---

## 5. Inclusion proof verification

Given a finalized + signed envelope, an auditor verifies that
"chunk N at index k had content X" by:

1. Compute `leaf = leafHash(X)`.
2. Walk the RFC 9162 audit-path verification algorithm with:
   - `leafHashHex = leaf`
   - `idx = k`
   - `treeSize = envelope.totalChunks`
   - `auditPath = <provided sibling hashes>`
   - `rootHashHex = envelope.merkleRoot`

Verification succeeds iff the walked-up hash equals
`envelope.merkleRoot`.

The audit path is provided out-of-band — typically by the issuer
serving `/api/streams/:streamId/chunks/:idx/proof` or by the
auditor re-deriving the full tree from chunk archives.

---

## 6. Threat model

In scope:

- An attacker injecting, dropping, or modifying tokens mid-stream
  → caught because the chunk leaf hashes would diverge, the Merkle
  root would diverge, the signature would fail.
- A tampered envelope where `finalOutputHash` and `finalOutput`
  drift → caught by `verifyFinalOutputHash()`.
- A re-ordering of chunks → caught because the Merkle tree is
  position-dependent (index-order is part of the leaf path).

Out of scope:

- The issuer maliciously omitting a chunk before the Merkle is
  built. (Mitigated by composing with the transparency log: every
  chunk hash MUST be transparency-logged as well, so an external
  observer can detect omitted chunks by comparing the log against
  the published envelope.)
- Compromise of the issuer's signing key — not a streaming-specific
  risk; addressed by VAOS-TRS threshold cosigning.

---

## 7. Reference implementation

Apache 2.0:

- `packages/verifiable-receipts/src/stream-attestation.ts` — builder,
  finalizer, inclusion-proof builder, canonical projection,
  verifier helpers.
- `packages/verifiable-receipts/tests/stream-attestation.test.ts` —
  18 tests covering: builder invariants (empty streamId, empty
  finalize, out-of-order chunks); envelope shape; Merkle root
  determinism + order-sensitivity; inclusion proof for every
  chunk in single-chunk + 4-chunk streams; tampered-chunk
  rejection; wrong-index rejection; lexicographic canonical
  ordering; byte-identical canonicalization; finalOutputHash
  defense.

---

## 8. Composition with other VAOS primitives

| Primitive        | Role                                                                                          |
| ---------------- | --------------------------------------------------------------------------------------------- |
| VAOS 2.0         | Signs the canonical projection of the streaming envelope (`v2=`).                             |
| VAOS 3.0         | Same as 2.0 plus ML-DSA-65 dual-signature (`v3=`).                                            |
| VAOS-TRS 1.0     | Threshold-cosigns the streaming envelope. m-of-n issuers each sign the canonical projection.  |
| Transparency Log | Same RFC 9162 primitives reused. Stream chunks can also be transparency-logged independently. |

---

## 9. Frozen wire format

Any change to §2 (wire shape, required fields) constitutes a new
major version. v1.1+ additions MUST be backwards-compatible
(additive optional fields only).

To extend with a different leaf-hashing algorithm, introduce
a new scheme tag `rsa2` rather than modifying `rsa1`.

---

## 10. License

Apache 2.0 © Sovereign Matrix.

This specification is **frozen with this package version**. A wire
envelope minted today verifies under any future verifier that
retains v1 support. The math is the contract.
