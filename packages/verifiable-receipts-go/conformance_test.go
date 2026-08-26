package vaos

import (
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"testing"
)

// Cross-language conformance harness — Go verifier side.
//
// Reads the JSON fixtures from
// ../verifiable-receipts/conformance/fixtures and asserts that the
// Go reference implementation agrees with the TypeScript canonical
// implementation on every fixture's expected outcome.
//
// Same corpus exercised by:
//   - TypeScript: packages/verifiable-receipts/conformance/conformance.test.ts
//   - Python:     packages/verifiable-receipts/conformance/conformance.py
//
// All three harnesses MUST produce identical pass/fail results per
// fixture. This is what makes the "three-language symmetric verifier"
// claim auditable.

const fixturesDir = "../verifiable-receipts/conformance/fixtures"
const publicKeyPath = "../verifiable-receipts/conformance/public-key.pem"

type v2Receipt struct {
	Canonical   string `json:"canonical"`
	ContentHash string `json:"contentHash,omitempty"`
	Signature   string `json:"signature"`
}

type v2Expected struct {
	OK              bool   `json:"ok"`
	ReasonContains string `json:"reasonContains,omitempty"`
}

type v2Fixture struct {
	Description string     `json:"description"`
	Receipt     v2Receipt  `json:"receipt"`
	Expected    v2Expected `json:"expected"`
}

type inclusionFixture struct {
	Description string   `json:"description"`
	LeafHashHex string   `json:"leafHashHex"`
	LeafIndex   int      `json:"leafIndex"`
	TreeSize    int      `json:"treeSize"`
	AuditPath   []string `json:"auditPath"`
	RootHashHex string   `json:"rootHashHex"`
	Expected    struct {
		OK bool `json:"ok"`
	} `json:"expected"`
}

// TestConformance_LoadsTheDocumentedCorpus asserts the exact corpus size
// and accept/reject split, not a floor.
//
// The README states "11 fixtures x 3 verifiers = 33 checks, 5 accept /
// 6 reject". A ">= 10" assertion lets that arithmetic drift silently the
// moment someone adds a fixture; an exact one makes the documented
// number fail when it goes stale.
func TestConformance_LoadsTheDocumentedCorpus(t *testing.T) {
	entries, err := os.ReadDir(fixturesDir)
	if err != nil {
		t.Fatalf("read fixtures dir: %v", err)
	}
	count, accept := 0, 0
	for _, e := range entries {
		if !strings.HasSuffix(e.Name(), ".json") {
			continue
		}
		count++
		raw, err := os.ReadFile(filepath.Join(fixturesDir, e.Name()))
		if err != nil {
			t.Fatalf("read %s: %v", e.Name(), err)
		}
		var fx struct {
			Expected struct {
				OK bool `json:"ok"`
			} `json:"expected"`
		}
		if err := json.Unmarshal(raw, &fx); err != nil {
			t.Fatalf("parse %s: %v", e.Name(), err)
		}
		if fx.Expected.OK {
			accept++
		}
	}
	if count != 11 {
		t.Fatalf("expected exactly 11 fixtures, got %d", count)
	}
	if accept != 5 {
		t.Fatalf("expected exactly 5 accept fixtures, got %d", accept)
	}
	if count-accept != 6 {
		t.Fatalf("expected exactly 6 reject fixtures, got %d", count-accept)
	}
}

func TestConformance_EveryFixtureMatchesExpected(t *testing.T) {
	pemBytes, err := os.ReadFile(publicKeyPath)
	if err != nil {
		t.Fatalf("read public key: %v", err)
	}
	pub, err := LoadEd25519PublicKeyFromPEM(pemBytes)
	if err != nil {
		t.Fatalf("load public key: %v", err)
	}

	entries, err := os.ReadDir(fixturesDir)
	if err != nil {
		t.Fatalf("read fixtures dir: %v", err)
	}

	// Stable order — same as the TS + Python harnesses.
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		if strings.HasSuffix(e.Name(), ".json") {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names)

	for _, name := range names {
		name := name // capture for parallel safety
		t.Run(name, func(t *testing.T) {
			raw, err := os.ReadFile(filepath.Join(fixturesDir, name))
			if err != nil {
				t.Fatalf("read fixture: %v", err)
			}

			// Discriminate v2 vs inclusion by presence of the "receipt"
			// key. We do a soft-peek by unmarshalling into a map first.
			var probe map[string]json.RawMessage
			if err := json.Unmarshal(raw, &probe); err != nil {
				t.Fatalf("unmarshal probe: %v", err)
			}

			if _, isV2 := probe["receipt"]; isV2 {
				var fixture v2Fixture
				if err := json.Unmarshal(raw, &fixture); err != nil {
					t.Fatalf("unmarshal v2: %v", err)
				}
				receipt := Receipt{
					Canonical:   fixture.Receipt.Canonical,
					ContentHash: fixture.Receipt.ContentHash,
					Signature:   fixture.Receipt.Signature,
				}
				result := VerifyV2Receipt(receipt, pub)
				if result.OK != fixture.Expected.OK {
					t.Fatalf(
						"%s: expected ok=%v, got ok=%v reason=%q",
						name, fixture.Expected.OK, result.OK, result.Reason,
					)
				}
				if fixture.Expected.ReasonContains != "" && !result.OK {
					rx, err := regexp.Compile("(?i)" + fixture.Expected.ReasonContains)
					if err != nil {
						t.Fatalf("compile reason regex: %v", err)
					}
					if !rx.MatchString(result.Reason) {
						t.Fatalf(
							"%s: expected reason to match %q, got %q",
							name, fixture.Expected.ReasonContains, result.Reason,
						)
					}
				}
				return
			}

			if _, isInclusion := probe["leafHashHex"]; isInclusion {
				var fixture inclusionFixture
				if err := json.Unmarshal(raw, &fixture); err != nil {
					t.Fatalf("unmarshal inclusion: %v", err)
				}
				proof := InclusionProof{
					LeafIndex: fixture.LeafIndex,
					TreeSize:  fixture.TreeSize,
					AuditPath: fixture.AuditPath,
				}
				actual := VerifyInclusionProof(proof, fixture.LeafHashHex, fixture.RootHashHex)
				if actual != fixture.Expected.OK {
					t.Fatalf(
						"%s: expected ok=%v, got ok=%v",
						name, fixture.Expected.OK, actual,
					)
				}
				return
			}

			t.Fatalf("%s: unknown fixture shape (no 'receipt' or 'leafHashHex')", name)
		})
	}
}
