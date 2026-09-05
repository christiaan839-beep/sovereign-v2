# @sovereign-matrix/hipaa-security

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

**HIPAA Security Rule (45 CFR § 164.308-318) evidence-binder
exporter.** Takes a set of VAOS receipts and emits the OCR-ready
administrative / physical / technical safeguards report.

## Why this exists

HIPAA's Security Rule has been enforced since 2003 and the OCR
(HHS Office for Civil Rights) regularly audits covered entities and
business associates. Every healthcare AI deployment that touches
ePHI needs evidence of compliance with the implementation
specifications in 45 CFR § 164.308 / .310 / .312 / .314 / .316.

### What these receipts can evidence

A receipt is a Guardian verdict on the wording of one model output. The
Security Rule is mostly about other things: workforce clearance, facility
access, workstation use, device disposal, business-associate contracts. One
of the 52 implementation specifications — Risk Analysis, § 164.308(a)(1)(ii)(A)
— maps to a pack this system can produce. The other 51 render as gaps, for
you to evidence from your own controls.

That is the honest reading, and it is the one an auditor reaches anyway. Use
this binder for the part it covers and for the structure; it is not a
substitute for a Security Rule assessment.

## Install

```bash
npm install @sovereign-matrix/hipaa-security @sovereign-matrix/verifiable-receipts
```

## Quick start

```ts
import {
  buildHipaaSecurity,
  toMarkdown,
  toJSON,
} from "@sovereign-matrix/hipaa-security";

const report = buildHipaaSecurity({
  scope: {
    organizationName: "Acme Health AI Inc.",
    organizationType: "business-associate",
    ephiCategoriesDescription:
      "AI-derived triage recommendations + clinician question/answer logs.",
    auditPeriodStart: "2026-01-01T00:00:00Z",
    auditPeriodEnd: "2026-12-31T23:59:59Z",
    securityOfficial: "Sarah Patel, CISO",
    privacyOfficial: "Dr. James Liu, Privacy Officer",
  },
  receipts, // VAOS receipts over the audit period
  implementationStatus: {
    "164.308(a)(2)": {
      status: "implemented",
      note: "Sarah Patel appointed Security Official 2024-01-15. HR record SEC-2024-001.",
    },
    "164.314(b)(1)": {
      status: "not-applicable",
      note: "Not a group health plan.",
    },
    "164.312(a)(2)(iv)": {
      status: "alternative-implemented",
      note: "Encryption ADDRESSABLE; we implement field-level encryption at the application tier per our risk analysis dated 2026-01-12.",
    },
  },
});

import { writeFileSync } from "node:fs";
writeFileSync("./hipaa-binder-2026.md", toMarkdown(report));
writeFileSync("./hipaa-binder-2026.json", toJSON(report));
```

## The five Security Rule categories

| Section   | Category                        | Covers                                                               |
| --------- | ------------------------------- | -------------------------------------------------------------------- |
| § 164.308 | **Administrative safeguards**   | Risk analysis, workforce security, training, contingency, evaluation |
| § 164.310 | **Physical safeguards**         | Facility access, workstation use, device + media controls            |
| § 164.312 | **Technical safeguards**        | Access control, audit controls, integrity, transmission security     |
| § 164.314 | **Organizational requirements** | Business associate contracts, group health plans                     |
| § 164.316 | **Policies + documentation**    | Policies, 6-year retention, availability, periodic review            |

## Required vs Addressable

The Security Rule classifies each implementation specification as:

- **REQUIRED** — must implement. Period.
- **ADDRESSABLE** — must implement OR document why an alternative
  implementation is appropriate per § 164.306(d). "Addressable" is
  **NOT** "optional".

The exporter tracks the distinction and surfaces REQUIRED specs
without evidence as **findings** that must be addressed before the
audit. ADDRESSABLE specs without evidence are flagged only if the
operator hasn't recorded an alternative-implementation note.

## Open findings

The Findings section in the Markdown output is the FIRST thing an
OCR auditor will read. It lists every REQUIRED specification with
zero receipt evidence AND no operator-supplied implementation note.

To close a finding:

- Implement the control + emit receipts that match the spec's pack
  prefixes (so future audits show evidence), OR
- Add an `implementationStatus` entry with `status: "implemented"`
  and a `note` describing where the evidence lives (HR record, vendor
  contract, policy doc id, etc.)

## Fail-loud on bad input

Same pattern as the other Sovereign Matrix exporters: unknown spec
ids in `implementationStatus` throw with the valid-ids list.

## Sibling packages — the regulatory full deck

- `@sovereign-matrix/verifiable-receipts` — the receipt primitive
- `@sovereign-matrix/annex-iv` — EU AI Act
- `@sovereign-matrix/iso-42001` — AIMS
- `@sovereign-matrix/nist-ai-rmf` — US federal
- `@sovereign-matrix/soc2-evidence` — Trust Service Criteria
- `@sovereign-matrix/gdpr-dpia` — EU privacy
- `@sovereign-matrix/hipaa-security` — **this** (US healthcare)

## License

Apache 2.0 © Sovereign Matrix.
