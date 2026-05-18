module github.com/christiaan839-beep/sovereign-v2/packages/verifiable-receipts-go

go 1.22

// Pure-stdlib Ed25519 + RFC 9162 inclusion-proof verifier. Zero
// external dependencies — verifier-side is symmetric, so this
// module re-derives the same canonical projection used by the
// TypeScript canonical implementation and verifies signatures
// independently.
