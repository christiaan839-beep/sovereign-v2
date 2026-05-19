# @sovereign-matrix/soc2-evidence

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

**SOC 2 Trust Service Criteria evidence-binder exporter.** Takes a
set of VAOS Guardian receipts and emits the auditor-ready evidence
package mapped to AICPA TSC 2017 (CC1-CC9 + A1 + PI1 + C1 + P-series).

## Why this exists

A SOC 2 Type II audit verifies that controls operated effectively
over a 6-12 month period. The auditor needs evidence of each
control's operation throughout the audit window — and receipts are
perfect evidence artifacts: cryptographically signed, timestamped,
tamper-evident, auditor-reproducible.

Vanta and Drata charge $5-50K/year for the equivalent. This is
Apache 2.0.

## Install

```bash
npm install @sovereign-matrix/soc2-evidence @sovereign-matrix/verifiable-receipts
```

## Quick start

```ts
import {
  buildSoc2Report,
  toMarkdown,
  toJSON,
} from "@sovereign-matrix/soc2-evidence";

const report = buildSoc2Report({
  scope: {
    organizationName: "Acme AI Operations Ltd",
    auditPeriodStart: "2026-01-01T00:00:00Z",
    auditPeriodEnd: "2026-12-31T23:59:59Z",
    inScope: [
      "security",
      "availability",
      "confidentiality",
      "processing-integrity",
    ],
    serviceAuditor: "BDO USA LLP",
    servicesDescription:
      "AI-powered loan-underwriting platform delivering automated decisions.",
  },
  receipts, // VAOS receipts over the audit period
  controlOwners: {
    "CC6.1": "Sarah Chen, Director of Security",
    "CC7.4": "Incident Response Team Lead",
    "CC8.1": "VP Engineering",
    "A1.1": "Director of Platform Engineering",
  },
  coverageThresholdDays: 30, // flag criteria with < 30 days of evidence
});

import { writeFileSync } from "node:fs";
writeFileSync("./soc2-binder-2026.md", toMarkdown(report));
writeFileSync("./soc2-binder-2026.json", toJSON(report));
```

## The five TSC categories

| Category                 | Code        | Required? | What it covers                                                                         |
| ------------------------ | ----------- | --------- | -------------------------------------------------------------------------------------- |
| **Security**             | CC1-CC9     | ✅ Always | Control environment, access controls, monitoring, change management, incident response |
| **Availability**         | A1.1-A1.3   | Optional  | Capacity, environmental protection, recovery testing                                   |
| **Processing Integrity** | PI1.1-PI1.5 | Optional  | System inputs, processing, outputs, storage                                            |
| **Confidentiality**      | C1.1-C1.2   | Optional  | Identification and disposal of confidential information                                |
| **Privacy**              | P1-P8       | Optional  | Notice, choice, collection, use, access, disclosure, quality, monitoring               |

Security (CC1-CC9) is always implied even if the operator forgets to
list it.

## Evidence-gap analysis

The exporter flags criteria where:

1. `evidenceCount === 0` (no receipts at all), OR
2. `daysOfCoverage < coverageThresholdDays` (too sparse — a control
   that only fires in 1 month of a 12-month audit is a finding)

These show up in the binder's "Evidence gaps" section. Address them
before the audit kickoff — either expand pack coverage or supplement
with manual evidence.

## Fail-loud on bad input

Same pattern as the sibling regulatory exporters: this package throws
on unknown `controlOwners` keys. A typoed id (`"CC99.99"`) silently
no-opping would produce a wrong-and-confident control matrix —
instead, the error lists every unknown id alongside the valid ids
for fast self-correction.

## Output integrity

Each evidence count is **derived directly from cryptographically-
signed VAOS receipts**. The auditor can re-run the same
`buildSoc2Report` call against the same receipts and get byte-
identical numbers — true period-of-performance evidence.

## Sibling packages — the regulatory hat-trick

- `@sovereign-matrix/verifiable-receipts` — the receipt primitive
- `@sovereign-matrix/annex-iv` — EU AI Act Annex IV exporter
- `@sovereign-matrix/iso-42001` — ISO/IEC 42001 AIMS exporter
- `@sovereign-matrix/nist-ai-rmf` — NIST AI RMF 1.0 profile exporter
- `@sovereign-matrix/openai-receipts` — OpenAI SDK wrapper
- `@sovereign-matrix/anthropic-receipts` — Anthropic SDK wrapper

## License

Apache 2.0 © Sovereign Matrix.
