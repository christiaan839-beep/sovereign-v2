# Changelog

All notable changes to `@sovereign-matrix/eu-cra` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] — 2026-05-19

Initial release. EU Cyber Resilience Act (Regulation (EU) 2024/2847)
compliance evidence exporter for products with digital elements — including
AI software.

### Added

- `buildEuCra(opts) → CraReport` — full Annex I + Article 13/14 catalog:
  - **Annex I Part I**: 13 essential cybersecurity requirements
    (secure-by-default, encryption, integrity, availability,
    attack-surface minimisation, logging, secure deletion, etc.)
  - **Annex I Part II**: 8 vulnerability-handling requirements
    (SBOM, patch management, regular testing, coordinated disclosure,
    secure update distribution)
  - **Article 14**: post-market obligations (24h ENISA notification of
    actively exploited vulnerabilities + severe incidents + user comms)
  - **Article 13 + Annex VII**: technical documentation, cybersecurity
    risk assessment, EU declaration of conformity, CE marking
- **Open findings** for REQUIRED items without evidence + no operator note.
- Per-requirement status taxonomy: compliant / alternative-measure /
  not-applicable / open.
- Operator-declared residual risks list per Article 13(1)(b).
- Fail-loud on unknown requirement ids.
- `toMarkdown(report)` / `toJSON(report)` — schema `vaos-eu-cra-v1`.

### Peer dependencies

- `@sovereign-matrix/verifiable-receipts >= 0.3.0`

### Documentation

- README with pack-prefix vocabulary table mapping CRA reqs to Guardian packs.
- 12 vitest cases.

### Regulatory timeline

- **In force**: 2024-12-10
- **Vulnerability reporting obligations**: 2026-09-11 (T-minus ~16 months
  from release)
- **Full obligations**: 2027-12-11
- Applies to ALL products with digital elements on the EU market, including
  AI software.
