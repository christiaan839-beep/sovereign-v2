# Changelog

All notable changes to `@sovereign-matrix/iso-42001` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] — 2026-05-19

Initial release. ISO/IEC 42001:2023 AI management system (AIMS) exporter.

### Added

- `buildIso42001(opts) → Iso42001Report` — auto-populates clauses
  7-10 + the Annex A 38-control matrix from VAOS receipts:
  - Clause 7 Support (§ 7.5 documented information)
  - Clause 8 Operation
  - Clause 9 Performance evaluation
  - Clause 10 Improvement
  - Annex A: 38 reference controls (A.2.2 — A.10.4) with receipt-derived
    evidence count via pack-prefix match
- Clauses 4 / 5 / 6 emit as operator-authored stubs with ISO-clause-citing
  schema hints.
- Operator-overridable applicability map per § 6.1.3 statement of applicability.
- Fail-loud on unknown keys in `applicabilityOverrides` — typoed control ids
  throw with the valid-ids list rather than silently no-opping.
- `toMarkdown(report)` — auditor-readable.
- `toJSON(report)` — schema-versioned `vaos-iso-42001-v1`.

### Peer dependencies

- `@sovereign-matrix/verifiable-receipts >= 0.3.0`

### Documentation

- README with worked example + applicability override pattern.
- 27 vitest cases (24 base + 3 fail-loud validation).
