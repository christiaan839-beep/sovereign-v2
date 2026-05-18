package vaos

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"
)

// RFC 9162 / RFC 6962 transparency-log primitives. Byte-for-byte
// compatible with the TypeScript canonical implementation in
// `transparency.ts` — same domain separators (0x00 for leaves,
// 0x01 for inner nodes), same hex encoding throughout.

const (
	leafPrefix  byte = 0x00
	innerPrefix byte = 0x01
)

// LeafHash computes sha256(0x00 || data) per RFC 9162 §2. Returns
// the hex-encoded digest.
func LeafHash(data []byte) string {
	h := sha256.New()
	h.Write([]byte{leafPrefix})
	h.Write(data)
	return hex.EncodeToString(h.Sum(nil))
}

// InnerHash combines two child hashes (both hex-encoded) into the
// parent hash sha256(0x01 || left || right) per RFC 9162 §2.
func InnerHash(leftHex, rightHex string) (string, error) {
	left, err := hex.DecodeString(strings.TrimPrefix(leftHex, "0x"))
	if err != nil {
		return "", err
	}
	right, err := hex.DecodeString(strings.TrimPrefix(rightHex, "0x"))
	if err != nil {
		return "", err
	}
	h := sha256.New()
	h.Write([]byte{innerPrefix})
	h.Write(left)
	h.Write(right)
	return hex.EncodeToString(h.Sum(nil)), nil
}

// InclusionProof is the wire shape of an RFC 9162 audit path.
type InclusionProof struct {
	// LeafIndex is the 0-based position of the leaf in the tree.
	LeafIndex int

	// TreeSize is the total number of leaves in the tree.
	TreeSize int

	// AuditPath is the sequence of sibling hashes (hex-encoded)
	// needed to walk from the leaf up to the root.
	AuditPath []string
}

// bitsLen returns the number of bits required to represent n.
// Equivalent to math/bits.Len + cast.
func bitsLen(n int) int {
	c := 0
	for n > 0 {
		c++
		n >>= 1
	}
	return c
}

// onesCount returns the popcount of n.
func onesCount(n int) int {
	c := 0
	for n > 0 {
		c += n & 1
		n >>= 1
	}
	return c
}

// VerifyInclusionProof returns true iff hashing the leaf with the
// audit path siblings (per RFC 9162 §2.1.1) yields rootHashHex.
//
// Uses the inner/border decomposition that handles every tree shape
// — including odd-tree right-edge carry-up cases like idx=6 in a
// 7-leaf tree. Byte-identical with the TypeScript canonical verifier.
//
// Returns false (not error) for all routine failure modes — wrong
// root, wrong index, malformed audit path entry, leaf-index out of
// range, zero tree size — so callers can use it as a predicate
// without exception-handling.
func VerifyInclusionProof(proof InclusionProof, leafHashHex, rootHashHex string) bool {
	if proof.TreeSize <= 0 {
		return false
	}
	if proof.LeafIndex < 0 || proof.LeafIndex >= proof.TreeSize {
		return false
	}
	// Single-leaf tree: root equals leaf, no audit path.
	if proof.TreeSize == 1 {
		return len(proof.AuditPath) == 0 && leafHashHex == rootHashHex
	}

	// RFC 9162 §2.1.1 inner/border decomposition.
	inner := bitsLen(proof.LeafIndex ^ (proof.TreeSize - 1))
	border := onesCount(proof.LeafIndex >> inner)
	if len(proof.AuditPath) != inner+border {
		return false
	}

	current := leafHashHex

	// Inner segment: walk the bits of leafIndex.
	// Bit=0 → sibling on the right; bit=1 → sibling on the left.
	for i := 0; i < inner; i++ {
		sibling := proof.AuditPath[i]
		var h string
		var err error
		if (proof.LeafIndex>>i)&1 == 0 {
			h, err = InnerHash(current, sibling)
		} else {
			h, err = InnerHash(sibling, current)
		}
		if err != nil {
			return false
		}
		current = h
	}

	// Border segment: every remaining sibling combines on the LEFT
	// (these are left-children we skipped while walking up the right edge).
	for i := 0; i < border; i++ {
		h, err := InnerHash(proof.AuditPath[inner+i], current)
		if err != nil {
			return false
		}
		current = h
	}

	return current == rootHashHex
}

// ErrEmptyAuditPath is returned only when an explicit assertion is
// requested via VerifyInclusionProofStrict.
var ErrEmptyAuditPath = errors.New("vaos: empty audit path on multi-leaf tree")
