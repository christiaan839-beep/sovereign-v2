# Changelog

All notable changes to `@sovereign-matrix/iso-23894` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] — 2026-05-19

Initial release. ISO/IEC 23894:2023 AI risk management exporter — the
AI-specific adaptation of ISO 31000.

### Added

- `buildIso23894(opts) → Iso23894Report` — operator-declared risk
  scenarios scored via the 5×5 likelihood × impact matrix.
- **Inherent risk**: computed from likelihood × impact band (5 levels:
  very-low / low / medium / high / extreme).
- **Residual risk**: inherent attenuated by receipt evidence count:
  10+ receipts → 1 band lower; 100+ → 2 bands lower. Operator-explainable
  arithmetic, no black-box.
- Risk-band aggregation + by-characteristic coverage (shared 7-
  characteristic vocabulary with NIST AI RMF).
- Fail-loud on duplicate scenario ids.
- `toMarkdown(report)` / `toJSON(report)` — schema `vaos-iso-23894-v1`.

### Peer dependencies

- `@sovereign-matrix/verifiable-receipts >= 0.3.0`

### Documentation

- README with worked healthcare-AI risk scenario.
- 13 vitest cases.
