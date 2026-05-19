# Changelog

All notable changes to `@sovereign-matrix/annex-iv` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] — 2026-05-19

Initial release. EU AI Act Annex IV technical-documentation exporter.

First-of-its-kind Apache 2.0 OSS — no public OSS tool shipped EU AI Act
Annex IV documentation generation before this. Credo AI / Holistic AI /
IBM watsonx.governance equivalents charge $50K-200K+/year.

### Added

- `buildAnnexIv(opts) → AnnexIvReport` — auto-populates Article 11
  §3 / §4 / §6 / §9 from a VAOS receipt set:
  - §3 Monitoring, functioning and control (verdict counts, block rate,
    agent + pack inventory, sample blocked receipts)
  - §4 Performance metrics (p50 / p99 latency, receipts/day, consistency
    indicator)
  - §6 Lifecycle changes (first / latest receipt, distinct agents + packs)
  - §9 Post-market monitoring (anchored count, anomalies, operator actions)
- §1 / §2 / §5 / §7 / §8 emit as operator-authored stubs with regulation-
  clause schema hints citing Article 11 + Annex IV + Article 9 + Article 47.
- `toMarkdown(report)` — regulator-readable, audit-archive friendly.
- `toJSON(report)` — schema-versioned `vaos-annex-iv-v1`, ingestible by
  procurement tools.

### Peer dependencies

- `@sovereign-matrix/verifiable-receipts >= 0.3.0`

### Documentation

- README mapping every section to its derivation source.
- 20 vitest cases covering arithmetic + edge cases + Markdown structure.

### Regulatory context

EU AI Act Article 6 high-risk enforcement: **2026-08-02**.
