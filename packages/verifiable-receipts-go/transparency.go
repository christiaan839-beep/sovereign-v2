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

// VerifyInclusionProof returns true iff hashing the leaf with the
// audit path siblings (per RFC 9162 §2.1.1) yields rootHashHex.
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

	// RFC 9162 §2.1.1 walk: track the running hash, the leaf index,
	// and the effective sub-tree size.
	current := leafHashHex
	index := proof.LeafIndex
	size := proof.TreeSize

	for _, siblingHex := range proof.AuditPath {
		if size <= 1 {
			// Audit-path entries remain but the tree degenerated.
			return false
		}
		if index%2 == 1 {
			// We are the right child; sibling on the left.
			h, err := InnerHash(siblingHex, current)
			if err != nil {
				return false
			}
			current = h
		} else {
			// We are the left child. If we have no right neighbor at
			// this level, a well-formed proof would not include a step.
			if index+1 >= size {
				return false
			}
			h, err := InnerHash(current, siblingHex)
			if err != nil {
				return false
			}
			current = h
		}
		index = index / 2
		size = (size + 1) / 2
	}

	// After consuming the full audit path, size must have collapsed
	// to a single subtree (the root).
	if size != 1 {
		return false
	}
	return current == rootHashHex
}

// ErrEmptyAuditPath is returned only when an explicit assertion is
// requested via VerifyInclusionProofStrict.
var ErrEmptyAuditPath = errors.New("vaos: empty audit path on multi-leaf tree")
