# sovereign-matrix verifiable-receipts (Go)

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Go 1.22+](https://img.shields.io/badge/go-1.22+-blue.svg)](https://go.dev/)

**Pure-Go verifier for VAOS receipts** — the Go counterpart to
[`@sovereign-matrix/verifiable-receipts`](https://www.npmjs.com/package/@sovereign-matrix/verifiable-receipts)
(TypeScript) and `sovereign-matrix-verifiable-receipts` (Python).

Verify Ed25519-signed receipts (VAOS 2.0), check Guardian attestation
envelopes, and walk RFC 9162 transparency-log inclusion proofs from
any Go process. Zero external dependencies — pure Go stdlib
(`crypto/ed25519`, `crypto/sha256`).

Built for cloud / SRE / regulator tooling where Go is the lingua
franca and pulling in a Node toolchain just to verify a receipt is
absurd.

## Install

```bash
go get github.com/christiaan839-beep/sovereign-v2/packages/verifiable-receipts-go@latest
```

## Quick start — verify a VAOS 2.0 receipt

```go
package main

import (
    "fmt"
    "os"

    vaos "github.com/christiaan839-beep/sovereign-v2/packages/verifiable-receipts-go"
)

func main() {
    pemBytes, _ := os.ReadFile("./ed25519.pem")
    pubKey, _ := vaos.LoadEd25519PublicKeyFromPEM(pemBytes)

    receipt := vaos.Receipt{
        Canonical:   `{"verdictId":"v_xxx",...}`,
        ContentHash: "sha256:abc...",
        Signature:   "v2=base64encodedsig==",
    }

    result := vaos.VerifyV2Receipt(receipt, pubKey)
    fmt.Println(result.OK)      // true | false
    fmt.Println(result.Reason)  // "" | "signature does not verify under the supplied public key" | ...
}
```

## Quick start — verify a transparency-log inclusion proof

```go
proof := vaos.InclusionProof{
    LeafIndex: 42,
    TreeSize:  100,
    AuditPath: []string{"aa11...", "bb22...", "cc33..."},
}

ok := vaos.VerifyInclusionProof(proof, leafHashHex, rootHashHex)
fmt.Println(ok) // true if leaf provably appears in the tree
```

## What this package is NOT

- **Not an issuer.** Issuer-side signing stays TypeScript-canonical
  (`@sovereign-matrix/verifiable-receipts`). Verification is symmetric;
  any language can re-check a TypeScript-signed receipt.
- **Not a ML-DSA-65 verifier in v0.1.** Post-quantum verification
  requires a non-stdlib dependency (`cloudflare/circl` ships Go-native
  Dilithium); that lands in v0.2.

## License

Apache 2.0 © Sovereign Matrix.

Bug in verification math? Report to `security@sovereignmatrix.agency`
before public disclosure.
