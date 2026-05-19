# Show HN Launch Draft

Two variants below. Pick the one that fits the moment (regulatory news cycle vs developer-tool news cycle), trim if HN gets touchy about length.

---

## Variant A — Regulatory framing (PRIMARY)

**Title:** Show HN: Open-source EU AI Act Annex IV exporter (Apache 2.0)

**URL:** https://sovereignmatrix.agency/compliance/annex-iv

**Body:**

EU AI Act Article 11 requires every provider of a high-risk AI system to maintain Annex IV technical documentation. Enforcement of Article 6 (high-risk obligations) starts 2026-08-02.

Closed-source vendors (Credo AI / Holistic AI / IBM watsonx.governance) ship this for $50K-200K/year. We shipped an Apache 2.0 OSS equivalent over the last 5 weeks.

How it works: the package consumes a set of cryptographically-signed VAOS receipts (Ed25519 + ML-DSA-65 dual-signed agent operations) and emits the Article 11 + Annex IV regulator-ready report. Sections §3 / §4 / §6 / §9 derive directly from the receipt set — byte-deterministic, auditor-reproducible. §1 / §2 / §5 / §7 / §8 emit as structured stubs with regulation-clause schema hints.

Receipt primitive itself is also Apache 2.0:

- Ed25519 + ML-DSA-65 (FIPS 204) dual-signing
- RFC 9162 transparency log
- 3-language verifier (TypeScript + Python + Go) with byte-deterministic conformance corpus
- 42 Guardian rule packs (HIPAA / SR 11-7 / EU AI Act / NIST AI RMF / OWASP Agentic Top 10 / ISO 42001 / FDA SaMD / 35 more)

Live preview (generated from sample receipts at build time): https://sovereignmatrix.agency/compliance/annex-iv

Sister package for ISO/IEC 42001:2023 AIMS: https://sovereignmatrix.agency/compliance/iso-42001

Three lines around your OpenAI / Anthropic / Google / Vercel-AI-SDK call:

```ts
import { mintCompletionReceipt } from "@sovereign-matrix/openai-receipts";
const completion = await openai.chat.completions.create({ ... });
const receipt = await mintCompletionReceipt(completion, { sign, agentSlug, runId });
```

Genuine OSS — no rug-pull license, no "open core". MIT/Apache verifiers are the entire point.

Happy to debate the wire format, the post-quantum choice (ML-DSA-65 vs SLH-DSA / Falcon), the Merkle inner/border decomposition vs binary-position approaches, or the choice to make the canonical projection the only thing the signature commits to. Whatever the most interesting question is.

GitHub: https://github.com/christiaan839-beep/sovereign-v2

---

## Variant B — Developer-tool framing (FALLBACK)

**Title:** Show HN: Three-line wrapper that mints post-quantum-signed receipts around your LLM calls

**Body:**

We built a thin Apache-2.0 wrapper around the OpenAI / Anthropic / Google / Vercel-AI-SDK that mints a verifiable, post-quantum-signed receipt around every model call. The receipt contains:

- Ed25519 + ML-DSA-65 (FIPS 204) dual-signature over the canonical projection
- Optional Guardian rule-pack verdict (HIPAA / SR 11-7 / EU AI Act / 39 more)
- RFC 9162 transparency-log inclusion proof
- Anchor pointer for independent witness verification

Three lines to add it to existing code:

```ts
import { mintCompletionReceipt } from "@sovereign-matrix/openai-receipts";
const completion = await openai.chat.completions.create({ ... });
const receipt = await mintCompletionReceipt(completion, { sign, agentSlug, runId });
```

Verifiers in TypeScript + Python + Go, byte-deterministic across all three (we publish a conformance corpus to prove it).

Real-world use: every receipt is a single piece of evidence in an audit trail. After a year of pipeline running, you ask "which decisions informed today's output?" and walk back through verified receipt ids — by you, your customer, your regulator.

We assembled it because every regulated buyer using Claude/GPT asked the same question: "If the model makes a decision the regulator later challenges, what evidence do we hand the court that it was defensible at the moment it was made?"

GitHub: https://github.com/christiaan839-beep/sovereign-v2

Live verifier in the browser: https://sovereignmatrix.agency/transparency/verify

---

## Posting checklist

- [ ] Confirm packages published to npm: `npm view @sovereign-matrix/verifiable-receipts` returns 0.3.0
- [ ] Confirm `/compliance/annex-iv` + `/compliance/iso-42001` both 200 OK
- [ ] Confirm GitHub repo is public (currently private at time of writing)
- [ ] Post at 09:00 ET / 06:00 PT Tuesday-Wednesday-Thursday — best discoverability
- [ ] Be online and ready to engage comments for ~4 hours minimum
- [ ] Have technical answers ready for: wire format choice, post-quantum trade-offs, why ML-DSA over Falcon, why RFC 9162 over Sigstore Rekor, why Apache 2.0 over MIT/AGPL
- [ ] Do NOT engage with bad-faith comments — flag and move on
- [ ] Mirror to Lobste.rs (with @sovereign-matrix invite if any of us has one), r/programming, r/MachineLearning, r/cryptography (the post-quantum angle gets attention there)

## Risk: rate-limit-blast

When this hits the front page, expect 50-200k page views in 6-12 hours.
Vercel's free tier serves ~100GB/mo of bandwidth — if landing page weighs
~500KB, that's 200k page loads of headroom. Probably fine but worth
checking Vercel project settings → Usage before posting.

## Risk: "audit-grade" is a hot button

Some HN commenters will flag the "audit-grade" / "regulator-ready"
positioning as marketing-speak. Have the cryptographic proofs at the
ready (the proofs/ directory in verifiable-receipts ships five plain-text
mathematical proofs). Linking proofs and conformance fixtures defuses 90%
of the skepticism.
