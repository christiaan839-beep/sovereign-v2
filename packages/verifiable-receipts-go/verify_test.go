package vaos

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/pem"
	"strings"
	"testing"
)

// makeKeyPair returns an Ed25519 keypair + PEM-encoded public key.
func makeKeyPair(t *testing.T) (ed25519.PublicKey, ed25519.PrivateKey, []byte) {
	t.Helper()
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generate keypair: %v", err)
	}
	der, err := x509.MarshalPKIXPublicKey(pub)
	if err != nil {
		t.Fatalf("marshal public key: %v", err)
	}
	pemBytes := pem.EncodeToMemory(&pem.Block{
		Type:  "PUBLIC KEY",
		Bytes: der,
	})
	return pub, priv, pemBytes
}

// signV2 mints a v2= wire-format signature over canonical bytes.
func signV2(priv ed25519.PrivateKey, canonical string) string {
	sig := ed25519.Sign(priv, []byte(canonical))
	return "v2=" + base64.StdEncoding.EncodeToString(sig)
}

func contentHash(canonical string) string {
	sum := sha256.Sum256([]byte(canonical))
	return "sha256:" + hex.EncodeToString(sum[:])
}

func TestLoadEd25519PublicKeyFromPEM_RoundTrip(t *testing.T) {
	_, _, pemBytes := makeKeyPair(t)
	pub, err := LoadEd25519PublicKeyFromPEM(pemBytes)
	if err != nil {
		t.Fatalf("expected success, got %v", err)
	}
	if len(pub) != ed25519.PublicKeySize {
		t.Fatalf("expected pubkey size %d, got %d", ed25519.PublicKeySize, len(pub))
	}
}

func TestLoadEd25519PublicKeyFromPEM_RejectsGarbage(t *testing.T) {
	if _, err := LoadEd25519PublicKeyFromPEM([]byte("not a pem")); err == nil {
		t.Fatal("expected error on garbage input")
	}
}

func TestVerifyV2Receipt_AcceptsWellFormed(t *testing.T) {
	pub, priv, _ := makeKeyPair(t)
	canonical := `{"verdictId":"v_test","overall":"pass"}`
	r := Receipt{
		Canonical:   canonical,
		Signature:   signV2(priv, canonical),
		ContentHash: contentHash(canonical),
	}
	result := VerifyV2Receipt(r, pub)
	if !result.OK {
		t.Fatalf("expected OK, got reason: %s", result.Reason)
	}
}

func TestVerifyV2Receipt_RejectsWrongKey(t *testing.T) {
	_, priv1, _ := makeKeyPair(t)
	pub2, _, _ := makeKeyPair(t)
	canonical := `{"verdictId":"v_x"}`
	r := Receipt{
		Canonical: canonical,
		Signature: signV2(priv1, canonical),
	}
	result := VerifyV2Receipt(r, pub2)
	if result.OK {
		t.Fatal("expected verification to fail under wrong key")
	}
	if !strings.Contains(result.Reason, "signature") {
		t.Fatalf("expected signature reason, got %q", result.Reason)
	}
}

func TestVerifyV2Receipt_RejectsTamperedCanonical(t *testing.T) {
	pub, priv, _ := makeKeyPair(t)
	canonical := `{"verdictId":"v_x"}`
	sig := signV2(priv, canonical)
	r := Receipt{
		Canonical: `{"verdictId":"v_tampered"}`,
		Signature: sig,
	}
	if VerifyV2Receipt(r, pub).OK {
		t.Fatal("expected verification to fail on tampered canonical")
	}
}

func TestVerifyV2Receipt_RejectsContentHashMismatch(t *testing.T) {
	pub, priv, _ := makeKeyPair(t)
	canonical := `{"verdictId":"v_x"}`
	r := Receipt{
		Canonical:   canonical,
		Signature:   signV2(priv, canonical),
		ContentHash: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
	}
	result := VerifyV2Receipt(r, pub)
	if result.OK {
		t.Fatal("expected fail on contentHash mismatch")
	}
	if !strings.Contains(result.Reason, "contentHash") {
		t.Fatalf("expected contentHash reason, got %q", result.Reason)
	}
}

func TestVerifyV2Receipt_RejectsNonV2Prefix(t *testing.T) {
	pub, _, _ := makeKeyPair(t)
	r := Receipt{
		Canonical: `{"x":1}`,
		Signature: "v1=hmacstuff",
	}
	if VerifyV2Receipt(r, pub).OK {
		t.Fatal("expected fail on non-v2 prefix")
	}
}

func TestVerifyV2Receipt_RejectsMalformedBase64(t *testing.T) {
	pub, _, _ := makeKeyPair(t)
	r := Receipt{
		Canonical: `{"x":1}`,
		Signature: "v2=!!!notbase64!!!",
	}
	if VerifyV2Receipt(r, pub).OK {
		t.Fatal("expected fail on malformed base64")
	}
}

func TestVerifyV2Receipt_RejectsMissingFields(t *testing.T) {
	pub, _, _ := makeKeyPair(t)
	if VerifyV2Receipt(Receipt{Signature: "v2=x"}, pub).OK {
		t.Fatal("expected fail on missing canonical")
	}
	if VerifyV2Receipt(Receipt{Canonical: "x"}, pub).OK {
		t.Fatal("expected fail on missing signature")
	}
}

func TestVerifyGuardianAttestation_IsAlias(t *testing.T) {
	pub, priv, _ := makeKeyPair(t)
	canonical := `{"verdictId":"g_x","overall":"pass","rules":[]}`
	r := Receipt{
		Canonical: canonical,
		Signature: signV2(priv, canonical),
	}
	if !VerifyGuardianAttestation(r, pub).OK {
		t.Fatal("expected Guardian alias to succeed for v2 receipt")
	}
}
