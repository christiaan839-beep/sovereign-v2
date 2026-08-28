# @sovereign-matrix/gdpr-dpia

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

**GDPR Article 35 DPIA + Article 30 RoPA exporter.** Takes operator-
declared processing activities + a VAOS receipt set and emits a
DPO-ready Data Protection Impact Assessment + Records of Processing
Activities report.

## Why this exists

Article 35 GDPR requires controllers to carry out a DPIA prior to
any processing "likely to result in a high risk to the rights and
freedoms of natural persons". The EDPB has classified large-scale
AI processing as falling under Article 35(3)(c). Article 30 RoPA
is mandatory for almost every controller and processor.

Closed-source vendors (OneTrust, TrustArc, BigID) charge $10-100K/year
for the equivalent. This is the Apache-2.0 OSS implementation.

## Install

```bash
npm install @sovereign-matrix/gdpr-dpia @sovereign-matrix/verifiable-receipts
```

## Quick start

```ts
import { buildDpia, toMarkdown, toJSON } from "@sovereign-matrix/gdpr-dpia";

const report = buildDpia({
  controller: {
    name: "Acme Health AI Ltd",
    address: "Königsallee 1, Düsseldorf, Germany",
    email: "privacy@acmehealth.example",
    dpoName: "Dr. Anna Müller",
    dpoEmail: "dpo@acmehealth.example",
  },
  activities: [
    {
      id: "diag-triage",
      name: "AI-Assisted Diagnostic Triage",
      purpose: "Real-time triage recommendations to clinicians.",
      dataSubjectCategories: ["patients", "ED staff"],
      dataCategories: ["demographics", "vital signs", "symptoms"],
      specialCategories: ["health data (Art. 9(1)(h))"],
      recipients: ["internal clinicians"],
      retention: "90 days after discharge",
      securityMeasures: ["AES-256-GCM", "TLS 1.3", "RBAC + audit log"],
      legalBasis: "vital-interests",
    },
  ],
  risks: {
    "diag-triage": {
      necessityProportionality:
        "Triage decisions save minutes that save lives. No less-intrusive alternative meets the latency budget.",
      risks: [
        {
          description: "Unauthorized internal access to patient symptom data.",
          likelihood: "low",
          severity: "high",
        },
      ],
      mitigations: [
        {
          description: "AES-256-GCM at rest, TLS 1.3 in transit.",
          evidencePackPrefixes: ["gdpr-art-32", "encryption"],
        },
        {
          description: "RBAC + immutable audit log of every access.",
          evidencePackPrefixes: ["soc2-cc6", "rbac"],
        },
      ],
      residualRisk: "low",
      priorConsultationRequired: false,
    },
  },
  receipts, // VAOS receipts
});

import { writeFileSync } from "node:fs";
writeFileSync("./dpia-2026q2.md", toMarkdown(report));
writeFileSync("./dpia-2026q2.json", toJSON(report));
```

## What gets auto-populated vs operator-authored

| Field                         | How                                                         |
| ----------------------------- | ----------------------------------------------------------- |
| Controller identity           | Operator-supplied                                           |
| Processing activities (RoPA)  | Operator-declared per Article 30(1)                         |
| Risk assessment               | Operator-authored per activity                              |
| **Mitigation evidence count** | ✅ Derived from receipt pack-prefixes                       |
| **Reporting window**          | ✅ Derived from receipt timestamps                          |
| **Summary statistics**        | ✅ Derived (high-risk count, transfers, special categories) |
| Prior-consultation flag       | Operator or auto-flagged if no risk provided                |

## Fail-loud auto-flags

Following the same fail-loud pattern as the other Sovereign Matrix
exporters:

1. **Unknown activity ids** in the `risks` map throw with the list of
   valid ids — typoed ids never silently no-op.
2. **Activities without risk assessment** are auto-flagged as
   **residual risk: high** + **prior consultation required: true**.
   The operator MUST fill in a risk assessment or accept the
   pessimistic default.

## Article 35 vs Article 30

The exporter ships BOTH in one report because in practice they're
prepared together:

- **Article 30 (RoPA)** is the foundation — every processing activity
  must be documented regardless of risk level.
- **Article 35 (DPIA)** layers on top — only required for high-risk
  activities, but the operator usually does it for every activity
  defensively.

The output Markdown puts RoPA first (the comprehensive list), then
DPIA (the risk lens over the same activities).

## Sibling packages — the regulatory full deck

- `@sovereign-matrix/verifiable-receipts` — receipt primitive
- `@sovereign-matrix/annex-iv` — EU AI Act
- `@sovereign-matrix/iso-42001` — AIMS
- `@sovereign-matrix/compliance` — SOC 2, ISO 42001, NIST AI RMF, HIPAA, EU CRA
- `@sovereign-matrix/gdpr-dpia` — **this** (EU privacy)

## License

Apache 2.0 © Sovereign Matrix.
