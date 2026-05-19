# @sovereign-matrix/iso-42001

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

**ISO/IEC 42001:2023 AI management system (AIMS) exporter.** Takes a
set of VAOS Guardian receipts and emits the auditor-ready clause
4-10 + Annex A reference-controls report (Markdown + JSON).

## Why this exists

ISO/IEC 42001:2023 is the world's first AI-management-system
standard. Most organizations seeking AIMS certification have to
assemble clause 9 (performance evaluation) + Annex A control
evidence by hand. Closed-source GRC vendors (Credo AI / Holistic
AI / IBM watsonx.governance) ship this for $50K-200K+/year.

This package consumes VAOS receipts and assembles the §7 / §8 / §9 /
§10 clauses + the Annex A control matrix (the parts the receipt
layer can mechanically populate); §4 / §5 / §6 are operator-authored
stubs with ISO-clause-citing schema hints.

## Install

```bash
npm install @sovereign-matrix/iso-42001 @sovereign-matrix/verifiable-receipts
```

## Quick start

```ts
import { buildIso42001, toMarkdown, toJSON } from "@sovereign-matrix/iso-42001";

// `receipts` is the array of signed Guardian attestations from your
// production agent runs over the past 12 months (typical AIMS
// surveillance audit window).
const report = buildIso42001({
  scope: {
    organizationName: "Acme AI Operations Ltd",
    scopeStatement:
      "All production AI agents serving consumer loan applicants in the EU.",
    aiSystemRole: "provider",
    certificationBody: "BSI",
    lastInternalAudit: "2026-03-15T00:00:00Z",
    nextManagementReview: "2026-09-15T00:00:00Z",
  },
  receipts,
  retentionDays: 365,
  operatorActions: [
    "Tightened SR 11-7 model risk gate (2026-04-12).",
    "Added FAIR Act pack to underwriting flow (2026-04-21).",
  ],
});

// Auditor-ready Markdown
import { writeFileSync } from "node:fs";
writeFileSync("./iso-42001-2026.md", toMarkdown(report));

// GRC-tool ingestible JSON
writeFileSync("./iso-42001-2026.json", toJSON(report));
```

## What gets auto-populated vs operator-authored

| Clause                      | How                           | Source                                                              |
| --------------------------- | ----------------------------- | ------------------------------------------------------------------- |
| § 4 Context of organization | **OPERATOR-AUTHORED** stub    | Schema hint cites § 4.1-4.4                                         |
| § 5 Leadership              | **OPERATOR-AUTHORED** stub    | Schema hint cites § 5.1-5.3 (incl. AI policy)                       |
| § 6 Planning                | **OPERATOR-AUTHORED** stub    | Schema hint cites § 6.1-6.3 (incl. statement of applicability)      |
| § 7 Support                 | ✅ DERIVED FROM RECEIPTS      | Documented-information count, retention window, integrity mechanism |
| § 8 Operation               | ✅ DERIVED FROM RECEIPTS      | Verdict mix, block-rate, agent + pack inventory                     |
| § 9 Performance evaluation  | ✅ DERIVED FROM RECEIPTS      | p50/p99 latency, receipts/day, anomaly count                        |
| § 10 Improvement            | ✅ DERIVED FROM RECEIPTS      | Operator actions, distinct agents + packs over window               |
| Annex A reference controls  | ✅ DERIVED FROM PACK COVERAGE | 38 controls (A.2.2 – A.10.4), evidence count via pack-prefix match  |

## Annex A control catalog

The exporter ships the canonical 38-control catalog from ISO/IEC
42001:2023 Annex A, grouped by control objective:

- **A.2** Policies related to AI (3 controls)
- **A.3** Internal organization (2 controls)
- **A.4** Resources for AI systems (5 controls)
- **A.5** Assessing impacts of AI systems (4 controls)
- **A.6** AI system life cycle (9 controls)
- **A.7** Data for AI systems (5 controls)
- **A.8** Information for interested parties (4 controls)
- **A.9** Use of AI systems (3 controls)
- **A.10** Third-party and customer relationships (3 controls)

Each control maps to one or more Guardian-pack prefixes. When a
receipt's `pack` field starts with a mapped prefix, it counts as
evidence for that control. Override applicability per your
statement of applicability (§ 6.1.3):

```ts
buildIso42001({
  scope,
  receipts,
  applicabilityOverrides: {
    "A.3.3": false, // Reporting of concerns — handled outside this AIMS scope
    "A.10.3": false, // Suppliers — no third-party AI in scope
  },
});
```

## API

### `buildIso42001(opts) → Iso42001Report`

Build the structured report from a receipt set.

### `toMarkdown(report) → string`

Auditor-readable, archive-friendly.

### `toJSON(report) → string`

Schema-versioned (`schema: "vaos-iso-42001-v1"`), ingestible by GRC tools.

## Output integrity

The clause 7-10 + Annex A evidence counts are **derived directly
from cryptographically-signed VAOS receipts**. Every claim in the
report is reproducible from the receipt set — an external auditor
can re-run the same buildIso42001 call against the same receipts
and get byte-identical numbers.

## Sibling packages

- `@sovereign-matrix/verifiable-receipts` — the receipt primitive
- `@sovereign-matrix/annex-iv` — EU AI Act technical documentation exporter
- `@sovereign-matrix/openai-receipts` — OpenAI SDK wrapper
- `@sovereign-matrix/anthropic-receipts` — Anthropic SDK wrapper
- `@sovereign-matrix/google-receipts` — Google Gemini SDK wrapper
- `@sovereign-matrix/ai-sdk-receipts` — Vercel AI SDK universal wrapper

## License

Apache 2.0 © Sovereign Matrix.
