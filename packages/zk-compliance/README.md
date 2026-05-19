# @sovereign-matrix/zk-compliance

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

**Zero-knowledge compliance proofs over VAOS receipt sets.** Prove
_"Agent X complied with policy Y over period Z"_ to a regulator,
insurance underwriter, or customer security team — **without
revealing the underlying receipts**.

Novel primitive. **No existing OSS does this.** Apache 2.0.

## Why this exists

Every regulated AI buyer eventually faces a paradox: the receipts
that prove compliance are themselves sensitive operational data
(customer identifiers, prompt content, model decisions). Handing
them to a regulator is a data-protection nightmare. Redacting them
to PDF is unauditable theatre.

This package's answer: a cryptographic proof that proves the
statistical claim ("over the audit window, the block-rate stayed
below 0.5%") while revealing **only the aggregate**. The verifier
confirms the math; the receipts stay with the operator.

## Install

```bash
npm install @sovereign-matrix/zk-compliance @sovereign-matrix/verifiable-receipts
```

## Quick start

```ts
import {
  buildZkProof,
  verifyZkProof,
  toMarkdown,
} from "@sovereign-matrix/zk-compliance";

// Operator side — runs against their full (sensitive) receipt set:
const proof = buildZkProof({
  claim: {
    kind: "block-rate-below-threshold",
    statement: "Block rate stayed below 0.5% over Q2 2026",
    windowStart: "2026-04-01T00:00:00Z",
    windowEnd: "2026-06-30T23:59:59Z",
    threshold: 0.005,
    direction: "below",
    citation: "EU AI Act Annex IV §3 (monitoring threshold)",
  },
  receipts, // your full audit set
});

// Send the proof to the regulator. NOT the receipts.
import { writeFileSync } from "node:fs";
writeFileSync("./regulator-q2-2026.md", toMarkdown(proof));

// Regulator side — verifies WITHOUT receipts:
const result = verifyZkProof(proof);
// → { ok: true, reasons: [] }
```

## Supported claim kinds

The vocabulary maps to claims every regulatory framework already uses,
so the proof is portable across SOC 2, EU AI Act, NIST AI RMF, ISO
42001, GDPR DPIA, HIPAA Security Rule, EU CRA, and constitutional
audits.

| `kind`                               | Aggregate                                                           | Use case                                             |
| ------------------------------------ | ------------------------------------------------------------------- | ---------------------------------------------------- |
| `block-rate-below-threshold`         | `blocks / total`                                                    | Annex IV §3 monitoring, ISO 8 operation, SOC 2 CC7.2 |
| `pii-leak-rate-zero`                 | `pii-violating receipts / total`                                    | GDPR Art. 32, HIPAA § 164.312, SOC 2 CC6             |
| `anomaly-count-below-threshold`      | count of receipts with `anomalyKind`                                | NIST AI RMF MEASURE-2.6, ISO 9.1                     |
| `agent-deactivation-honoured`        | count of receipts with `superseded: true`                           | NIST AI RMF MANAGE-2.4                               |
| `constitution-articles-honoured`     | fraction of constitution-bound receipts without blocking violations | `@sovereign-matrix/ai-constitution`                  |
| `framework-coverage-above-threshold` | distinct days covered                                               | SOC 2 days-of-coverage gap analysis                  |

## Privacy guarantees

For every proof v0.1 emits, the verifier learns:

- The number of receipts in the audit window (one integer).
- The aggregate (one number).
- The claim being proven (operator-supplied text + threshold).

The verifier does **NOT** learn:

- Any individual receipt's content.
- Which receipts contributed to the aggregate.
- The operator's customer identifiers, agent slugs, or Guardian pack ids.
- The receipt timestamps (beyond the operator-stated audit window).

## What v0.1 ships vs. v0.2

| Property                                                     | v0.1 (this release)                              | v0.2 (planned)                     |
| ------------------------------------------------------------ | ------------------------------------------------ | ---------------------------------- |
| API surface                                                  | ✅ Stable                                        | Same (additive only)               |
| Selective-disclosure commitment                              | ✅ SHA-256 Merkle commit + revealed aggregate    | Same                               |
| Computation binding                                          | ✅ SHA-256 over (claim + commitment + aggregate) | Same                               |
| Tampering detection                                          | ✅ via `verifyZkProof()`                         | Same                               |
| Full zk-SNARK proof (verifier learns NOTHING about receipts) | ❌ Reveals 1 aggregate                           | ✅ Halo2 / Plonky3 / risc0 circuit |
| Wire format                                                  | `vaos-zk-compliance-v1`                          | Same envelope; new fields          |

The v0.1 → v0.2 upgrade is **wire-format-compatible**: proofs minted
under v0.1 verify under v0.2 verifiers, and v0.2 proofs gracefully
downgrade to v0.1 verifier semantics with a warning. No format break.

## Verification

```ts
import { verifyZkProof } from "@sovereign-matrix/zk-compliance";

const result = verifyZkProof(proof);
if (!result.ok) {
  for (const reason of result.reasons) {
    console.error("PROOF INVALID:", reason);
  }
  throw new Error("Compliance proof failed verification");
}
```

The verifier does **3 checks**:

1. Schema is recognised (`vaos-zk-compliance-v1`).
2. The `computationCommitment` SHA-256 is correctly bound to
   `(claim.kind + windowStart + windowEnd + threshold + direction +
receiptCommitment + revealedAggregate)`. This catches operator-side
   substitution: changing the aggregate without recomputing the
   commitment makes the proof invalid.
3. The `verdict` matches the threshold + direction. An operator
   can't flip a violation to "satisfies" without the verifier
   noticing.

## Production hardening checklist

When you ship this in production:

- [ ] Anchor `receiptCommitment` to the public transparency log so
      verifiers can confirm the commitment wasn't substituted between
      proof generation and verification.
- [ ] Sign the proof JSON with the operator's Ed25519 key (the
      package emits unsigned proofs; signing is the consumer's
      responsibility, same pattern as `@sovereign-matrix/anthropic-receipts`).
- [ ] For classified / defense / healthcare deployments, upgrade to
      v0.2 once the circuit library is integrated.

## Sibling packages

- `@sovereign-matrix/verifiable-receipts` — the receipt primitive
- `@sovereign-matrix/ai-constitution` — constitutional anchoring
- `@sovereign-matrix/annex-iv` — EU AI Act Annex IV
- `@sovereign-matrix/iso-42001` — AIMS
- `@sovereign-matrix/iso-23894` — AI risk management
- `@sovereign-matrix/nist-ai-rmf` — US federal
- `@sovereign-matrix/soc2-evidence` — TSC binder
- `@sovereign-matrix/gdpr-dpia` — Article 35 + 30
- `@sovereign-matrix/hipaa-security` — 45 CFR § 164
- `@sovereign-matrix/eu-cra` — EU Cyber Resilience Act
- `@sovereign-matrix/mcp` — MCP server exposing all of the above

## Use cases (real, ranked by buyer urgency)

1. **Classified AI deployments** (defense, intelligence) — prove
   compliance to oversight without leaking deployment details.
2. **Healthcare AI under HIPAA + GDPR Art. 9** — prove PHI never
   leaked without sharing patient records.
3. **Financial AI under SR 11-7 + Basel III** — prove model risk was
   contained without disclosing trading or risk-decision content.
4. **AI-E&O insurance underwriting** — prove safety properties to
   the underwriter without revealing operational details.
5. **Multi-jurisdiction AI deployments** — prove compliance per
   jurisdiction (EU AI Act, NIST RMF, MAS, PDPA) without
   reproducing receipt sets per regulator.

## License

Apache 2.0 © Sovereign Matrix.
