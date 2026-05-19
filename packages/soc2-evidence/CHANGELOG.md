# Changelog

All notable changes to `@sovereign-matrix/soc2-evidence` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] — 2026-05-19

Initial release. SOC 2 evidence binder exporter mapped to AICPA Trust
Service Criteria (2017).

### Added

- `buildSoc2Report(opts) → Soc2Report` — auditor-ready evidence binder.
- Full TSC catalog across 5 categories:
  - **Security** CC1-CC9 (always required)
  - **Availability** A1.1-A1.3 (opt-in)
  - **Processing Integrity** PI1.1-PI1.5 (opt-in)
  - **Confidentiality** C1.1-C1.2 (opt-in)
  - **Privacy** P1-P8 (opt-in)
- Per-criterion **days-of-coverage** metric — flags criteria with sparse
  evidence (default threshold: 30 days) BEFORE the engagement kickoff so
  the operator can supplement before findings land in the audit report.
- Per-criterion **control owner** via `controlOwners` map (RACI).
- Evidence gap analysis surfaced at the top of the binder.
- Fail-loud on unknown criterion ids.
- `toMarkdown(report)` — binder-style for the kickoff meeting.
- `toJSON(report)` — schema `vaos-soc2-evidence-v1`, PBC-platform ingestible.

### Peer dependencies

- `@sovereign-matrix/verifiable-receipts >= 0.3.0`

### Documentation

- README with category opt-in patterns + 12-month audit window worked example.
- 19 vitest cases.

### Competitive context

Vanta / Drata / Secureframe charge $5K-50K/year. This is the Apache 2.0 OSS
equivalent for the _evidence generation_ layer — operators still bring their
own auditor + certification process.
