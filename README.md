# Sovereign Matrix

> **Audit-grade AI agents. Every output cryptographically signed. Apache-2.0 verifiers in three languages.**

Six-framework regulatory exporter suite + the receipt primitive
underneath. Receipts in, regulator-ready reports out. Closed-source
vendors charge $5K-300K/year per framework; we ship all six as
Apache 2.0.

[![Tests](https://img.shields.io/badge/tests-3852_passing-brightgreen)](./src/__tests__)
[![License: Apache 2.0](https://img.shields.io/badge/packages-Apache_2.0-blue)](./LICENSE)
[![License: MIT](https://img.shields.io/badge/app-MIT-blue)](./LICENSE)
[![Live](https://img.shields.io/badge/live-sovereignmatrix.agency-black)](https://sovereignmatrix.agency)
[![MCP](https://img.shields.io/badge/MCP-Claude_Code_%E2%9C%93-7c3aed)](./packages/mcp)
[![Post-quantum](https://img.shields.io/badge/PQ-ML--DSA--65-orange)](./packages/verifiable-receipts)

## The 12-package stack

| Package                                                                   | Purpose                                                                                                                                                                                              | Status |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| [`@sovereign-matrix/verifiable-receipts`](./packages/verifiable-receipts) | Core: Ed25519 + ML-DSA-65 (FIPS 204) post-quantum dual-signing, RFC 9162 transparency log, 42 Guardian rule packs, 3-language verifier (TS / Python / Go) with byte-deterministic conformance corpus | v0.3.0 |
| [`@sovereign-matrix/openai-receipts`](./packages/openai-receipts)         | OpenAI SDK wrapper — 3 lines to mint signed receipts around chat completions                                                                                                                         | v0.1.0 |
| [`@sovereign-matrix/anthropic-receipts`](./packages/anthropic-receipts)   | Anthropic SDK wrapper                                                                                                                                                                                | v0.1.0 |
| [`@sovereign-matrix/google-receipts`](./packages/google-receipts)         | Google Gemini SDK wrapper                                                                                                                                                                            | v0.1.0 |
| [`@sovereign-matrix/ai-sdk-receipts`](./packages/ai-sdk-receipts)         | Vercel AI SDK universal wrapper (OpenAI / Anthropic / Google / Mistral / Cohere)                                                                                                                     | v0.1.0 |
| [`@sovereign-matrix/annex-iv`](./packages/annex-iv)                       | **EU AI Act Article 11 + Annex IV** technical-documentation exporter                                                                                                                                 | v0.1.0 |
| [`@sovereign-matrix/iso-42001`](./packages/iso-42001)                     | **ISO/IEC 42001:2023 AIMS** — clauses 4-10 + 38-control Annex A                                                                                                                                      | v0.1.0 |
| [`@sovereign-matrix/nist-ai-rmf`](./packages/nist-ai-rmf)                 | **NIST AI RMF 1.0** — GOVERN / MAP / MEASURE / MANAGE profile                                                                                                                                        | v0.1.0 |
| [`@sovereign-matrix/soc2-evidence`](./packages/soc2-evidence)             | **SOC 2 AICPA Trust Service Criteria 2017** evidence binder                                                                                                                                          | v0.1.0 |
| [`@sovereign-matrix/gdpr-dpia`](./packages/gdpr-dpia)                     | **GDPR Article 35 DPIA + Article 30 RoPA**                                                                                                                                                           | v0.1.0 |
| [`@sovereign-matrix/hipaa-security`](./packages/hipaa-security)           | **HIPAA Security Rule** (45 CFR § 164.308-318)                                                                                                                                                       | v0.1.0 |
| [`@sovereign-matrix/mcp`](./packages/mcp)                                 | MCP server exposing all of the above as tools to Claude Code / Cursor / Zed                                                                                                                          | v0.1.0 |

## Three lines to start

```ts
import Anthropic from "@anthropic-ai/sdk";
import { mintMessageReceipt } from "@sovereign-matrix/anthropic-receipts";

const client = new Anthropic();
const message = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Summarize this contract..." }],
});

// ← This is the only added line:
const receipt = await mintMessageReceipt(message, { sign, agentSlug, runId });

// receipt.signature → "v2=<base64>" — verifiable forever
// receipt.overall   → "pass"
```

Same shape for [`openai-receipts`](./packages/openai-receipts),
[`google-receipts`](./packages/google-receipts), and
[`ai-sdk-receipts`](./packages/ai-sdk-receipts) (universal, works with
every Vercel AI SDK provider).

## Why this exists

Every regulated AI buyer asks the same question:

> "If the model makes a decision the regulator later challenges, what
> evidence do we hand the court that it was defensible at the moment
> it was made?"

The vendor answer is usually "we logged it somewhere." This is the
**open-source answer that travels with the call** — a
cryptographically-signed, post-quantum-secure receipt any third party
can verify with the issuer's public key.

Then layer on the regulatory exporters: feed your receipt set into
any of the six framework packages and emit an auditor-ready binder
in Markdown + JSON. Byte-deterministic. The auditor with your
receipts can reproduce the report exactly.

## Six frameworks, one receipt set

| Framework           | Closed-source competitor                 | Their typical price | Sovereign Matrix |
| ------------------- | ---------------------------------------- | ------------------- | ---------------- |
| EU AI Act Annex IV  | Credo AI, Holistic AI, IBM watsonx       | $50-200K/yr         | Apache 2.0       |
| ISO/IEC 42001:2023  | Holistic AI + cert bodies (BSI, TÜV SÜD) | $50-150K/yr + cert  | Apache 2.0       |
| NIST AI RMF 1.0     | IBM watsonx.governance, Credo AI         | $100-300K/yr        | Apache 2.0       |
| SOC 2 evidence      | Vanta, Drata, Secureframe                | $5-50K/yr           | Apache 2.0       |
| GDPR DPIA + RoPA    | OneTrust, TrustArc, BigID                | $10-100K/yr         | Apache 2.0       |
| HIPAA Security Rule | HITRUST, Compliancy Group                | $20-100K/yr + cert  | Apache 2.0       |

Single receipt set + six exporters + one function call per framework.
Tag the receipt once with the right Guardian pack; every framework's
report counts it as evidence.

## MCP — talk to your compliance pipeline from Claude Code

```json
// claude_desktop_config.json
{
  "mcpServers": {
    "sovereign-matrix": {
      "command": "npx",
      "args": ["-y", "@sovereign-matrix/mcp"]
    }
  }
}
```

Restart Claude → 7 new tools appear:

```
verify_receipt · build_annex_iv · build_iso_42001 · build_nist_ai_rmf ·
build_soc2_evidence · build_gdpr_dpia · build_hipaa_security
```

Ask Claude: _"Build an EU AI Act Annex IV report from
receipts/q2-2026.json with this system metadata: …"_ → Claude calls
the deterministic exporter against your real receipts and writes
auditor-ready Markdown back to your repo.

## Live preview

- **[/compliance](https://sovereignmatrix.agency/compliance)** — hub linking all 6 exporters
- **[/compliance/annex-iv](https://sovereignmatrix.agency/compliance/annex-iv)** — EU AI Act preview
- **[/compliance/iso-42001](https://sovereignmatrix.agency/compliance/iso-42001)** — AIMS preview
- **[/compliance/nist-ai-rmf](https://sovereignmatrix.agency/compliance/nist-ai-rmf)** — US federal preview
- **[/compliance/soc2](https://sovereignmatrix.agency/compliance/soc2)** — Trust Service Criteria binder
- **[/compliance/gdpr-dpia](https://sovereignmatrix.agency/compliance/gdpr-dpia)** — DPIA + RoPA
- **[/compliance/hipaa](https://sovereignmatrix.agency/compliance/hipaa)** — Security Rule binder

Every preview is server-rendered against a sample receipt set so you
see the exact bytes the exporter produces before you install anything.

## Three-language verifier

The core receipt primitive ships verifiers in TypeScript, Python, and
Go. Every verifier runs the same conformance corpus and MUST produce
byte-identical pass/fail outcomes:

```
packages/verifiable-receipts/conformance/
├── fixtures/                       # 10 JSON receipt fixtures
│   ├── basic-pass.json
│   ├── inclusion-7leaf-idx6.json   # the carry-up edge case
│   ├── threshold-3of5.json
│   └── ...
├── verifier.ts                     # TypeScript verifier
├── verifier.py                     # Python verifier
└── verifier.go                     # Go verifier
```

Auditor clones the repo, runs three commands, confirms byte-identical
outcomes across all three languages. Same discipline as Sigstore +
Certificate Transparency + JOSE conformance suites.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Your AI call (OpenAI / Anthropic / Google / Vercel AI SDK)      │
└────────────────────────────┬─────────────────────────────────────┘
                             │ + 3 lines of wrapper code
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  @sovereign-matrix/*-receipts wrapper                            │
│  → Mints a VAOS receipt (Ed25519 + ML-DSA-65 dual-signed)        │
│  → Optionally runs Guardian rule packs (42 packs · 7 continents) │
│  → Anchors to RFC 9162 transparency log                          │
└────────────────────────────┬─────────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  Receipt set (your audit trail — 90 days / 365 days / forever)   │
└────────────────────────────┬─────────────────────────────────────┘
            ┌────────────┬───┴───┬─────────────┬──────────────┐
            ▼            ▼       ▼             ▼              ▼
       annex-iv     iso-42001  nist-rmf    soc2-evidence  gdpr-dpia/hipaa
       (EU AI Act)  (AIMS)     (US fed)    (TSC binder)   (privacy/health)
            │            │       │             │              │
            └────────────┴───────┴─────────────┴──────────────┘
                                 ▼
                Auditor-ready Markdown + GRC-tool JSON
                Byte-deterministic. Reproducible by your regulator.
```

## Methodology

[`docs/methodology/SOVEREIGN-METHODOLOGY-V2.md`](./docs/methodology/SOVEREIGN-METHODOLOGY-V2.md)
is a CC0 deep-dive on the Opus 4.7 prompt patterns deployed across
the platform — CRISPE + XML + `<search_first>` anti-hallucination
contracts + multi-agent delegation patterns. 10 sections, field-tested
production prompts.

## Tests + gates

```
$ npm test
✓ 3852 tests passing (256 files)
✓ 4 skipped

$ npx tsc --noEmit
✓ clean

$ npm run lint
✓ 0 errors, 21 baseline warnings

$ npm run build
✓ 354 static pages
✓ 9 compliance routes prerendered
```

CI runs lint + typecheck + tests + security audit + SBOM generation

- dependency review on every PR.

## Repository layout

```
sovereign-v2/
├── packages/
│   ├── verifiable-receipts/      # Core: receipt primitive, transparency log, packs
│   ├── verifiable-receipts-py/   # Python verifier
│   ├── verifiable-receipts-go/   # Go verifier
│   ├── openai-receipts/          # OpenAI SDK wrapper
│   ├── anthropic-receipts/       # Anthropic SDK wrapper
│   ├── google-receipts/          # Google Gemini wrapper
│   ├── ai-sdk-receipts/          # Vercel AI SDK universal
│   ├── annex-iv/                 # EU AI Act exporter
│   ├── iso-42001/                # ISO 42001 AIMS exporter
│   ├── nist-ai-rmf/              # NIST AI RMF profile
│   ├── soc2-evidence/            # SOC 2 evidence binder
│   ├── gdpr-dpia/                # GDPR DPIA + RoPA
│   ├── hipaa-security/           # HIPAA Security Rule
│   └── mcp/                      # MCP server (Claude Code / Cursor)
├── src/                          # Next.js 16 app (sovereignmatrix.agency)
│   ├── app/                      # 354 static + ~50 dynamic routes
│   ├── lib/                      # 273 lib modules
│   └── db/                       # Drizzle ORM, 38 tables
├── docs/
│   ├── methodology/              # Sovereign Methodology v2 (CC0)
│   ├── partnerships/             # 5 sender-ready partnership briefs (CC0)
│   ├── launch/                   # Show HN draft + launch checklist
│   └── specs/                    # IETF Internet-Draft for VAOS
├── server/
│   ├── ws.ts                     # WebSocket server (real-time agents)
│   └── python-agents/            # Standalone Python agents
└── scripts/
    ├── publish-all.sh            # One command publishes all 12 to npm
    └── build-packages.mjs        # Dependency-ordered workspace build
```

## Standards trajectory

- **IETF Internet-Draft**: `docs/specs/ietf-draft-vaos-00.md` —
  formalises VAOS as a vendor-neutral wire format candidate for AI
  agent operation receipts. Submission-ready for the IETF Independent
  Stream.
- **CC0 spec**: anyone can implement a VAOS verifier without
  permission, without royalty, without license risk.
- **Apache-2.0 reference verifiers**: TypeScript, Python, Go, with
  byte-deterministic conformance.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). PRs welcome — every contribution
goes through the same CI gates as internal commits (lint + typecheck +
tests + security audit).

## Security

See [SECURITY.md](./SECURITY.md). 90-day responsible-disclosure window.
Email: `security@sovereignmatrix.agency`.

## License

| Layer                     | License                  |
| ------------------------- | ------------------------ |
| `packages/*`              | Apache 2.0               |
| `docs/methodology/*`      | CC0 (public domain)      |
| `docs/partnerships/*`     | CC0 (use freely)         |
| `docs/specs/*`            | IETF Trust per BCP 78/79 |
| Application code (`src/`) | MIT                      |

## What's next

- npm publishing: `./scripts/publish-all.sh` (12 packages → live on npm)
- Show HN: draft at `docs/launch/SHOW-HN.md` (Variant A — regulatory framing)
- IETF submission: `docs/specs/ietf-draft-vaos-00.md`
- Partnership outreach: 5 sender-ready briefs in `docs/partnerships/`

EU AI Act Article 6 enforcement: **2026-08-02**.
