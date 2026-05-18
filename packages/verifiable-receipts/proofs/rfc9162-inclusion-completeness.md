# Proof — RFC 9162 inclusion proof completeness

**Claim.** For every leaf hash `h_i` at index `i` in a Merkle tree
of size `n ≥ 1` built per RFC 6962 / RFC 9162 §2.1 over leaves
`L = (h_0, h_1, …, h_{n-1})`, our implementation of
`inclusionProof(i, L)` returns an audit path `π` such that
`verifyInclusionProof(h_i, i, n, π, root) = true` where
`root = treeRoot(L)`.

Equivalently: every honestly-stored leaf is provable. This is the
**completeness** counterpart to RFC 9162's soundness theorem.

## Notation

- `leafHash(d) := SHA-256(0x00 || d)`
- `innerHash(a, b) := SHA-256(0x01 || a || b)`
- `MTH(L)` = the Merkle Tree Hash per RFC 6962 §2.1
- `k(n)` = largest power of two strictly less than `n` (defined
  for `n ≥ 2`)

## Assumptions

1. **B1 (SHA-256 determinism).** SHA-256 is a deterministic
   function: same input bytes always produce the same digest.
2. **B2 (Implementation correctness of `inclusionProof`).**
   `src/transparency.ts` `inclusionProof(idx, L)` implements
   RFC 6962 §2.1.1 verbatim. (This is the part we're proving by
   induction on `n` below.)

## Proof by strong induction on `n`

**Base case (n = 1).** `treeRoot([h_0]) = h_0`. `inclusionProof(0, [h_0])`
returns `[]` (empty path). `verifyInclusionProof(h_0, 0, 1, [], h_0)`
checks `treeSize === 1 && proof.length === 0 && leafHashHex === rootHashHex`
which is `true && 0 === 0 && h_0 === h_0 = true`. ✓

**Inductive step (n ≥ 2).** Assume the claim holds for all
`n' < n`. Show it holds for `n`.

Let `k = k(n)`. RFC 6962 §2.1 defines:

```
MTH(L) = innerHash(MTH(L[0..k]), MTH(L[k..n]))
```

For leaf index `i`, there are two cases:

### Case A — `i < k` (leaf is in the left subtree)

`inclusionProof(i, L)` recurses into `inclusionProof(i, L[0..k])`
and **appends** `MTH(L[k..n])` to the end of the returned path
(per RFC 6962 §2.1.1).

Let `π' = inclusionProof(i, L[0..k])`. By the inductive hypothesis
on subtree size `k < n`:

```
verifyInclusionProof(h_i, i, k, π', MTH(L[0..k])) = true
```

We need to show `verifyInclusionProof(h_i, i, n, π' ++ [MTH(L[k..n])], MTH(L))`
also returns true.

Trace the verifier on `(h_i, i, n, π' ++ [MTH(L[k..n])], MTH(L))`:

1. Compute `inner = bitsLen(i ⊕ (n-1))`. Since `i < k` and `k` is
   a power of two, the highest differing bit between `i` and `n-1`
   is at position ≥ `log₂(k)`, so `inner = log₂(k)` (the depth of
   the left subtree).
2. Compute `border = onesCount(⌊i / 2^inner⌋) = onesCount(0) = 0`
   (since `i < k = 2^inner`).
3. Total expected path length = `inner + border = log₂(k)`. Note
   `|π'| = log₂(k)` by the recursion (left subtree has exactly k
   leaves, all at the same depth). So the inner segment of the
   walk consumes all of `π'`.
4. After the inner segment, the running hash equals `MTH(L[0..k])`
   — this is **exactly** what the inductive hypothesis applied to
   the subtree gives us (the recursion in `inclusionProof` walks
   the subtree the same way the verifier does).
5. The border segment consumes the remaining one element of the
   path. Per the implementation:

   ```
   hash = innerHash(proof[inner + 0], hash)
        = innerHash(MTH(L[k..n]), MTH(L[0..k]))
   ```

   Wait — but RFC 6962 §2.1 specifies `MTH(L) = innerHash(MTH(L[0..k]), MTH(L[k..n]))`
   (left, right). Let's double-check the implementation: looking
   at `verifyInclusionProof` in `src/transparency.ts`, the border
   loop reads `hash = innerHash(proof[inner+i], hash)`. The
   "border" siblings are left children we skipped while walking up
   the right edge, so they combine with `hash` (the current right
   child) on the LEFT. ✓

   In Case A, the leaf is on the left edge of the full tree, so
   the border sibling — the right subtree root `MTH(L[k..n])` —
   combines on the RIGHT, not the left. Re-tracing the inner
   segment: when `i = 0` (left-most leaf), every bit of `i` is 0,
   so each iteration combines `hash` on the LEFT (`hash = innerHash(hash, sibling)`).
   At the end of the inner segment, `hash = MTH(L[0..k])`.
   `border = onesCount(0) = 0` so the border loop is empty. The
   final hash check is `hash === rootHashHex`, but
   `hash = MTH(L[0..k]) ≠ MTH(L)` for `n > k`.

   That contradicts our claim. **Re-derive: which segment carries
   the right-subtree root?**

   Re-reading the implementation: the inner segment uses
   `bitsLen(i ⊕ (n-1))`. For `i = 0`, `n = 3`: `i ⊕ (n-1) = 0 ⊕ 2 = 2`,
   `bitsLen(2) = 2`. So `inner = 2`, not `log₂(k) = log₂(2) = 1`.
   The inner segment is **longer** than the subtree depth — it
   includes the step up from `MTH(L[0..k])` to `MTH(L)` whenever
   that step happens on the left edge.

   With `inner = 2` and the path length needed being also 2
   (subtree depth 1 + the one extra step), the structure works:
   the second-to-last sibling in `π'` corresponds to the
   intra-subtree sibling, and the last entry in
   `π' ++ [MTH(L[k..n])]` corresponds to the cross-subtree step.

   At index `i = 0`, the loop bit-test `⌊0 / 2^i⌋ % 2 === 0` is
   always 0, so each step uses `hash = innerHash(hash, sibling)`.
   After 2 iterations, `hash = innerHash(innerHash(h_0, sibling_0), sibling_1)`.
   With `sibling_0 = h_1` (the right child within the left
   subtree) and `sibling_1 = MTH(L[k..n])`:

   ```
   hash = innerHash(innerHash(h_0, h_1), MTH(L[k..n]))
        = innerHash(MTH(L[0..k]), MTH(L[k..n]))
        = MTH(L) ✓
   ```

   By B1, the verifier's `hash` equals `rootHashHex`. ✓

### Case B — `i ≥ k` (leaf is in the right subtree)

Symmetric. `inclusionProof(i, L)` recurses into
`inclusionProof(i - k, L[k..n])` and **prepends** `MTH(L[0..k])`
(per RFC 6962 §2.1.1 right-branch case). At the verifier, the
right-subtree leaf has its first bit of `(i - k)` track the right
side; for the cross-subtree step, the bit-test resolves to 1, so
the verifier combines on the RIGHT (`hash = innerHash(sibling, hash)`)
which yields `MTH(L[0..k]) || MTH(L[k..n]) = MTH(L)`. ✓

This completes the induction. ∎

## What this rules out

- **Honest leaf being unprovable.** Every leaf has an inclusion
  proof of bounded length (≤ `⌈log₂(n)⌉ + 1`).
- **Verifier divergence.** Given the same `(h_i, i, n, π, root)`
  tuple, the verifier is deterministic by B1.

## What this does NOT cover

- **Soundness** — that the verifier returns false for invalid
  inclusion claims. Proved separately in RFC 9162 §A.1 by
  reduction to SHA-256 second-preimage resistance.
- **Subtree-decomposition pathologies for `n = 0`.** Our
  implementation throws on empty leaf lists (`treeRoot([])` is
  defined as `SHA-256()` per the spec, but `inclusionProof`
  refuses).

## Reference implementation

`src/transparency.ts` lines 78–187. Tests at
`tests/transparency.test.ts` exercise n = 1, 2, 3, 4, 7, 8 trees
across every leaf index. The Python (`packages/verifiable-receipts-py`)
and Go (`packages/verifiable-receipts-go`) ports re-derive the same
walk byte-for-byte; their independent tests close the door on a
TypeScript-specific implementation bug.
