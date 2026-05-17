# AI Receipt Transparency Log — design + threat model

| Field       | Value                                                                       |
| ----------- | --------------------------------------------------------------------------- |
| Version     | 0.1                                                                         |
| Status      | Draft — primitives shipped in `@sovereign-matrix/verifiable-receipts@0.1.x` |
| Editor      | Sovereign Matrix — `spec@sovereignmatrix.agency`                            |
| License     | CC0 1.0 (public domain)                                                     |
| Inspired by | RFC 6962 / RFC 9162 (Certificate Transparency)                              |

> The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHOULD**, **MAY**, **OPTIONAL** are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) / [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174).

---

## 1. Problem

Today a regulator who wants to audit an AI vendor's decisions must
trust the vendor's logs are intact. The vendor can — in principle —
rewrite history, suppress a problematic decision, or fork its own
record between what it shows the regulator and what it shows the
courts.

VAOS 2.0 / 3.0 (`docs/specs/vaos-2.0.md`, `docs/specs/vaos-3.0.md`)
solve the per-receipt integrity question: the math says "this
receipt was signed by this issuer over this canonical projection".
But VAOS does not say "this receipt was published". A vendor that
signs a receipt and then quietly destroys it is still in possession
of mathematically valid bytes — they just don't appear in any audit.

Certificate Transparency solved the analogous problem for SSL/TLS
in 2013: every certificate authority must submit issued certificates
to one or more public append-only Merkle logs, and browsers (Chrome
since 2018) refuse certificates not embedded in such a log. The
public log + independent witnesses make CA misissuance detectable
even when the CA itself is compromised.

The AI Receipt Transparency Log applies the same architecture to AI
agent receipts.

## 2. Roles

| Role         | Responsibility                                                          |
| ------------ | ----------------------------------------------------------------------- |
| **Issuer**   | Signs receipts (VAOS 2.0 / 3.0). Appends every receipt hash to the log. |
| **Log**      | Stores leaves append-only, computes the Merkle root, publishes STHs.    |
| **Witness**  | Independently signs the log's STHs at intervals. Counts forks.          |
| **Monitor**  | Walks the log, watches for unexpected receipts (regulator role).        |
| **Verifier** | Given a receipt and an STH, checks inclusion proof + signatures.        |

An ecosystem with N independent witnesses and an honest monitor
catches any vendor-controlled fork — the misbehaving log either has
no witness signatures (visibly suspicious) or has fork-divergent
STHs the monitor will detect.

## 3. Wire formats

### 3.1 Leaf hash

Every receipt is appended to the log as a single leaf. The leaf
data is the canonical projection of the receipt (per VAOS 2.0 §5).
The leaf hash is RFC 6962 §2.1:

```
leafHash(data) = SHA-256(0x00 || data)
```

The `0x00` byte is a domain separator; without it an attacker could
hand a verifier an internal-node hash and claim it's a leaf.

### 3.2 Internal node hash

```
innerHash(left, right) = SHA-256(0x01 || left || right)
```

The `0x01` domain separator pairs with `0x00` for second-preimage
resistance.

### 3.3 Signed Tree Head (STH)

The log publishes an STH at append-time and periodically thereafter:

```jsonc
{
  "v": 1,
  "logId": "string — stable identifier for this log",
  "treeSize": <number — count of leaves currently in the log>,
  "rootHash": "<hex — RFC 6962 Merkle root over all leaves>",
  "timestamp": "<ISO 8601 — when this STH was emitted>",
  "signature": "v2=<base64-Ed25519>"
    // or "v3=<base64-Ed25519>.<base64-ML-DSA-65>"
}
```

The canonical projection for signing (mirrors VAOS 2.0 §5):

```
canonicalize(sth) = JSON.stringify({
  logId: sth.logId,
  rootHash: sth.rootHash,
  timestamp: sth.timestamp,
  treeSize: sth.treeSize,
  v: sth.v,
})
```

(`signature` is omitted before signing. Keys sorted lexicographically.)

The Ed25519 / ML-DSA-65 verification keys are published at the
issuer's `.well-known/sovereign-receipts/` endpoint per VAOS 2.0 §6.3
and VAOS 3.0 §6.3.

### 3.4 Inclusion proof

Given a receipt's leaf hash `h`, its index `i` in the log, and an
STH committing to size `n` and root `r`, the inclusion proof is the
ordered list of sibling hashes needed to fold `h` up to `r`.

Verifier algorithm: standard CT decomposition into an "inner"
segment that walks the bits of `i` and a "border" segment of
left-siblings up the right edge. See `verifyInclusionProof()` in
the reference implementation.

### 3.5 Consistency proof

Given two STHs from the same `logId` at sizes `M` (old) and `N`
(new, with `M ≤ N`), a consistency proof is a list of hashes that
folds to both `oldRoot` and `newRoot`. Any successful verification
proves the log only appended between the two STHs — it could not
have rewritten or removed any leaf.

Verifier algorithm: recursive walk that mirrors RFC 6962 §2.1.2's
subproof structure. See `verifyConsistencyProof()` in the reference
implementation.

## 4. Append protocol

1. Issuer computes the canonical projection of a receipt.
2. Issuer computes `leafHash(canonical)`.
3. Issuer POSTs `leafHash` to the log's append endpoint (TBD —
   suggested: `POST /log/<logId>/leaves`).
4. The log appends the leaf and emits a new STH covering the
   updated tree.
5. The log returns to the issuer: `{ index, newSth }`.
6. The issuer SHOULD store `{ index, newSth }` alongside the receipt
   so any subsequent verifier can construct the inclusion proof.

The append is **non-reversible**. A log MUST NOT remove a leaf
under any circumstance. A leaf containing PII that must not be
disclosed is the issuer's responsibility — only append hashes of
PII-redacted canonical projections.

## 5. Witness protocol

A witness is any independent party that subscribes to STHs from one
or more logs and co-signs them. The protocol:

1. Witness fetches the log's latest STH at interval ≥ 1 hour.
2. Witness fetches a consistency proof from the most recent
   previously-signed STH (size `M`) to the current STH (size `N`).
3. Witness verifies the consistency proof. If it passes:
   - Witness signs the STH with its own keypair.
   - Witness publishes `{ logSth, witnessSignature }` to a public
     bulletin board (TBD — suggested: a Git repo, IPFS, or a
     dedicated witness API).
4. If the consistency proof fails:
   - Witness publishes a fork notice. Monitors and clients SHOULD
     treat the log as compromised.

A monitor with N witnesses sees N independent STH signatures over
every published tree head. A vendor that forks its log either fools
all N witnesses (cryptographically infeasible — they're independent
parties) or one of them publishes a fork notice.

## 6. Threat model

| Threat                                 | Mitigation                                                                                                                                                                                                                                                                                            |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Issuer rewrites history                | Append-only Merkle structure: any rewrite invalidates the consistency proof between the rewritten STH and any prior STH a witness signed.                                                                                                                                                             |
| Issuer forks the log                   | Witnesses see only one STH at each point in time. A second, divergent STH at the same `treeSize` from the same `logId` triggers a fork notice.                                                                                                                                                        |
| Witness collusion                      | Use ≥ 3 witnesses, ideally cross-jurisdictional (one in EU, one in US, one in Africa). Collusion among ≥ 2 of them is detectable as long as the monitor talks to all 3.                                                                                                                               |
| Compromised issuer signing key         | Out of scope at the log layer — STHs signed by the new key are visible at the witness layer; the audit can attribute issued receipts to the pre- or post-compromise window.                                                                                                                           |
| Compromised log operator               | Same as above. The log's STH signing key is independent of the issuer's receipt signing key. A compromised log operator can sign forks, but witnesses + a monitor will detect them in the next sync.                                                                                                  |
| Censorship / receipt-suppression       | The log layer does not prevent an issuer from refusing to issue a receipt in the first place. It only proves that issued receipts cannot be unilaterally suppressed afterward. Procurement contracts SHOULD require that every decision in scope produces a receipt; that contract claim is separate. |
| Post-quantum forgery of STH signatures | STHs SHOULD be signed under VAOS 3.0 (Ed25519 + ML-DSA-65 dual-sign) so the log remains verifiable across the post-quantum transition.                                                                                                                                                                |
| Leaf-data inference (PII leak)         | The log stores only `leafHash`, not the canonical projection. The issuer MUST publish only hashes of PII-redacted projections; raw PII MUST NOT enter the log.                                                                                                                                        |

## 7. Reference implementation

The primitives ship in `@sovereign-matrix/verifiable-receipts`:

```ts
import {
  leafHash,
  innerHash,
  treeRoot,
  inclusionProof,
  verifyInclusionProof,
  consistencyProof,
  verifyConsistencyProof,
  buildSth,
  canonicalizeSth,
} from "@sovereign-matrix/verifiable-receipts/transparency";
```

A full append-only server, witness API, and monitor UI are out of
scope for v0.1 — the primitives are the foundation that downstream
implementations build on. The reference implementation passes 184
test cases including exhaustive (oldSize, newSize) consistency
verification for all pairs in 0..16.

## 8. Comparison to RFC 6962 / 9162

| Aspect              | RFC 9162 (CT)                                  | This spec (ART-Log)                                     |
| ------------------- | ---------------------------------------------- | ------------------------------------------------------- |
| Leaf content        | X.509 certificate or pre-certificate           | VAOS-canonical receipt hash                             |
| Browser enforcement | Chrome / Safari refuse non-CT certificates     | Out of scope — adoption is contract-driven, not browser |
| Witness model       | RFC 9162 Annex B (Tessera-style witnesses)     | Same model; witness implementations TBD                 |
| Signature           | ECDSA-P256 / RSA on the SCT                    | Ed25519 (v2) or Ed25519 + ML-DSA-65 (v3)                |
| Hash domains        | 0x00 leaf / 0x01 inner (SHA-256)               | Identical                                               |
| Sunlight            | Public log audited by Google, Cloudflare, etc. | Federated — issuer-operated logs + N-of-M witnesses     |

The architecture is deliberately compatible with the CT ecosystem.
Tooling that audits CT logs (CTGo, ct-tools, Trillian) operates on
the same hash domains and proof shapes, so an organization that
already runs CT infrastructure can host an ART-Log with minimal
incremental work.

## 9. Roadmap

- v0.1 (shipped) — primitives in the OSS package, 184 conformance tests.
- v0.2 — append-only server reference implementation (file-backed).
- v0.3 — witness API + N-witness aggregator.
- v0.4 — public monitor UI at `/transparency` on `sovereignmatrix.agency`.
- v1.0 — first regulated-vertical pilot using witnessed receipts in
  a procurement contract clause.

## 10. Contact

`spec@sovereignmatrix.agency` — editorial feedback.
`security@sovereignmatrix.agency` — security disclosure.
