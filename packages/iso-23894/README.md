# @sovereign-matrix/iso-23894

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

**ISO/IEC 23894:2023 — Information technology — Artificial intelligence
— Guidance on risk management.** Takes operator-declared risk
scenarios + a VAOS receipt set and emits an auditor-ready AI risk
management report aligned to ISO 31000.

## Why this exists

ISO/IEC 23894 is the AI-specific adaptation of ISO 31000 (the
general risk management standard). It provides the _how_ that ISO/IEC
42001 references in its "you must do AI risk management" clause.

Closed-source GRC vendors bundle ISO 23894 mapping inside their AIMS
modules at $30K-100K+/yr. This is the Apache 2.0 OSS implementation.

## Install

```bash
npm install @sovereign-matrix/iso-23894 @sovereign-matrix/verifiable-receipts
```

## Quick start

```ts
import { buildIso23894, toMarkdown } from "@sovereign-matrix/iso-23894";

const report = buildIso23894({
  scope: {
    organizationName: "Acme AI Inc.",
    systemName: "Loan Underwriting AI",
    lifecyclePhase: "operation-monitoring",
    policyVersion: "RMP-2026-v3",
    periodStart: "2026-01-01T00:00:00Z",
    periodEnd: "2026-12-31T00:00:00Z",
  },
  scenarios: [
    {
      id: "RS-1",
      description: "Prompt-injection causes bias-disclosure leak.",
      source: "prompt-injection",
      likelihood: "possible",
      impact: "major",
      characteristic: "secure-and-resilient",
      treatment: "reduce",
      treatmentDescription:
        "OWASP Agentic Top 10 pack + structured-output validation.",
      evidencePackPrefixes: ["owasp", "owasp-agentic"],
    },
  ],
  receipts, // VAOS receipts
});

writeFileSync("./iso-23894-2026.md", toMarkdown(report));
```

## The risk-scoring model

ISO 23894 references the 5×5 likelihood × impact matrix from ISO 31000:

|                    | Negligible | Minor    | Moderate | Major   | Catastrophic |
| ------------------ | ---------- | -------- | -------- | ------- | ------------ |
| **Almost certain** | low        | medium   | high     | extreme | extreme      |
| **Likely**         | low        | medium   | high     | high    | extreme      |
| **Possible**       | very-low   | low      | medium   | high    | extreme      |
| **Unlikely**       | very-low   | low      | low      | medium  | high         |
| **Rare**           | very-low   | very-low | low      | medium  | high         |

Each scenario gets an **inherent risk** (no treatment) and a
**residual risk** (after treatment evidence). The residual is the
inherent attenuated by receipt count:

- 0-9 receipts → 0 bands lower
- 10-99 receipts → 1 band lower
- 100+ receipts → 2 bands lower

No magic — pure operator-explainable arithmetic. Auditors with the
same scenarios + receipts re-derive every band exactly.

## Trustworthy-AI characteristics

Each scenario is tagged with one of the 7 characteristics from NIST
AI RMF Appendix B (same vocabulary used across the Sovereign Matrix
exporter family):

- `valid-and-reliable`
- `safe`
- `secure-and-resilient`
- `accountable-and-transparent`
- `explainable-and-interpretable`
- `privacy-enhanced`
- `fair-with-bias-managed`

This shared taxonomy means an AI risk register in 23894 maps
1-to-1 with NIST RMF subcategory coverage in
`@sovereign-matrix/nist-ai-rmf`.

## Sibling packages

- `@sovereign-matrix/verifiable-receipts` — the receipt primitive
- `@sovereign-matrix/iso-42001` — AIMS (references 23894)
- `@sovereign-matrix/nist-ai-rmf` — US federal RMF
- `@sovereign-matrix/ai-constitution` — cryptographically-anchored policy
- `@sovereign-matrix/eu-cra` — EU Cyber Resilience Act
- `@sovereign-matrix/annex-iv` — EU AI Act Article 11
- `@sovereign-matrix/soc2-evidence` — AICPA TSC binder
- `@sovereign-matrix/gdpr-dpia` — Article 35 DPIA + Article 30 RoPA
- `@sovereign-matrix/hipaa-security` — 45 CFR § 164.308-318

## License

Apache 2.0 © Sovereign Matrix.
