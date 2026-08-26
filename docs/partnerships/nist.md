# NIST — partnership brief

**Primary doors:**

- NIST AI RMF working group — `airmf@nist.gov`
- AI 100-1 / AI 600-1 GenAI Profile author **Reva Schwartz** —
  via NIST general inbox (mention "Generative AI Profile, AI 600-1
  feedback")
- NIST Information Technology Laboratory (ITL) — Apostol Vassilev
  (post-quantum cryptography / FIPS 204 ML-DSA contributor)

**Subject:** Public-comment submission + Apache-2.0 reference
implementation for AI 600-1 audit-trail recommendations

---

## Why this matters to NIST

NIST AI 100-1 (AI RMF 1.0) and AI 600-1 (Generative AI Profile)
both recommend cryptographically-signed audit trails for
high-risk AI systems. Neither specifies a wire format, a reference
verifier, or how to compose with FIPS 204 (ML-DSA-65) for
post-quantum forward security.

Sovereign Matrix is **the first public, Apache-2.0 reference
implementation that satisfies AI 600-1's audit-trail
recommendations end-to-end** — with frozen wire spec, formal
proofs, three-language symmetric verifier, and direct cross-walk
to AI RMF's Govern / Map / Measure / Manage functions.

We're not asking NIST to endorse a vendor — we're asking NIST to
**cite a public reference implementation** in implementing
guidance, the same way RFC 9162 is cited as the reference for
Certificate Transparency.

## Direct fit with NIST publications

- **AI 100-1 (AI RMF 1.0)** — our `nistAiRmfPack` exercises every
  function (Govern / Map / Measure / Manage) per pack rule.
- **AI 600-1 (Generative AI Profile, July 2024)** — our
  `multiAgentCascadePack` operationalizes the §Multi-Agent Scaling
  - 17.2× error-amplification bound; `nistAiRmfPack` adds
    AI 600-1 risk-control ID + provenance flag requirements.
- **FIPS 204 (ML-DSA-65)** — the VAOS 3.0 wire format carries an
  Ed25519 signature and an ML-DSA-65 signature over the same
  canonical digest, so a receipt stays verifiable if either scheme
  falls. Apache-2.0; spec at docs/specs/vaos-3.0.md.
- **AI 800-1 (Adversarial ML Test Plan)** — our public red-team
  module + adversarial corpus cover 14 attack classes including
  every OWASP-Agentic-Top-10 risk.

## What we're asking for

In order of escalating ask:

1. **Public-comment submission acknowledgement** on AI 600-1
   recommendation Q1 (audit-trail format). We'll submit a formal
   public comment recommending VAOS as a candidate reference
   format; just want it on the record.

2. **Citation in AI 600-1 implementing guidance / FAQ** —
   `@sovereign-matrix/verifiable-receipts` as the canonical
   open-source reference implementation for the audit-trail
   recommendation. Costs NIST one footnote.

3. **Invitation to AI RMF working group meeting / NIST
   AI Safety Institute consultation** — 20-min technical
   presentation: "Post-quantum signed AI receipts as the
   reference implementation for AI 600-1 audit recommendations."

4. **NIST AI Safety Institute test-and-evaluation collaboration**
   — apply our 3-language symmetric verifier + adversarial corpus
   against NIST's evaluation suite. Apache-2.0; results
   publishable.

## Strategic value to NIST

NIST publishes recommendations; you don't ship code. Sovereign
Matrix is the bridge — a public reference implementation that lets
agencies operationalize AI 100-1 + AI 600-1 + FIPS 204 + AI 800-1
without commissioning a custom implementation.

By citing us, NIST gets:

- A working, tested, formally-proven reference implementation
- Zero vendor lock-in (Apache 2.0)
- Direct cross-walk to FIPS 204 (which NIST publishes)
- Three-language symmetric verifier proving the wire format is
  cross-implementation-stable

In exchange, every regulated agency reading AI 600-1 has a clear
"here's how to implement this" pointer.

## Proof links

- IETF Internet-Draft: `docs/specs/ietf-draft-vaos-00.md`
- 5-proof mathematical corpus: `packages/verifiable-receipts/proofs/`
- npm: `@sovereign-matrix/verifiable-receipts`
- PyPI: `sovereign-matrix-verifiable-receipts`
- Go module: `github.com/christiaan839-beep/sovereign-v2/packages/verifiable-receipts-go`
- Cross-language conformance corpus: `packages/verifiable-receipts/conformance/`
- NIST AI RMF pack: `packages/verifiable-receipts/src/packs.ts` (search `nistAiRmfPack`)
- Public red-team corpus: `packages/verifiable-receipts/src/red-team.ts`

## Contact

Christiaan de Wet · Cape Town, South Africa
`christiaan@sovereignmatrix.agency` · `spec@sovereignmatrix.agency`

Public comment submission queued for the next AI 600-1 revision
cycle; happy to coordinate timing.
