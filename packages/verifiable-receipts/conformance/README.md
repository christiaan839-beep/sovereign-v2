# Cross-language conformance test suite

**License:** Apache 2.0.

This directory makes the "three-language symmetric verifier" claim
**publicly auditable**. A single JSON fixture corpus is checked by three
reference verifiers — TypeScript, Python and Go. Every fixture carries an
`expected.ok` field; every verifier MUST agree.

**What that does and does not prove.** The three are independent
*implementations* — separate languages, runtimes, crypto libraries and
integer semantics — so they catch the failures that actually bite in
practice: a base64 alphabet difference, an Ed25519 library that accepts a
malleable signature, a hex decoder that truncates, a bit-length operator
that differs on the right edge of an odd tree.

They are **not** algorithmically independent. Both ports say so in their
own source: `transparency.py` — "Matches the TypeScript canonical
verifier"; `transparency.go` — "Byte-identical with the TypeScript
canonical verifier". The inclusion verifiers are deliberate ports of one
inner/border decomposition, so a bug in that decomposition would pass all
three. Closing that gap needs a fourth verifier written from RFC 6962
alone by someone who has not read this code. Until then, read agreement
here as "no encoding or crypto-stack divergence", not as "the algorithm
is correct".

## Why this exists

Without a conformance corpus, "we have a Python verifier and a Go
verifier" is a marketing claim. With this corpus, it is a public,
deterministic, byte-level proof. An auditor can clone the repo, run
all three harnesses, and confirm they reach identical conclusions on
every receipt.

Same playbook used by:

- The [Certificate Transparency](https://github.com/google/certificate-transparency-go)
  cross-implementation test vectors.
- The [JOSE](https://github.com/panva/jose) cross-language conformance fixtures.
- The [Sigstore](https://github.com/sigstore/sigstore-conformance) suite.

## Files

| File                                            | Purpose                                                   |
| ----------------------------------------------- | --------------------------------------------------------- |
| `public-key.pem`                                | The single Ed25519 PEM used for signing the v2 fixtures.  |
| `fixtures/*.json`                               | The corpus. Each file is one self-describing test vector. |
| `conformance.test.ts`                           | TypeScript harness (vitest).                              |
| `conformance.py`                                | Python harness (pytest).                                  |
| `../verifiable-receipts-go/conformance_test.go` | Go harness (`go test`).                                   |

## Fixture shape

A v2 receipt fixture:

```json
{
  "description": "v2 valid — well-formed Guardian attestation",
  "receipt": {
    "canonical": "<UTF-8 bytes that were signed>",
    "contentHash": "sha256:<hex>",
    "signature": "v2=<base64>"
  },
  "expected": { "ok": true }
}
```

An RFC 9162 inclusion-proof fixture:

```json
{
  "description": "inclusion 4-leaf — proof for index 1 (beta)",
  "leafHashHex": "<hex>",
  "leafIndex": 1,
  "treeSize": 4,
  "auditPath": ["<hex>", "<hex>"],
  "rootHashHex": "<hex>",
  "expected": { "ok": true }
}
```

When `expected.ok` is `false`, the optional `expected.reasonContains`
field gives an i-case regex the verifier's failure reason must match.

## Running the three harnesses

```bash
# 1. TypeScript (vitest)
npx vitest run packages/verifiable-receipts/conformance/conformance.test.ts

# 2. Python (pytest)
cd packages/verifiable-receipts-py
PYTHONPATH=. python3 -m pytest \
    ../verifiable-receipts/conformance/conformance.py -v

# 3. Go (go test)
cd packages/verifiable-receipts-go
go test ./... -v -run Conformance
```

All three commands MUST emit "X passed" with the same count.

## Coverage today

Fixtures cover:

- v2 wire format: well-formed accept · canonical-tamper reject ·
  wrong-key reject · base64 malformed · non-v2 prefix
- RFC 9162 inclusion proof: single-leaf · 4-leaf (idx 1) · 7-leaf
  asymmetric (idx 4) · tampered-root reject · out-of-range index

11 fixtures × 3 verifiers = **33 cross-language conformance checks per
run** — 5 that must be accepted, 6 that must be rejected. The count is
asserted in the harnesses themselves, so adding a fixture without
updating them fails rather than silently drifting.

## Running them

```bash
./packages/verifiable-receipts/conformance/run-all.sh
```

```console
  conformance — 11 fixtures, three verifiers

  ✓ TypeScript   932ms
  ✓ Python       279ms
  ✓ Go          1048ms

  all 3 harnesses agree on all 11 fixtures
```

One command, one definition of "all three agree", exit non-zero on any
disagreement. A missing toolchain prints `skipped` and **still exits
non-zero** — a corpus that reports success while testing one language out
of three is precisely the failure this corpus exists to prevent. CI calls
this script and nothing else, so CI and your laptop cannot drift into two
different answers.

Three negative paths are exercised rather than assumed:

- `go` removed from `PATH` → reports `skipped`, exits 1.
- One fixture's `expected.ok` flipped → every harness disagrees, exits 1.
- A twelfth fixture added → every harness fails the exact-count assertion.

That last one is why the Go step passes `-count=1`. Without it `go test`
replayed a previous PASS after the corpus had changed underneath it:
TypeScript and Python failed on the drifted corpus while Go reported
green in half its usual time. A conformance runner that can serve a
stale pass is worse than no runner.

## How to add a fixture

1. Generate signed bytes via the TypeScript canonical implementation
   (`@sovereign-matrix/verifiable-receipts`). Issuer-side signing is
   the only canonical path.
2. Write the fixture to `fixtures/<name>.json`.
3. Run `./run-all.sh`. All three harnesses MUST agree on the new
   fixture's expected outcome.
4. Commit the fixture. The `conformance` job in `.github/workflows/ci.yml`
   runs that same script on every push.

## Regenerating the corpus

The v2 fixtures are signed with a throwaway Ed25519 keypair whose
public half lives at `public-key.pem` (committed; the private half is
discarded at generation time). If the corpus ever needs re-signing:

```bash
node packages/verifiable-receipts/conformance/generate-fixtures.mjs
```

This rewrites `public-key.pem` and the five `v2-*.json` fixtures in
one deterministic pass; inclusion-proof fixtures are key-independent
and untouched. Re-run all three harnesses afterwards.

## Stability guarantee

Fixtures in this corpus are **frozen**. Once a fixture is published
in a tagged release, its byte contents (including the keypair used
to sign it) MUST NOT change. New tests are added; existing fixtures
are never silently mutated.

This guarantee lets external auditors pin a fixture by its
sha256 and re-run the harness against any future verifier version
to detect verification drift.

## License

Apache 2.0 © Sovereign Matrix.
