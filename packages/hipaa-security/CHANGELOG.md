# Changelog

All notable changes to `@sovereign-matrix/hipaa-security` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] — 2026-05-19

Initial release. HIPAA Security Rule (45 CFR § 164.308-318) evidence-binder
exporter.

### Added

- `buildHipaaSecurity(opts) → HipaaReport` — full implementation-spec
  catalog across the 5 Security Rule categories:
  - **Administrative safeguards** (§ 164.308): risk analysis, workforce
    security, training, contingency, evaluation, incident response, BCP/DR
  - **Physical safeguards** (§ 164.310): facility access, workstation use,
    device + media controls, disposal, re-use
  - **Technical safeguards** (§ 164.312): access control, unique user ID,
    automatic logoff, encryption, audit controls, integrity, authentication,
    transmission security
  - **Organizational** (§ 164.314): business associate contracts, group
    health plans
  - **Policies + Documentation** (§ 164.316): 6-year retention requirement
- Classification per spec: REQUIRED vs ADDRESSABLE (not "optional").
- **Open findings**: REQUIRED specs with zero receipt evidence + no
  operator note — surfaced at the top of the binder (this is what OCR
  Phase 2 auditors read first).
- Per-spec status taxonomy: implemented / alternative-implemented /
  not-implemented / not-applicable.
- Fail-loud on unknown spec ids in `implementationStatus`.
- `toMarkdown(report)` / `toJSON(report)` — schema `vaos-hipaa-security-v1`.

### Peer dependencies

- `@sovereign-matrix/verifiable-receipts >= 0.3.0`

### Documentation

- README with business-associate worked example + alternative-measure pattern
  for ADDRESSABLE specs.
- 13 vitest cases.

### Competitive context

HITRUST / Compliancy Group / Accountable HQ charge $20K-100K+/year.
Enforced by HHS OCR since 2003.
