package vaos

import (
	"crypto/sha256"
	"encoding/hex"
	"testing"
)

func TestLeafHash_DomainSeparator(t *testing.T) {
	// RFC 9162 §2 — leaf hash is SHA-256(0x00 || data).
	got := LeafHash([]byte("hello"))
	expected := sha256.Sum256(append([]byte{0x00}, []byte("hello")...))
	if got != hex.EncodeToString(expected[:]) {
		t.Fatalf("leaf hash mismatch:\n  got      %s\n  expected %s",
			got, hex.EncodeToString(expected[:]))
	}
}

func TestInnerHash_DomainSeparator(t *testing.T) {
	a := LeafHash([]byte("a"))
	b := LeafHash([]byte("b"))
	got, err := InnerHash(a, b)
	if err != nil {
		t.Fatalf("InnerHash err: %v", err)
	}
	aBytes, _ := hex.DecodeString(a)
	bBytes, _ := hex.DecodeString(b)
	expected := sha256.Sum256(append(append([]byte{0x01}, aBytes...), bBytes...))
	if got != hex.EncodeToString(expected[:]) {
		t.Fatalf("inner hash mismatch")
	}
}

func TestInnerHash_RejectsMalformedHex(t *testing.T) {
	if _, err := InnerHash("not-hex", "00"); err == nil {
		t.Fatal("expected error on malformed left hex")
	}
}

func TestVerifyInclusionProof_SingleLeaf(t *testing.T) {
	leaf := LeafHash([]byte("only"))
	proof := InclusionProof{
		LeafIndex: 0,
		TreeSize:  1,
		AuditPath: []string{},
	}
	if !VerifyInclusionProof(proof, leaf, leaf) {
		t.Fatal("expected single-leaf inclusion to verify")
	}
}

func TestVerifyInclusionProof_TwoLeafLeft(t *testing.T) {
	a := LeafHash([]byte("a"))
	b := LeafHash([]byte("b"))
	root, _ := InnerHash(a, b)
	proof := InclusionProof{
		LeafIndex: 0,
		TreeSize:  2,
		AuditPath: []string{b},
	}
	if !VerifyInclusionProof(proof, a, root) {
		t.Fatal("expected 2-leaf left inclusion to verify")
	}
}

func TestVerifyInclusionProof_TwoLeafRight(t *testing.T) {
	a := LeafHash([]byte("a"))
	b := LeafHash([]byte("b"))
	root, _ := InnerHash(a, b)
	proof := InclusionProof{
		LeafIndex: 1,
		TreeSize:  2,
		AuditPath: []string{a},
	}
	if !VerifyInclusionProof(proof, b, root) {
		t.Fatal("expected 2-leaf right inclusion to verify")
	}
}

func TestVerifyInclusionProof_FourLeaf(t *testing.T) {
	a := LeafHash([]byte("a"))
	b := LeafHash([]byte("b"))
	c := LeafHash([]byte("c"))
	d := LeafHash([]byte("d"))
	ab, _ := InnerHash(a, b)
	cd, _ := InnerHash(c, d)
	root, _ := InnerHash(ab, cd)

	proofForC := InclusionProof{
		LeafIndex: 2,
		TreeSize:  4,
		AuditPath: []string{d, ab},
	}
	if !VerifyInclusionProof(proofForC, c, root) {
		t.Fatal("expected 4-leaf inclusion to verify")
	}
}

func TestVerifyInclusionProof_RejectsWrongRoot(t *testing.T) {
	a := LeafHash([]byte("a"))
	b := LeafHash([]byte("b"))
	root, _ := InnerHash(a, b)
	// Tamper.
	tamperedRoot, _ := InnerHash(b, a)
	proof := InclusionProof{
		LeafIndex: 0,
		TreeSize:  2,
		AuditPath: []string{b},
	}
	if VerifyInclusionProof(proof, a, tamperedRoot) {
		t.Fatal("expected fail under wrong root")
	}
	// Sanity: the correct root verifies.
	if !VerifyInclusionProof(proof, a, root) {
		t.Fatal("sanity: correct root should verify")
	}
}

func TestVerifyInclusionProof_RejectsOutOfRangeIndex(t *testing.T) {
	a := LeafHash([]byte("a"))
	proof := InclusionProof{LeafIndex: 5, TreeSize: 2, AuditPath: []string{}}
	if VerifyInclusionProof(proof, a, a) {
		t.Fatal("expected fail on out-of-range index")
	}
}

func TestVerifyInclusionProof_RejectsZeroTreeSize(t *testing.T) {
	if VerifyInclusionProof(InclusionProof{LeafIndex: 0, TreeSize: 0}, "00", "00") {
		t.Fatal("expected fail on zero tree size")
	}
}

func TestVerifyInclusionProof_RejectsMalformedAuditPathEntry(t *testing.T) {
	a := LeafHash([]byte("a"))
	proof := InclusionProof{
		LeafIndex: 0,
		TreeSize:  2,
		AuditPath: []string{"not-hex"},
	}
	if VerifyInclusionProof(proof, a, a) {
		t.Fatal("expected fail on malformed audit path entry")
	}
}
