# Proof — VAOS-RSA stream injection / drop / reorder detection

**Claim.** Given a VAOS-RSA streaming attestation
`A = (streamId, totalChunks, merkleRoot, finalOutput, finalOutputHash,
finishedAt)` signed by the issuer, **any of the following adversarial
modifications becomes detectable by the verifier**:

- (I) Injecting a new chunk at any position 0 ≤ k < totalChunks.
- (II) Dropping a chunk at any position 0 ≤ k < totalChunks.
- (III) Reordering two distinct chunks at positions k_1 ≠ k_2.
- (IV) Modifying the content of a chunk at any position k.

Equivalently: a verifier that re-derives the Merkle tree from the
purported chunk sequence will either (a) reject the inclusion
proof, or (b) detect a divergence between `finalOutputHash` and
the actual hash of the concatenation.

## Notation

- `c_i`: the chunk content at position i (0-indexed).
- `h_i := leafHash(c_i) = SHA-256(0x00 || c_i)`.
- `root := MTH([h_0, h_1, …, h_{N-1}])` where N = totalChunks.
- `O := concat(c_0, c_1, …, c_{N-1})`.
- The attestation envelope commits to both `root` and
  `SHA-256(O)` via the Ed25519 signature on its canonical
  projection.

## Assumptions

1. **E1 (Signature non-malleability for VAOS v2/v3).** Proved
   in `vaos-v2-non-malleability.md`. The signed envelope cannot
   be tampered without breaking the signature.
2. **E2 (SHA-256 collision resistance).** No PPT adversary
   finds `x ≠ y` with `SHA-256(x) = SHA-256(y)`.
3. **E3 (RFC 9162 inclusion-proof soundness).** A valid
   inclusion proof for `(h_i, i, N, π, root)` implies `h_i` is
   the i-th leaf of the tree with root `root`. (Proved in
   RFC 9162 §A.1.)
4. **E4 (Builder correctness from `rfc9162-inclusion-completeness.md`).**
   For an honest builder, every honestly-stored chunk has a valid
   inclusion proof.

## Proof by case analysis on the adversarial action

Let `A` be the original signed attestation. By E1, the adversary
cannot modify `A` directly — any tampering of the envelope
breaks the signature. So the adversary's only freedom is:

- **Lying about the chunk sequence** they present alongside `A`,
  OR
- **Forging a new attestation** `A'` to accompany a different
  chunk sequence.

The latter requires either a key compromise (out of scope) or
constructing `A'` with a Merkle root matching a different chunk
sequence — which we show is infeasible below.

### Case I — Chunk injection

Adversary claims the sequence is
`c_0, …, c_{k-1}, c_inject, c_k, …, c_{N-1}` (N+1 chunks). The
adversary asks the verifier to accept this expanded sequence.

The verifier rebuilds the Merkle tree over the claimed sequence:

```
root_adv := MTH([h_0, …, h_{k-1}, leafHash(c_inject), h_k, …, h_{N-1}])
```

Both `root_adv` and `root` are SHA-256 outputs over different
preimages (one has N+1 leaves, the other N). For the verifier
to accept, we'd need `root_adv = root`. By E2 (collision
resistance of SHA-256 — actually the Merkle root combining function
inherits collision resistance from SHA-256), `root_adv = root` is
infeasible.

Additionally, the verifier checks `totalChunks` from the signed
envelope. The adversary claiming N+1 chunks against a signed
`totalChunks = N` is rejected immediately. ∎ Case I

### Case II — Chunk drop

Adversary claims the sequence is N-1 chunks (missing position k).
The verifier's `totalChunks` from the signed envelope is N.
Mismatch → rejected.

Even if the adversary forges a sibling-substitution proof, by
E3 the inclusion proof for any specific chunk must reconcile
with the signed `merkleRoot`. The remaining N-1 chunks build a
tree with N-1 leaves; the resulting MTH ≠ original root by E2. ∎ Case II

### Case III — Chunk reorder

Adversary claims sequence `c_0, …, c_{k_2}, …, c_{k_1}, …, c_{N-1}`
(positions k_1 and k_2 swapped, k_1 ≠ k_2).

The Merkle tree construction is **position-sensitive**: the
i-th leaf appears at depth `⌈log₂ N⌉` along the path determined
by the bits of i. Swapping two leaves at different positions
changes the path structure and hence the root.

Formally, let `T(L)` be the Merkle tree over leaf list `L`. The
unique-path property of `T` says that for distinct positions
k*1, k_2 with c*{k*1} ≠ c*{k*2}, the trees `T(L)` and
`T(swap(L, k_1, k_2))` produce different roots with overwhelming
probability — concretely, equality requires
`innerHash(h*{k*1}, x) = innerHash(h*{k*2}, x)`at some
intermediate node for some sibling`x`, which by E2 implies
`h*{k*1} = h*{k*2}`, which by E2 again implies
`c*{k*1} = c*{k_2}` (contradicting our assumption of distinct
chunks).

So `root_swap ≠ root` and the verifier rejects. ∎ Case III

### Case IV — Chunk content modification

Adversary claims position k contains `c'_k ≠ c_k`. The verifier
rebuilds:

```
root_mod := MTH([h_0, …, leafHash(c'_k), …, h_{N-1}])
```

By E2, `leafHash(c'_k) ≠ leafHash(c_k)`, hence `root_mod ≠ root`
(by collision resistance applied at the leaf level, propagating
up the tree).

The signed envelope commits to the original `root`, so
verification of an inclusion proof for the modified content
fails.

**Separate detection via finalOutputHash.** The envelope also
commits to `SHA-256(O)` where `O` is the original concatenated
output. The adversary's tampered sequence concatenates to
`O' = concat(c_0, …, c'_k, …, c_{N-1}) ≠ O`. By E2,
`SHA-256(O') ≠ SHA-256(O)`, so `verifyFinalOutputHash(A)`
applied to the tampered envelope (if the adversary tried to
forge the envelope to match O') would fail at the signature
step (E1). If the adversary leaves the envelope unmodified,
the chunk-content vs envelope `finalOutput` field also drifts.

Both detection paths fire independently. ∎ Case IV

## Conjunction

By exhaustion of cases (I–IV), no in-stream adversarial
modification escapes both the Merkle commitment and the
finalOutputHash commitment. ∎

## What this rules out

- **Mid-stream token injection** by a malicious proxy or
  middlebox.
- **Token dropping** that would silently shorten the recorded
  output.
- **Reordering attacks** (e.g. swapping affirmative + negative
  clauses to flip the meaning of a clinical recommendation).
- **Per-chunk content tampering** at any depth.

## What this does NOT cover

- **Honest-issuer omission.** If the issuer themselves chooses
  to omit a chunk from the Merkle tree (e.g. censoring an
  inconvenient observation), no cryptographic check inside the
  envelope can detect that. Mitigated by also transparency-
  logging every chunk hash independently, so an external
  observer can compare the log against the published
  attestation. (Spec note in `docs/specs/vaos-rsa-1.0.md` §6.)
- **Side-channel attacks on the issuer's signing process.**
  Timing leaks, fault injection, etc. are addressed by hardware
  enclave operation; out of scope here.

## Reference implementation

`src/stream-attestation.ts`:

- `StreamAttestationBuilder.append()` — enforces strict
  index order (rejects out-of-order chunks → Case III defense
  at build time).
- `finalize()` — computes `merkleRoot` + `finalOutputHash`
  deterministically.
- `verifyChunkInclusion()` — runs RFC 9162 inclusion-proof
  verification against the signed root.
- `verifyFinalOutputHash()` — re-derives
  `SHA-256(finalOutput)` and compares against the envelope's
  field.

Tests at `tests/stream-attestation.test.ts` exercise: tampered
chunk content (Case IV), wrong-index proofs (Case III analogue),
out-of-order builder appends (Case III defense at construction
time), Merkle-root order-sensitivity (sequences with the same
chunks in different orders produce different roots — Case III),
finalOutputHash defense.
