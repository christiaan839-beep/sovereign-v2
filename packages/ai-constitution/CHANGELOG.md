# Changelog

All notable changes to `@sovereign-matrix/ai-constitution` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] — 2026-05-19

Initial release. **Genuinely new OSS primitive**: cryptographically-anchored
AI constitutions.

### What this is

Anthropic ships Constitutional AI as a _training_ methodology; this package
ships it as an _inference-time_ cryptographic commitment. The two compose —
a trained-on-constitution model + cryptographically-bound receipts = the
strongest currently-available accountability primitive for autonomous agents.

### Added

- `buildConstitution(opts) → SignedConstitution` — content-addressed
  (SHA-256) signed constitution. Throws on duplicate article ids.
- `verifyConstitutionIntegrity(c) → boolean` — re-derives the hash from
  the canonical projection; returns false if any field was tampered with
  after signing.
- `auditAgainstConstitution(opts) → AuditReport` — surfaces every
  receipt that violates a constitutional article, ranked by severity:
  - **blocking** — the receipt's `overall` MUST be `block`
  - **warning** — the receipt is flagged in the audit
  - **advisory** — recorded but no enforcement
- Optional Ed25519 signature over the constitution hash for non-repudiation.
- Operator-defined article severity + measurable conditions (Guardian-pack
  rule references).
- Receipt → constitution binding via `receipt.constitutionHash` matching
  the SHA-256 of the canonical projection.
- `toMarkdown(audit)` — DPO / court / regulator / insurance binder ready.
- `toJSON(audit)` — schema `vaos-constitution-audit-v1`.

### Peer dependencies

- `@sovereign-matrix/verifiable-receipts >= 0.3.0`

### Documentation

- README with healthcare-AI 5-article worked example + AGI/ASI safety framing.
- 21 vitest cases covering canonical determinism, tamper detection,
  multi-article violation auditing, cross-constitution receipt rejection.

### AGI/ASI safety implication

When autonomous agents become more capable, _"did the agent follow the
rules?"_ becomes the central accountability question. This package makes
that question **cryptographically answerable** — content-addressed
(no retroactive policy rewrites), post-quantum-signed (FIPS 204 alongside
Ed25519), byte-deterministic auditing (any party with the constitution +
receipts can verify).

In a post-AGI world, this is the closest cryptographic analogue to
Asimov's Laws — except enforceable.
