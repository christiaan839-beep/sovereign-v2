# Changelog

All notable changes to `@sovereign-matrix/zk-compliance` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] — 2026-05-19

Initial release. **Genuinely new OSS primitive**: zero-knowledge
compliance proofs over VAOS receipt sets.

### What this is

Prove "Agent X complied with policy Y over period Z" to a regulator
without revealing the underlying receipts. The verifier confirms the
math; the receipts stay with the operator.

### Added

- `buildZkProof(opts) → ZkProof` — content-addressed proof envelope.
- `verifyZkProof(proof) → VerificationResult` — independent verification
  that runs WITHOUT the operator's receipt set.
- 6 claim kinds covering every Sovereign Matrix exporter framework:
  - `block-rate-below-threshold` (Annex IV §3, SOC 2 CC7.2)
  - `pii-leak-rate-zero` (GDPR Art. 32, HIPAA § 164.312)
  - `anomaly-count-below-threshold` (NIST AI RMF MEASURE-2.6)
  - `agent-deactivation-honoured` (NIST AI RMF MANAGE-2.4)
  - `constitution-articles-honoured` (`@sovereign-matrix/ai-constitution`)
  - `framework-coverage-above-threshold` (SOC 2 days-of-coverage)
- Computation commitment: SHA-256 binds (claim + receipt-commitment +
  aggregate) so operators cannot substitute aggregates across claims.
- Tampering detection: verifier flags `computationCommitment`,
  `verdict`, and `schema` mismatches with specific reason strings.
- Window filtering: receipts outside the operator-stated audit window
  are excluded from BOTH the commitment AND the aggregate.
- `toMarkdown(proof)` — regulator-readable proof document.
- `toJSON(proof)` — schema-versioned `vaos-zk-compliance-v1`.

### v0.1 scope vs. v0.2 plan

v0.1 ships **selective-disclosure** based on SHA-256 Merkle commitment

- revealed aggregate. The verifier learns the receipt count and one
  aggregate; nothing about individual receipts.

v0.2 will integrate a circuit library (Halo2 / Plonky3 / risc0) for
**full zero-knowledge** where the verifier learns NOTHING about
receipts at all — not even the count.

The wire format (`vaos-zk-compliance-v1`) is designed to upgrade
without break — v0.1 proofs verify under v0.2 verifiers, and v0.2
proofs gracefully downgrade with a warning.

### Peer dependencies

- `@sovereign-matrix/verifiable-receipts >= 0.3.0`

### Documentation

- README with 6 claim-kind worked examples + privacy-guarantee matrix
  - production-hardening checklist + 5 buyer-urgency use cases.
- 22 vitest cases covering every claim kind + tampering detection +
  schema validation + window filtering + empty-set edge cases.

### Why this matters

Classified deployments (defense / intelligence), HIPAA-covered AI,
SR 11-7 model risk, AI-E&O insurance underwriting, and multi-
jurisdiction enterprise AI all want to prove safety properties to
oversight bodies WITHOUT leaking operational data. This is the only
Apache-2.0 OSS that makes that cryptographically defensible.
