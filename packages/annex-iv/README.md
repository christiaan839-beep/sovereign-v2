# @sovereign-matrix/annex-iv

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

**EU AI Act Annex IV technical-documentation exporter.** Takes a set
of VAOS Guardian receipts and emits the Article 11 + Annex IV
regulator-ready report (Markdown + JSON).

## Why this exists

Article 11 of the EU AI Act (Reg. 2024/1689) requires every provider
of a high-risk AI system to maintain technical documentation in the
format specified by Annex IV. **No public OSS tool ships this**
— Credo AI / Holistic AI / IBM watsonx.governance all charge
$50K-200K+/year for closed-source equivalents.

This package consumes VAOS receipts and assembles the §3 / §4 / §6 /
§9 sections (the ones the receipt layer can mechanically populate);
§1 / §2 / §5 / §7 / §8 are operator-authored stubs the exporter
emits with regulatory-clause schemaHints for the human author.

## Install

```bash
npm install @sovereign-matrix/annex-iv @sovereign-matrix/verifiable-receipts
```

## Quick start

```ts
import { buildAnnexIv, toMarkdown, toJSON } from "@sovereign-matrix/annex-iv";

// `receipts` is the array of signed Guardian attestations from your
// production agent runs over the past 90 days.
const report = buildAnnexIv({
  system: {
    name: "Acme Loan Underwriting AI",
    identifier: "acme-loan-2026",
    riskCategory: "high-risk",
    provider: "Acme Financial AI Ltd",
    authorisedRepresentativeEU: "Acme EU GmbH",
    intendedPurpose:
      "Automated decisioning for consumer loan applications EUR 1k-50k.",
    annexIIIUseCase: "creditworthiness assessment",
    placedOnMarketAt: "2026-01-15T00:00:00Z",
  },
  receipts,
  sampleBlockedReceipts: 5,
  nextReportDue: "2026-08-15T00:00:00Z",
  operatorActions: ["Tightened SR 11-7 model risk gate (2026-04-12)."],
});

// Regulator-ready Markdown
import { writeFileSync } from "node:fs";
writeFileSync("./annex-iv-q2-2026.md", toMarkdown(report));

// Procurement-tool ingestible JSON
writeFileSync("./annex-iv-q2-2026.json", toJSON(report));
```

## What gets auto-populated vs operator-authored

| Section                                | How                            | Source                                                            |
| -------------------------------------- | ------------------------------ | ----------------------------------------------------------------- |
| §0 System metadata                     | Operator-supplied at call time | `SystemDescription`                                               |
| §1 General description                 | **OPERATOR-AUTHORED** stub     | Schema hint cites Article 11                                      |
| §2 Development process                 | **OPERATOR-AUTHORED** stub     | Schema hint cites Annex IV §2                                     |
| §3 Monitoring, functioning and control | ✅ DERIVED FROM RECEIPTS       | Verdict counts, block-rate, agent + pack inventory, sample blocks |
| §4 Performance metrics                 | ✅ DERIVED FROM RECEIPTS       | p50/p99 latency, receipts/day, consistency indicator              |
| §5 Risk management system              | **OPERATOR-AUTHORED** stub     | Schema hint cites Article 9                                       |
| §6 Lifecycle changes                   | ✅ DERIVED FROM RECEIPTS       | First/latest receipt, distinct agents + packs                     |
| §7 Harmonised standards                | **OPERATOR-AUTHORED** stub     | Schema hint suggests ISO/IEC 42001 / 23894, IEEE 7001             |
| §8 EU declaration of conformity        | **OPERATOR-AUTHORED** stub     | Schema hint cites Article 47                                      |
| §9 Post-market monitoring              | ✅ DERIVED FROM RECEIPTS       | Anchored count, anomalies, operator actions                       |

## API

### `buildAnnexIv(opts) → AnnexIvReport`

Build the structured report from a receipt set.

### `toMarkdown(report) → string`

Regulator-readable, audit-archive friendly.

### `toJSON(report) → string`

Schema-versioned (`schema: "vaos-annex-iv-v1"`), ingestible by
procurement tools.

## Output integrity

The §3/§4/§6/§9 numbers are **derived directly from
cryptographically-signed VAOS receipts**. Every claim in the report
is reproducible from the receipt set — an external auditor can
re-run the same buildAnnexIv call against the same receipts and
get byte-identical numbers.

## Sibling packages

- `@sovereign-matrix/verifiable-receipts` — the receipt primitive
- `@sovereign-matrix/openai-receipts` — OpenAI SDK wrapper
- `@sovereign-matrix/anthropic-receipts` — Anthropic SDK wrapper
- `@sovereign-matrix/google-receipts` — Google Gemini SDK wrapper
- `@sovereign-matrix/ai-sdk-receipts` — Vercel AI SDK universal wrapper

## License

Apache 2.0 © Sovereign Matrix.
