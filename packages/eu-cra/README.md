# @sovereign-matrix/eu-cra

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

**EU Cyber Resilience Act (Regulation (EU) 2024/2847) compliance
evidence exporter for products with digital elements — including AI
software.** Takes a set of VAOS receipts and emits the Annex I + Article 13/14
auditor-ready report.

## Why this matters

The CRA entered into force **10 December 2024**. Most obligations
apply from **11 December 2027**, with vulnerability reporting
obligations applying earlier (**11 September 2026**).

Every product with digital elements placed on the EU market —
including AI/ML software — must meet the Annex I essential
cybersecurity requirements. Closed-source vendors will bundle CRA
compliance into existing SBOM / vulnerability-management platforms
at $30K-150K+/yr. This is the Apache 2.0 OSS implementation.

## Install

```bash
npm install @sovereign-matrix/eu-cra @sovereign-matrix/verifiable-receipts
```

## Quick start

```ts
import { buildEuCra, toMarkdown } from "@sovereign-matrix/eu-cra";

const report = buildEuCra({
  scope: {
    manufacturer: "Acme AI Inc.",
    productName: "Sovereign Receipt Mint",
    productIdentifier: "srm-1.0",
    category: "important-class-II",
    intendedUse:
      "Server-side mint of cryptographically signed receipts for autonomous AI agents.",
    placedOnMarketAt: "2026-06-01T00:00:00Z",
  },
  receipts, // VAOS receipts produced by your CI / production pipelines
  implementationStatus: {
    "AI.TD.4": {
      status: "compliant",
      note: "CE marking affixed to product packaging 2026-06-01.",
    },
    "AI.I.3.h": {
      status: "not-applicable",
      note: "Product does not interact with other devices/networks.",
    },
  },
  residualRisks: [
    "Quantum-computer-led break of ECDSA signatures (5-10 years).",
  ],
});

writeFileSync("./eu-cra-2026.md", toMarkdown(report));
```

## What's covered

|                                                     Section | Requirements                                                                                                                        |
| ----------------------------------------------------------: | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Annex I Part I** (design + cybersecurity risk management) | 13 essential cybersecurity requirements (secure-by-default, encryption, integrity, availability, attack-surface minimisation, etc.) |
|                **Annex I Part II** (vulnerability handling) | 8 requirements (SBOM, patch management, regular testing, coordinated disclosure, secure update distribution)                        |
|                                **Article 14** (post-market) | 24h ENISA notification of actively exploited vulnerabilities + severe incidents + user comms                                        |
|        **Article 13 + Annex VII** (technical documentation) | Tech doc maintenance, risk assessment, EU Declaration of Conformity, CE marking                                                     |

## Open findings = audit triage

Requirements with zero receipt evidence AND no operator note are
flagged as **open findings** at the top of the report. This is
exactly the section a competent-authority inspector reads first.

To close a finding:

1. Implement the control + emit receipts whose `pack` field begins
   with one of the requirement's evidence-pack prefixes, OR
2. Add an `implementationStatus` entry with `status: "compliant"`
   or `status: "alternative-measure"` + a `note` explaining where
   the evidence lives.

## Pack-prefix vocabulary

Each CRA requirement maps to one or more Guardian-pack prefixes that
count as evidence. The most useful prefixes to emit on receipts:

| Prefix                          | Maps to                            |
| ------------------------------- | ---------------------------------- |
| `cra-*`                         | Generic CRA evidence               |
| `encryption`, `tls`, `aes`      | Annex I 3.d (confidentiality)      |
| `vaos`, `integrity`, `signing`  | Annex I 3.e (integrity)            |
| `iam`, `rbac`, `mfa`, `auth`    | Annex I 3.c (access control)       |
| `audit-log`, `siem`             | Annex I 3.k (logging)              |
| `sbom`                          | Annex I Part II point 1 (SBOM)     |
| `pen-test`, `red-team`, `owasp` | Annex I Part II point 3 (testing)  |
| `incident-response`, `enisa`    | Article 14 (post-market reporting) |
| `risk-assessment`, `iso-23894`  | Article 13(1)(b)                   |

## Sibling packages

- `@sovereign-matrix/verifiable-receipts` — the receipt primitive
- `@sovereign-matrix/annex-iv` — EU AI Act
- `@sovereign-matrix/iso-42001` — AIMS
- `@sovereign-matrix/iso-23894` — AI risk management
- `@sovereign-matrix/nist-ai-rmf` — US federal
- `@sovereign-matrix/soc2-evidence` — TSC binder
- `@sovereign-matrix/gdpr-dpia` — Article 35 + 30
- `@sovereign-matrix/hipaa-security` — 45 CFR § 164
- `@sovereign-matrix/ai-constitution` — cryptographically-anchored policy

## License

Apache 2.0 © Sovereign Matrix.
