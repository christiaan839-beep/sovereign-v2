# Changelog

All notable changes to `@sovereign-matrix/gdpr-dpia` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] — 2026-05-19

Initial release. GDPR Article 35 DPIA + Article 30 RoPA exporter.

### Added

- `buildDpia(opts) → DpiaReport` — produces both:
  - **Article 30 RoPA**: every processing activity documented per
    Article 30(1) (purpose, data subjects, categories, recipients,
    third-country transfers + safeguards, retention, security measures,
    legal basis under Article 6).
  - **Article 35 DPIA**: risk assessment per activity (necessity +
    proportionality, risks with ENISA likelihood × severity scale,
    mitigations with receipt evidence, residual risk band, Article 36
    prior-consultation flag).
- **Auto-flag** activities without operator risk-assessment as
  high-residual-risk + prior-consultation-required (pessimistic default
  so nothing slips through).
- Fail-loud on unknown activity ids in the `risks` map.
- Summary stats: special-category count (Article 9), third-country
  transfer count, high-risk activities, prior consultations required.
- `toMarkdown(report)` — DPO + supervisory authority readable.
- `toJSON(report)` — schema `vaos-gdpr-dpia-v1`.

### Peer dependencies

- `@sovereign-matrix/verifiable-receipts >= 0.3.0`

### Documentation

- README with healthcare-AI worked example (Article 9(1)(h) special-category
  data + SCCs for US transfers).
- 12 vitest cases.

### Competitive context

OneTrust / TrustArc / BigID charge $10K-100K+/year. This is the Apache 2.0
evidence-generation layer.
