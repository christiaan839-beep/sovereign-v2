# Cross-language conformance test suite

**License:** Apache 2.0.

This directory makes the "three-language symmetric verifier" claim
**publicly auditable**. A single JSON fixture corpus is checked by
three independent reference verifiers — TypeScript, Python, and Go.
Every fixture has an `expected.ok` field; every verifier MUST agree.

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

10 fixtures × 3 verifiers = **30 cross-language conformance checks
per CI run.**

## The signing key (published, by design)

`public-key.pem` is the Ed25519 verification key for every v2 fixture. As
with the CT, JOSE, and Sigstore conformance suites, the signing key is a
**published test key, not a secret** — publishing it is what lets anyone
re-verify the corpus from a clean clone. The keypair is derived
deterministically from a documented fixed seed by `generate-fixtures.mjs`, so
the corpus is fully reproducible:

```bash
node packages/verifiable-receipts/conformance/generate-fixtures.mjs
```

Running it re-emits `public-key.pem` and re-signs the key-dependent fixtures
byte-for-byte identically. The base64-malformed, wrong-version, and RFC-9162
inclusion fixtures are key-independent and are never touched.

## How to add a fixture

1. Add the key-dependent inputs to `generate-fixtures.mjs` (or hand-write a
   key-independent fixture), then run the generator to sign it with the
   published test key. Issuer-side signing is the only canonical path.
2. Write the fixture to `fixtures/<name>.json`.
3. Run all three harnesses. They MUST all agree on the new
   fixture's expected outcome.
4. Commit the fixture; CI runs all three harnesses on every push.

## Stability guarantee

Fixtures in this corpus are **stable and reproducible**. The generator is
deterministic (fixed seed → fixed Ed25519 signatures), so the byte contents —
including the published keypair — do not change between runs. New tests are
added; existing fixtures are never silently mutated.

This lets external auditors pin a fixture by its sha256 and re-run the
harness against any future verifier version to detect verification drift.

## License

Apache 2.0 © Sovereign Matrix.
