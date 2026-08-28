# @sovereign-matrix/compliance

One engine, five frameworks. Receipts in, a control-by-control evidence
matrix out.

Apache-2.0. Zero runtime dependencies. Node 18+.

```bash
npm install @sovereign-matrix/compliance
```

---

## Why this is one package and not five

SOC 2, ISO/IEC 42001, the NIST AI RMF, the HIPAA Security Rule and the EU
Cyber Resilience Act used to be five packages here. They differed in three
ways: the catalogue of controls, the word for one control ("criterion",
"subcategory", "implementation specification"), and the report title.
Everything else — counting which receipts evidence which control, finding
the gaps, rendering the binder — was the same code five times.

So the frameworks are now data, and there is one engine. Adding a
framework is a file under `src/packs/`.

| Framework | id | Controls | Grouped by |
| --- | --- | ---: | --- |
| SOC 2 (AICPA TSC 2017) | `soc2` | 51 | Trust Services category |
| ISO/IEC 42001:2023 Annex A | `iso-42001` | 38 | Annex A objective |
| NIST AI RMF 1.0 | `nist-ai-rmf` | 50 | function |
| HIPAA Security Rule | `hipaa-security` | 52 | safeguard class |
| EU Cyber Resilience Act | `eu-cra` | 29 | Annex I part |

220 controls.

---

## Use

```ts
import {
  buildComplianceReport,
  renderMarkdown,
} from "@sovereign-matrix/compliance";

const report = buildComplianceReport({
  regulation: "soc2",
  scope: {
    organizationName: "Acme Ltd",
    systemName: "underwriting-ai",
    periodStart: "2026-01-01T00:00:00Z",
    periodEnd: "2026-04-01T00:00:00Z",
    // SOC 2 Security is always in scope; opt into the rest.
    inScope: ["availability", "confidentiality"],
  },
  receipts, // anything with { pack?, issuedAt? }
  controlOwners: { "CC6.1": "Head of Security" },
  annotations: {
    "CC9.2": { status: "not-applicable", note: "No third-party subservice." },
  },
});

report.summary.coverageRate; // 0.72
report.gaps; // the criteria an auditor will ask about first
renderMarkdown(report); // the binder
```

### What the numbers mean

A control's **evidence** is the number of receipts whose Guardian pack name
starts with one of the control's mapped prefixes, compared
case-insensitively. Its **coverage** is the number of distinct UTC days
those receipts span.

Coverage, not evidence count, is what an auditor is really asking: a
thousand receipts from one busy afternoon does not show a control
operating over a period. A control with evidence but fewer than
`coverageThresholdDays` (default 30) days of it is reported as a gap.

Nothing is weighted, scored or inferred. Given the same receipts, an
auditor re-derives every number in the report by hand — which is the point.
Mapping a control to a pack prefix is an operator judgement, and the
rendered document says so rather than presenting it as a derivation.

### Operator annotations

Some controls cannot be evidenced by receipts, and some do not apply. An
annotation records what a human decided and takes that control out of the
gap list — but it appears in the rendered matrix, so a reader sees the
claim and its rationale rather than a silently missing row.

---

## Adding a framework

Write a `RegulationPack` — the standard's identity, its category
vocabulary, and its catalogue:

```ts
export const MY_PACK: RegulationPack = {
  id: "my-framework",
  standard: "My Standard 1.0",
  reportTitle: "My Standard — Evidence Report",
  schema: "vaos-my-framework-v1",
  preamble: "What this report is, and what it is not.",
  controlNoun: { singular: "requirement", plural: "requirements" },
  categories: ["part-one", "part-two"],
  controls: [
    {
      id: "R.1",
      category: "part-one",
      title: "…",
      objective: "…",
      evidencePackPrefixes: ["my-framework", "soc2-cc6"],
    },
  ],
};
```

Register it in `src/index.ts`. No engine changes, and the test suite
checks every pack for unique ids, non-empty prefixes and declared
categories automatically.

---

## Also here

- `tallyEvidence(receipts, prefixes)` — the primitive, for callers
  rendering their own document. `@sovereign-matrix/iso-42001` uses it to
  tally Annex A while rendering its own clause 4-10 narrative.
- `scoreRiskRegister(scenarios, receipts)` — the ISO 31000 5×5 matrix with
  evidence-based attenuation, shared by the frameworks that work from an
  operator-declared risk register rather than a fixed catalogue
  (ISO/IEC 23894, the GDPR DPIA).
- `byCategory(report)` / `byMeta(report, key)` — rollups, for the
  framework-specific views a UI wants (HIPAA required vs addressable, the
  RMF by trustworthy-AI characteristic).

---

## What this is not

Not a certification, not an audit opinion, not legal advice. It produces
evidence for an audit and names its own gaps. A control with no receipts
is reported as having no receipts, not quietly omitted.

Upstream of this package is [`ai-act-receipts`](https://github.com/christiaan839-beep/Sovereign-Matrix),
the standalone distribution of the same engine.
