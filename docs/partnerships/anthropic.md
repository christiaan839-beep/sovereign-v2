# Anthropic — partnership brief

**To:** `partnerships@anthropic.com`
**CC:** model-context-protocol working-group (modelcontextprotocol.io)
**Subject:** Apache-2.0 receipt layer that makes Claude calls regulator-defensible

---

## Why this matters to Anthropic

Every regulated-AI buyer (banks, hospitals, insurers, federal
agencies) asks Claude's enterprise sales the same question:

> "If Claude makes a decision that ends up in front of a judge, what
> evidence can you hand the court that the decision was defensible
> at the moment it was made?"

Anthropic's current answer is some variant of "we logged it
somewhere." Sovereign Matrix ships the answer **as Apache-2.0 OSS
the customer can run themselves**: a post-quantum dual-signed
(Ed25519 + ML-DSA-65, FIPS 204) receipt for every agent decision,
verifiable forever by any independent party.

## What we've shipped

- **42 jurisdiction-cited Guardian rule packs** across 7 continents
  — HIPAA / EU AI Act / SR 11-7 / FDA SaMD / NIST AI RMF / etc.
- **Post-quantum dual-signed receipts** (VAOS 2.0/3.0 wire formats,
  frozen specs)
- **Threshold cosigning** (VAOS-TRS 1.0) and **streaming attestation**
  (VAOS-RSA 1.0) — primitives no other receipt-layer vendor ships
- **RFC 9162 transparency log** + witness federation
- **Three-language symmetric verifier** (TypeScript / Python / Go)
  with a public conformance corpus
- **IETF Internet-Draft** submitted to the Independent Stream
  (`docs/specs/ietf-draft-vaos-00.md`)
- **Five mathematical proofs** reducing every security claim to
  standard crypto assumptions
- Native **MCP server** (the Sovereign Matrix MCP exposes
  `sovereign_run_agent`, `sovereign_playbook`, `sovereign_health`,
  `sovereign_api_catalog` against production)
- Built end-to-end on **Claude Code**; runs Claude Sonnet as the
  consensus critic on every customer-facing agent

## What we're asking for

Three things, in order of effort:

1. **Add our MCP server to the official modelcontextprotocol.io
   community registry.** PR-ready; can submit this week. Costs you
   one PR review.
2. **One sentence in Claude's enterprise compliance docs** pointing
   regulated buyers at `@sovereign-matrix/verifiable-receipts` as
   the canonical Apache-2.0 receipt layer for Claude calls. Costs
   you one doc-pages PR.
3. **Anthropic Builders Program acceptance.** Standard application;
   we meet every published criterion.

In exchange, every Claude customer who needs receipts gets a
zero-vendor-lock answer, and Anthropic's enterprise sales motion
gets a concrete deliverable for the "what about audit?" question.

## Proof links

- npm: `@sovereign-matrix/verifiable-receipts`
- GitHub: `christiaan839-beep/sovereign-v2` (Apache 2.0)
- Live transparency log: `https://sovereignmatrix.agency/api/transparency/sth`
- Live witness observations: `https://sovereignmatrix.agency/api/transparency/witness/observations`
- IETF draft: `docs/specs/ietf-draft-vaos-00.md` in the repo
- 5-proof corpus: `packages/verifiable-receipts/proofs/`

## Contact

Christiaan de Wet · Cape Town, South Africa
`christiaan@sovereignmatrix.agency` · `spec@sovereignmatrix.agency`

Happy to do a 30-min Loom walkthrough of the receipt-mint + verify
round-trip if a written response isn't enough.
