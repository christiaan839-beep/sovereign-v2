# Changelog

All notable changes to `@sovereign-matrix/verifiable-receipts` are documented
here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] — 2026-05-19

The version number now reflects what is actually in the package. The
public surface area has grown well past `0.1.0`; this release bumps to
`0.3.0` to align with every workspace consumer that already declares
`@sovereign-matrix/verifiable-receipts: ">=0.3.0"` as a peer dependency.

### Added

- **VAOS-TRS 1.0** — Threshold Receipt Signatures (m-of-n cosigning) with
  canonical-binding via `trsSigningBytes(canonical, threshold, authorized)`
  so cosigner signatures cannot be reused across different policies.
- **VAOS-RSA 1.0** — Receipt Streaming Attestation, Merkle-rooted, for
  multi-chunk streaming outputs.
- **VAPT 1.0** — Verifiable Agentic Payment Tokens.
- **Receipt-Audit DSL** — SQL-like queries over signed receipt sets.
- **Anomaly detection** — statistical outlier detection over block-rate
  spikes, rule-failure drift, volume bursts, quiet periods.
- **C2PA bridge** — content provenance interop for image/video outputs.
- **Witness federation primitive** — independent third-party witnessing.
- **RFC 9162 transparency log** — inner/border bit-decomposition,
  byte-deterministic across the TS / Python / Go ports.
- **42 Guardian rule packs** across 7 continents: HIPAA, SR 11-7,
  EU AI Act, CFPB, NAIC, FDA SaMD, FERPA, NYC AEDT, Colorado SB 24-205,
  NIST AI RMF, OWASP Agentic Top 10, MCP governance, ISO/IEC 42001, and 30 more.

### Changed

- Subpath exports (`./transparency`, `./log-store`, `./packs`, etc.)
  now resolve through the package `exports` map.
- The `prepare` lifecycle script builds `dist/` automatically when the
  workspace is installed without it, so monorepo consumers don't have
  to remember to run `npm run build` first.

### Fixed

- Cross-language inclusion proofs: TS / Python / Go now produce
  byte-identical witnesses for the same Merkle leaf, including the
  previously-failing `idx=6` case in 7-leaf trees.

## [0.1.0] — initial release

- Ed25519 + ML-DSA-65 dual-signing
- Guardian verdict envelopes
- ZIP-bundle export with signed manifest
- Post-quantum forward-secure verification
