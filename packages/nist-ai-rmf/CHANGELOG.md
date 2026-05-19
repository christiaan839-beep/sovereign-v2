# Changelog

All notable changes to `@sovereign-matrix/nist-ai-rmf` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] — 2026-05-19

Initial release. NIST AI Risk Management Framework 1.0 profile exporter.
The de-facto US federal AI risk-management standard (NIST AI 100-1, Jan 2023).

### Added

- `buildNistAiRmf(opts) → RmfReport` — produces a Profile-style report
  across the four functions:
  - **GOVERN** (policies, culture, accountability)
  - **MAP** (context + risk identification)
  - **MEASURE** (quantitative + qualitative assessment)
  - **MANAGE** (treatment, monitoring, continuous improvement)
- 47 canonical subcategories from the framework's Playbook.
- 7 trustworthy-AI characteristics from Appendix B tagged per subcategory:
  valid-and-reliable / safe / secure-and-resilient / accountable-and-
  transparent / explainable-and-interpretable / privacy-enhanced /
  fair-with-bias-managed.
- Coverage statistics: per-function + per-characteristic counts.
- Operator-overridable maturity levels (0-4 RMF Playbook scale).
- Operator-authored per-function narratives.
- Fail-loud on unknown ids in `maturityOverrides`.
- `toMarkdown(report)` / `toJSON(report)` — schema `vaos-nist-ai-rmf-v1`.

### Peer dependencies

- `@sovereign-matrix/verifiable-receipts >= 0.3.0`

### Documentation

- README mapping each subcategory to its evidence-pack prefix.
- 17 vitest cases covering aggregation + fail-loud + narrative threading.

### Regulatory context

Adopted into US federal procurement clauses + state-level AI laws
(Colorado SB 24-205, NYC AEDT, etc.).
