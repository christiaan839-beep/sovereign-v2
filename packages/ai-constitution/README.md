# @sovereign-matrix/ai-constitution

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

**Cryptographically-anchored AI constitutions.** Sign an immutable
policy document; every agent receipt then commits to the policy
hash. If the agent ever violates the constitution, the receipts
themselves are evidence — byte-precise, auditor-reproducible.

**Genuinely novel primitive.** No existing OSS does this. Apache 2.0.

## Why this exists

When autonomous agents take consequential actions, _"did the agent
follow the rules?"_ becomes the central accountability question.
Anthropic ships Constitutional AI as a training methodology; this
package ships it as an **inference-time cryptographic commitment**.

The two compose:

- A Claude model trained on a constitution
- - our wrapper that anchors every output to a verifiable
    constitution hash
- = the strongest currently-available accountability primitive for
  autonomous agents.

## Install

```bash
npm install @sovereign-matrix/ai-constitution @sovereign-matrix/verifiable-receipts
```

## Quick start

```ts
import {
  buildConstitution,
  auditAgainstConstitution,
  toMarkdown,
} from "@sovereign-matrix/ai-constitution";

// 1. Operator signs an immutable constitution
const constitution = buildConstitution({
  name: "Acme Healthcare AI Constitution",
  signedBy: "Acme Health AI Inc.",
  preamble:
    "This constitution governs all autonomous AI agents operating " +
    "against patient ePHI within our clinical-decision-support stack.",
  articles: [
    {
      id: "ART-1.1",
      title: "No PHI in outputs",
      text: "The agent SHALL NOT include personally-identifiable health information in any output destined for an end-user channel.",
      severity: "blocking",
      measurableCondition: {
        pack: "hipaaPack",
        ruleId: "hipaa-phi-leak-detect",
      },
      citations: ["HIPAA § 164.502(b)"],
    },
    {
      id: "ART-2.1",
      title: "Honour the kill switch",
      text: "The agent MUST cease all autonomous action within 200ms of receiving a kill signal.",
      severity: "blocking",
    },
  ],
  sign: (canonical) => "v2=" + ed25519Sign(canonical, privateKey),
});

// 2. constitution.hash is the content-addressed identifier.
//    Every receipt your agent produces commits to this hash:
//
//    const receipt = await mintMessageReceipt(message, {
//      sign,
//      agentSlug,
//      runId,
//      constitutionHash: constitution.hash,
//    });

// 3. Quarterly or on-demand, audit the receipt set:
const audit = auditAgainstConstitution({ constitution, receipts });

console.log(audit.summary.blockingViolationsTotal); // 0 if clean
console.log(audit.summary.warningViolationsTotal);
console.log(audit.violationsByArticle["ART-1.1"].blockingViolations);

// 4. File the audit with your DPO / OCR / court / insurance carrier.
import { writeFileSync } from "node:fs";
writeFileSync("./constitution-audit-q2-2026.md", toMarkdown(audit));
```

## The constitution document

A constitution is a list of **articles**, each with:

| Field                 | Required | Purpose                                                          |
| --------------------- | -------- | ---------------------------------------------------------------- |
| `id`                  | yes      | Stable canonical id (e.g. `ART-1.1`)                             |
| `title`               | yes      | Short human title                                                |
| `text`                | yes      | The inviolable rule, free-form                                   |
| `severity`            | yes      | `advisory` / `warning` / `blocking`                              |
| `measurableCondition` | optional | Guardian-pack rule id that programmatically verifies the article |
| `citations`           | optional | External standards (HIPAA §, EU AI Act Art., etc.)               |

`buildConstitution()` returns a `SignedConstitution` whose `hash`
field is the SHA-256 of the canonical projection. Articles can
reference Guardian-pack rules to make compliance programmatically
checkable; articles without `measurableCondition` are
human-evaluation-only.

## Why content-addressed?

The constitution's identifier is its SHA-256 hash, not an opaque
ULID or DB primary key. This means:

1. **Anyone can recompute the hash** from the article set + name +
   signedBy + signedAt. If the hash matches, the constitution wasn't
   tampered with.
2. **Receipts commit to the content**, not to a database row. Even
   if our DB is compromised, the receipts still reference the
   correct constitution.
3. **Constitutional revisions are explicit.** Adding an article →
   new hash. Receipts under the old hash are bound to the old
   articles; receipts under the new hash are bound to the new
   articles. No retroactive policy changes.

## Severity model

- **`advisory`** — recommendations. Operator notes them; no
  enforcement.
- **`warning`** — the agent SHOULD comply. If it doesn't, the
  receipt is flagged in the audit but no automated action.
- **`blocking`** — the agent MUST comply. A `block` verdict on the
  associated rule means the receipt's `overall` MUST be `block`.
  Production traffic should refuse to ship the agent output.

## Audit shape

`auditAgainstConstitution()` returns:

```ts
{
  schema: "vaos-constitution-audit-v1",
  constitutionHash: "...",
  constitutionName: "...",
  totalReceipts: 1024,
  receiptsBoundToThisConstitution: 982,
  receiptsBoundToDifferentConstitution: 12,
  receiptsUnbound: 30,
  violationsByArticle: {
    "ART-1.1": {
      article: { ... },
      blockingViolations: [{ verdictId, issuedAt, agentSlug, pack }, ...],
      warningViolations: [...]
    },
    ...
  },
  summary: {
    blockingViolationsTotal: 0,
    warningViolationsTotal: 7,
    cleanReceipts: 975,
  },
}
```

This audit shape is **byte-deterministic** given the same
constitution + receipt set — your regulator can re-derive the same
report from the same inputs and confirm your numbers.

## AGI / ASI safety implication

When autonomous agents become more capable, the question shifts from
_"did the model produce a good output?"_ to _"did the agent obey the
rules?"_. This package makes that question **cryptographically
answerable**:

- The constitution is content-addressed (no retroactive policy
  rewrites).
- Receipts commit to the constitution hash (the agent cannot deny
  which rules it operated under).
- The audit is byte-deterministic (any party with the constitution +
  receipts can verify).
- Post-quantum signatures (ML-DSA-65) mean even a future ASI cannot
  forge constitutional compliance after the fact.

In a post-AGI world, this is the closest cryptographic analogue to
Asimov's Laws — except enforceable.

## Sibling packages

- `@sovereign-matrix/verifiable-receipts` — receipt primitive
- `@sovereign-matrix/annex-iv` — EU AI Act
- `@sovereign-matrix/iso-42001` — AIMS
- `@sovereign-matrix/iso-23894` — AI risk management
- `@sovereign-matrix/compliance` — SOC 2, ISO 42001, NIST AI RMF, HIPAA, EU CRA
- `@sovereign-matrix/gdpr-dpia` — EU privacy
- `@sovereign-matrix/mcp` — Model Context Protocol server

## License

Apache 2.0 © Sovereign Matrix.
