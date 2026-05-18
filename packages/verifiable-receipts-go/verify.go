// Package vaos — Verifier-only Go implementation of VAOS 2.0 receipts.
//
// Mirrors `verifyDualSig()` from the TypeScript canonical package
// (`@sovereign-matrix/verifiable-receipts`) for v2 (Ed25519) wire
// format. v3 (Ed25519 + ML-DSA-65) requires a non-stdlib post-quantum
// signature library and lands in v0.2.
//
// The math is the contract: this module re-derives the canonical
// projection independently and confirms signatures with the published
// Ed25519 public key. Any signature minted by the TypeScript
// canonical implementation verifies here, byte-for-byte.
package vaos

import (
	"crypto/ed25519"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/pem"
	"errors"
	"strings"
)

// Receipt is the verifier-facing shape of a VAOS 2.0 receipt. Only
// the three fields needed for verification are required.
type Receipt struct {
	// Canonical is the exact UTF-8 byte string the issuer signed.
	Canonical string `json:"canonical"`

	// ContentHash, when non-empty, MUST equal "sha256:" + hex(sha256(canonical)).
	// We cross-check it to catch receipts where the canonical was tampered
	// post-hoc but the original hash was retained.
	ContentHash string `json:"contentHash"`

	// Signature is the v2= wire-format signature: "v2=" + base64(ed25519_sig).
	Signature string `json:"signature"`
}

// VerifyResult is the outcome of a verification attempt. OK reports
// success; Reason is non-empty on failure.
type VerifyResult struct {
	OK     bool
	Reason string
}

// LoadEd25519PublicKeyFromPEM parses a PEM-encoded Ed25519 public key
// (the same format served at /.well-known/sovereign-receipts/ed25519.pem).
//
// Returns an error if the PEM is not Ed25519 or is malformed.
func LoadEd25519PublicKeyFromPEM(pemBytes []byte) (ed25519.PublicKey, error) {
	block, _ := pem.Decode(pemBytes)
	if block == nil {
		return nil, errors.New("vaos: PEM block not found")
	}
	pub, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return nil, err
	}
	ed, ok := pub.(ed25519.PublicKey)
	if !ok {
		return nil, errors.New("vaos: PEM is not an Ed25519 public key")
	}
	return ed, nil
}

// VerifyV2Receipt verifies a single VAOS 2.0 receipt under the
// supplied Ed25519 public key.
//
// Returns OK=true only when:
//   - Receipt has a non-empty Canonical
//   - Receipt has a non-empty Signature starting with "v2="
//   - ContentHash (if present) equals "sha256:" + hex(sha256(canonical))
//   - The Ed25519 signature verifies over the canonical UTF-8 bytes
//
// Never panics on adversarial input. Returns a short Reason string
// on any failure.
func VerifyV2Receipt(r Receipt, pub ed25519.PublicKey) VerifyResult {
	if r.Canonical == "" {
		return VerifyResult{OK: false, Reason: "missing canonical projection"}
	}
	if r.Signature == "" {
		return VerifyResult{OK: false, Reason: "missing signature"}
	}
	if !strings.HasPrefix(r.Signature, "v2=") {
		return VerifyResult{OK: false, Reason: "signature is not v2 (expected 'v2=<base64>')"}
	}
	sigBytes, err := base64.StdEncoding.DecodeString(r.Signature[3:])
	if err != nil {
		return VerifyResult{OK: false, Reason: "signature base64 invalid: " + err.Error()}
	}

	canonicalBytes := []byte(r.Canonical)

	if r.ContentHash != "" {
		actual := sha256.Sum256(canonicalBytes)
		expected := strings.TrimPrefix(r.ContentHash, "sha256:")
		actualHex := hex.EncodeToString(actual[:])
		if actualHex != expected {
			return VerifyResult{OK: false, Reason: "contentHash mismatch with canonical bytes"}
		}
	}

	if !ed25519.Verify(pub, canonicalBytes, sigBytes) {
		return VerifyResult{
			OK:     false,
			Reason: "signature does not verify under the supplied public key",
		}
	}

	return VerifyResult{OK: true}
}

// VerifyGuardianAttestation is a semantic alias for VerifyV2Receipt —
// a Guardian attestation IS a v2 receipt whose canonical projection
// lists rule verdicts in a deterministic order. Exposed under a
// separate name for callers that want the Guardian-specific surface.
func VerifyGuardianAttestation(r Receipt, pub ed25519.PublicKey) VerifyResult {
	return VerifyV2Receipt(r, pub)
}
