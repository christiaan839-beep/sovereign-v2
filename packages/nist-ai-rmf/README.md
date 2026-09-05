# @sovereign-matrix/nist-ai-rmf

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

**NIST AI Risk Management Framework 1.0 profile exporter.** Takes a
set of VAOS Guardian receipts and emits the auditor-ready GOVERN /
MAP / MEASURE / MANAGE function report (Markdown + JSON).

## Why this exists

NIST AI RMF 1.0 (NIST AI 100-1, January 2023) is the de-facto US
federal AI risk management standard. Federal procurement clauses,
state legislation, and enterprise risk programs increasingly require
demonstrable RMF alignment.

This is an Apache-2.0 implementation: it projects VAOS receipts onto
the RMF functions, and names a gap where the receipts do not support a
subcategory rather than filling it in.

## Install

```bash
npm install @sovereign-matrix/nist-ai-rmf @sovereign-matrix/verifiable-receipts
```

## Quick start

```ts
import {
  buildNistAiRmf,
  toMarkdown,
  toJSON,
} from "@sovereign-matrix/nist-ai-rmf";

const report = buildNistAiRmf({
  scope: {
    systemName: "Acme Loan Underwriting AI",
    lifecycleStage: "operation",
    organizationalRole: "AI Operator (financial services)",
    profileType: "current",
    intendedUse:
      "Automated decisioning for consumer loan applications EUR 1k-50k.",
    riskTolerance: "medium",
  },
  receipts, // VAOS receipts from your production run
  maturityOverrides: {
    "GOVERN-1.1": 3, // operator self-assessment, 0-4 scale
    "MEASURE-2.7": 2,
  },
  functionNarratives: {
    GOVERN:
      "AI Governance Committee meets quarterly. Chair: CISO. Charter: docs/ai-governance.md.",
  },
});

import { writeFileSync } from "node:fs";
writeFileSync("./rmf-profile-2026q2.md", toMarkdown(report));
writeFileSync("./rmf-profile-2026q2.json", toJSON(report));
```

## What gets auto-populated vs operator-authored

| Field                                          | How                                   |
| ---------------------------------------------- | ------------------------------------- |
| `scope`                                        | Operator-supplied at call time        |
| `reportingWindow.from/to`                      | ✅ Derived from receipts              |
| `subcategories[].evidenceCount`                | ✅ Derived via pack-prefix match      |
| Per-function summary statistics                | ✅ Derived from receipts              |
| Coverage stats (by function/by characteristic) | ✅ Derived from receipts              |
| `subcategories[].maturityLevel`                | **Operator** via `maturityOverrides`  |
| Per-function narrative                         | **Operator** via `functionNarratives` |

## The four RMF functions

- **GOVERN** — policies, processes, accountability that cultivate the
  culture of risk management across the AI lifecycle (e.g. GOVERN-1.1
  "Legal and regulatory requirements involving AI are understood").
- **MAP** — identify the context and the risks that exist in that
  context (e.g. MAP-5.1 "Likelihood and magnitude of each identified
  impact are identified").
- **MEASURE** — quantitative and qualitative assessment of identified
  risks (e.g. MEASURE-2.7 "AI system security and resilience are
  evaluated and documented").
- **MANAGE** — risk treatment, monitoring, and continuous improvement
  (e.g. MANAGE-2.4 "Mechanisms in place to supersede, disengage, or
  deactivate AI systems").

## Trustworthy AI characteristics

Each subcategory is tagged with one of the seven trustworthy-AI
characteristics from NIST AI RMF Appendix B:

- valid-and-reliable
- safe
- secure-and-resilient
- accountable-and-transparent
- explainable-and-interpretable
- privacy-enhanced
- fair-with-bias-managed

The `coverage.byCharacteristic` field tells you which trustworthy-AI
properties your receipt set evidences strongly vs weakly.

## Fail-loud on bad input

Following the same pattern as `@sovereign-matrix/iso-42001`, this
package throws on unknown `maturityOverrides` keys. A typoed id
(`"GOVERN-99.99"`) silently no-opping would produce a wrong-and-
confident regulatory artifact — instead, the error lists every
unknown id alongside the valid ids for fast self-correction.

## Output integrity

Subcategory evidence counts are **derived directly from
cryptographically-signed VAOS receipts**. Every claim in the report
is reproducible from the receipt set — an external auditor can re-run
the same `buildNistAiRmf` call against the same receipts and get
byte-identical numbers.

## Sibling packages

- `@sovereign-matrix/verifiable-receipts` — the receipt primitive
- `@sovereign-matrix/annex-iv` — EU AI Act Annex IV exporter
- `@sovereign-matrix/iso-42001` — ISO/IEC 42001 AIMS exporter
- `@sovereign-matrix/soc2-evidence` — SOC 2 Trust Service Criteria evidence binder
- `@sovereign-matrix/openai-receipts` — OpenAI SDK wrapper
- `@sovereign-matrix/anthropic-receipts` — Anthropic SDK wrapper

## License

Apache 2.0 © Sovereign Matrix.
