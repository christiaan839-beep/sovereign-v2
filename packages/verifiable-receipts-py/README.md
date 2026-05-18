# sovereign-matrix-verifiable-receipts (Python)

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)

**Pure-Python verifier for VAOS receipts** — the Python counterpart to
[`@sovereign-matrix/verifiable-receipts`](https://www.npmjs.com/package/@sovereign-matrix/verifiable-receipts).

Verify Ed25519-signed receipts (VAOS 2.0), check Guardian attestation
envelopes, and walk RFC 9162 transparency-log inclusion proofs — from
any Python process, with zero coupling to the issuer's platform.

This is **verifier-side only** — Python tooling that needs to mint
new receipts should call out to the canonical TypeScript implementation
via subprocess or use the platform's public signing endpoint.
Verification is symmetric (the math is the contract) so Python
verifiers re-derive the canonical projection independently and confirm
signatures with the published Ed25519 pubkey.

## Why this exists

~80% of working AI/ML engineers live in Python. The TypeScript SDK
unlocks Node/browser; this Python SDK unlocks every regulated-AI
auditor, every model-eval pipeline, every data-science notebook
that wants to check "did this receipt actually verify, or is it
just claimed to verify?"

## Install

```bash
pip install sovereign-matrix-verifiable-receipts
```

Requires Python 3.10+ and one dependency: [`cryptography`](https://pypi.org/project/cryptography/)
for Ed25519 verification (`from cryptography.hazmat.primitives.asymmetric.ed25519`).

Post-quantum (ML-DSA-65) verification is _not_ included in v0.1 of the
Python SDK — the post-quantum lift requires
[`pyspx`](https://pypi.org/project/PySPX/) or
[`liboqs-python`](https://github.com/open-quantum-safe/liboqs-python),
both of which require a system build of liboqs. Ed25519 (v2) covers
the ~99% case for 2026 verification needs. ML-DSA support lands in
v0.2 once we standardize on a pure-Python backend.

## Quick start — verify a VAOS 2.0 receipt

```python
from sovereign_matrix.verifiable_receipts import verify_v2_receipt

# The Ed25519 public key, fetched once and cached.
# Available at https://sovereignmatrix.agency/.well-known/sovereign-receipts/ed25519.pem
PUBLIC_KEY_PEM = open("./ed25519.pem", "rb").read()

receipt = {
    "verdictId": "v_01HXXXX",
    "overall": "pass",
    "rules": [{"ruleId": "hipaa-ssn-block", "verdict": "pass", "durationMs": 2}],
    "totalMs": 4,
    "issuedAt": "2026-05-18T11:22:33.456Z",
    "canonical": '{"verdictId":"v_01HXXXX",...}',
    "contentHash": "sha256:abc...",
    "signature": "v2=base64encodedsignature==",
}

result = verify_v2_receipt(receipt, PUBLIC_KEY_PEM)
print(result.ok)        # True | False
print(result.reason)    # None | "signature mismatch" | "wrong key" | ...
```

## Quick start — verify a transparency-log inclusion proof

```python
from sovereign_matrix.verifiable_receipts import verify_inclusion_proof

# Fetched from /api/transparency/proof?leaf=<hex>
proof = {
    "leafIndex": 42,
    "treeSize": 100,
    "auditPath": ["aa11...", "bb22...", "cc33..."],
}
root_hash_hex = "deadbeef..."  # from /api/transparency/sth
leaf_hash_hex = "f00f00..."    # what you're proving inclusion of

ok = verify_inclusion_proof(proof, leaf_hash_hex, root_hash_hex)
print(ok)  # True if leaf provably appears in the tree
```

## CLI (planned for v0.2)

```bash
# Verify any signed VAOS receipt from stdin or file
python -m sovereign_matrix.verifiable_receipts verify \
  --receipt ./receipt.json \
  --pubkey ./ed25519.pem
```

## License

Apache 2.0 © Sovereign Matrix.

Use it. Fork it. Embed it in your audit pipeline. If you find a bug
in the verification math, report to `security@sovereignmatrix.agency`
before public disclosure.
