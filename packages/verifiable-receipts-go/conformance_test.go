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

func TestConformance_LoadsAtLeast10Fixtures(t *testing.T) {
	entries, err := os.ReadDir(fixturesDir)
	if err != nil {
		t.Fatalf("read fixtures dir: %v", err)
	}
	count := 0
	for _, e := range entries {
		if strings.HasSuffix(e.Name(), ".json") {
			count++
		}
	}
	if count < 10 {
		t.Fatalf("expected at least 10 fixtures, got %d", count)
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
