# Verifiable AI — A Receipt-Centric Architecture for Regulated AI

**Sovereign Matrix · May 2026 · v1.0**
_Christiaan de Wet — `christiaan@sovereignmatrix.agency`_

> A working paper proposing a cryptographic-receipt architecture for AI
> agent outputs in regulated industries. Combines RFC 6962-style
> transparency logging, post-quantum dual-signing (FIPS 204), and an
> Apache-2.0 verifier ecosystem to make AI vendor claims mechanically
> reproducible by parties the vendor does not control.

---

## Abstract

Regulated industries — pharmacovigilance, insurance, banking, clinical
trials — face a structural conflict with current AI vendor practice:
auditors must accept that the vendor's logs are intact and have not
been retroactively rewritten. This trust assumption is incompatible
with HIPAA, NAIC AI Bulletin, Federal Reserve SR 11-7, EU AI Act,
21 CFR Part 11 (e-records), and ICH E2B(R3) (pharmacovigilance ICSRs).

This paper presents the Verifiable Agent Output Specification (VAOS),
a wire-stable cryptographic receipt format for AI agent outputs, and
the AI Receipt Transparency Log (ART-Log), an append-only Merkle
structure that publishes those receipts to a public log auditable by
any third party. Combined, they let a regulator verify that a specific
AI decision (a) was actually produced by the claimed agent + model,
(b) committed to the inputs claimed, (c) was published at the time
claimed, and (d) has not been altered since — without trusting the
vendor's infrastructure for any step of that verification.

The architecture is open: the spec is public domain (CC0), the
reference implementation is Apache-2.0 on npm
(`@sovereign-matrix/verifiable-receipts`), and the wire format is
under active submission to IETF as Internet-Draft
`draft-dewet-vaos-receipts-00`.

This paper is an industry working paper. It is not peer-reviewed
cryptographic research; the underlying primitives (Ed25519, ML-DSA-65,
SHA-256, RFC 6962 Merkle trees) are all standard. The contribution is
the _application of these primitives to AI agent receipts_ in a way
that procurement, audit, and judicial review can rely on.

---

## 1. The trust gap

### 1.1 The question every CISO asks in 2026

> _"If your AI made a decision that ends up in front of a judge, what
> evidence can you hand the court that the decision was defensible at
> the moment it was made?"_

Most AI vendors today answer with **application logs** — vendor-
controlled records stored in the vendor's own database, retrievable
only via the vendor's API or by court subpoena of the vendor's
infrastructure. The implicit trust assumption:

> "The vendor has not, between the decision and the lawsuit, modified
> or deleted any record that would help the plaintiff."

This assumption holds in practice for most AI vendors most of the
time — but it is mathematically untestable and operationally
unauditable. A bad-faith vendor (or a vendor under regulatory
duress) can silently alter logs; an honest vendor cannot prove they
didn't.

### 1.2 What regulators are actually asking for

- **FDA 21 CFR Part 11 §11.10(e)**: predicate-rule electronic records
  must carry a _secure, computer-generated, time-stamped audit trail_.
- **EU GVP Module VI**: ICSRs (Individual Case Safety Reports) must
  be retained for 10 years past the withdrawal of the last marketing
  authorisation.
- **NAIC AI Bulletin §3.5** (Dec 2023): AI decisions in insurance
  must be _traceable_ — every input, every model version, every
  output, available for replay.
- **Federal Reserve SR 11-7 / OCC 2011-12**: model risk management
  requires _reproducibility_ of model decisions, attribution to
  specific model versions and inputs.
- **EU AI Act (effective mid-2026)**: high-risk AI systems must
  maintain _automatically generated logs_ with a level of traceability
  that lets a national authority retrace the operation of the system
  for compliance and post-market monitoring.

In every case the regulator's question is: **"Can you prove this
specific decision was made this specific way at this specific time —
without us having to trust your storage layer?"**

Current AI vendor practice cannot answer this. The receipt
architecture in this paper can.

---

## 2. The receipt architecture in one diagram

```
                ┌───────────────────────────────────────┐
                │   AI agent run                        │
                │   (input, output, model, safety,      │
                │    timing, agent identity)            │
                └─────────────────┬─────────────────────┘
                                  │
                                  ▼
                ┌───────────────────────────────────────┐
                │   Canonical projection                │
                │   (sortKeysDeep + JSON-stringify)     │
                └─────────────────┬─────────────────────┘
                                  │  UTF-8 bytes
                                  ▼
       ┌──────────────────────────┴──────────────────────────┐
       │                                                     │
       ▼                                                     ▼
┌───────────────┐                              ┌────────────────────────┐
│  Sign         │                              │  Hash + append to       │
│  ───────────  │                              │  transparency log       │
│  Ed25519 v2   │                              │  ────────────────────   │
│  ML-DSA-65 v3 │                              │  RFC 6962 Merkle tree   │
└───────┬───────┘                              │  Bitcoin-anchored STH   │
        │                                      └───────────┬────────────┘
        ▼                                                  ▼
┌───────────────┐                              ┌────────────────────────┐
│  Receipt      │                              │  Public Signed Tree    │
│  signature    │  ── stored alongside ──▶     │  Head (STH)            │
└───────────────┘                              │  + inclusion proof for │
                                               │  this receipt          │
                                               └───────────┬────────────┘
                                                           │
                                                           ▼
                                               ┌────────────────────────┐
                                               │  N independent         │
                                               │  witnesses co-sign     │
                                               │  the STH               │
                                               └────────────────────────┘
```

The vendor's claim to a regulator becomes:

1. "Here is the receipt for that decision."
2. "Here is the canonical projection algorithm" (public spec).
3. "Here is our Ed25519 public key" (published at
   `/.well-known/sovereign-receipts/ed25519.pem`).
4. "Here is the inclusion proof showing this receipt is in the
   public transparency log at tree size N."
5. "Here is the Signed Tree Head, co-signed by 3 independent
   witnesses, attesting to that tree state at the time of issuance."
6. "Here is the consistency proof showing the log of size N
   anchored to Bitcoin block H has not been rewritten since."

Every step (2)-(6) is independently verifiable using only public
keys + the Apache-2.0 verifier on npm. The vendor's infrastructure
is in the trust path for issuance only, not for verification.

---

## 3. The wire format — VAOS

### 3.1 Receipt structure

```json
{
  "v": 1,
  "id": "rcpt_2026_05_17_001",
  "agentName": "icsr-triage-meddra",
  "modelUsed": "claude-sonnet-4-6",
  "input": { "caseId": "CASE-99021", "...": "..." },
  "output": { "seriousness": "serious", "...": "..." },
  "safetyResult": { "passed": true, "score": 0.97 },
  "durationMs": 2134,
  "createdAt": "2026-05-17T14:07:23.502Z",
  "signature": "v3=<base64-Ed25519>.<base64-ML-DSA-65>"
}
```

### 3.2 Canonical projection

The canonical projection is the byte-stable signing input — the
UTF-8 serialization of the receipt's content fields (all except
`signature`) with object keys sorted lexicographically at every
depth. The reference implementation is `stableStringify()` in the
OSS package; the algorithm is in §5 of the VAOS spec.

### 3.3 Three signature schemes — wire-compatible by version prefix

| Prefix | Algorithm                                | Use case                                                   |
| ------ | ---------------------------------------- | ---------------------------------------------------------- |
| `v1=`  | HMAC-SHA256                              | Closed-loop, shared-secret. Not independently verifiable.  |
| `v2=`  | Ed25519 (RFC 8032)                       | Public-key. Any party with the PEM can verify.             |
| `v3=`  | Ed25519 + ML-DSA-65 dual-sign (FIPS 204) | Post-quantum forward-secure. Verifiable past CRQC horizon. |

A verifier MUST hard-branch on the prefix. The set of recognized
prefixes is closed; future versions reserve new prefixes via the
IANA registry requested in the Internet-Draft.

### 3.4 The post-quantum hedge

Regulated retention horizons routinely span 7–25 years. That horizon
crosses the projected timeline for a cryptographically-relevant
quantum computer (CRQC) capable of breaking Ed25519 via Shor's
algorithm. A receipt signed today under v2 may become forgeable in 2040. NIST FIPS 204 (Aug 2024) standardized ML-DSA, the first
peer-reviewed post-quantum signature family suitable for this
application.

VAOS v3 hedges the risk by signing every receipt **with both**
Ed25519 and ML-DSA-65 over the same canonical bytes. A verifier in
2026 confirms Ed25519; a verifier in 2040 — running against a
post-quantum-hardened library — confirms ML-DSA-65 alone. The cost
is bytes (3293-byte signature vs. 64) and CPU (~30× slower signing,
~3× slower verification). For audit receipts, which are signed
once and verified rarely, the trade is overwhelmingly correct.

---

## 4. The transparency log — ART-Log

### 4.1 Why per-receipt signatures aren't enough

A receipt signature proves: "the issuer committed to these exact
bytes." It does **not** prove: "the issuer actually published this
receipt; it isn't a private record they fabricated after the fact."

A vendor under regulatory pressure could sign favorable receipts
and shred unfavorable ones. The per-receipt signature catches
_tampering_; it does not catch _suppression_.

### 4.2 Certificate Transparency, applied to AI

Google solved the same problem for SSL/TLS in 2013 with Certificate
Transparency ([RFC 6962](https://www.rfc-editor.org/rfc/rfc6962),
later [RFC 9162](https://www.rfc-editor.org/rfc/rfc9162)): every
issued certificate is appended to a public Merkle log, browsers
refuse certificates not in such a log, and independent monitors +
auditors catch CA misissuance.

ART-Log applies the same architecture to AI agent receipts:

1. **Append-only Merkle tree**. Every receipt's `leafHash =
SHA-256(0x00 || receipt-bytes)` is appended.
2. **Signed Tree Heads (STHs)**. The issuer publishes a signed
   `{logId, treeSize, rootHash, timestamp}` envelope at intervals.
3. **Inclusion proofs**. For any receipt, the log produces an
   `O(log N)`-sized proof that the leaf is in the tree of size N.
4. **Consistency proofs**. Between any two STHs at sizes M and N
   (M < N), the log produces an `O(log N)`-sized proof that the
   tree of size N is an append-only extension of the tree of
   size M. A proof failure means the log forked or rewrote — a
   detectable, mathematical catch.
5. **Witnesses**. Independent third parties (regulators, customer
   security teams, research groups) periodically fetch the STH,
   verify consistency since the last witnessed STH, and submit
   their own Ed25519 signature on the STH canonical bytes. With
   three or more witnesses cross-jurisdictionally distributed,
   a vendor-controlled log fork becomes cryptographically
   infeasible: forking would require the vendor to forge consensus
   across N independent signing keys.

### 4.3 Bitcoin anchoring

Each tree-head root is periodically committed to the Bitcoin
blockchain via OpenTimestamps. This pins the _timing_ of the
tree state to a globally-verifiable ledger that the vendor does
not control. A 2040 auditor can confirm:

- This receipt is in the log at tree size N.
- The tree of size N's root hash is committed to Bitcoin block B.
- Bitcoin block B was mined at time T.
- Therefore the receipt existed by time T — independent of any
  claim from the vendor.

The receipts at the leaves stay verifiable via VAOS v3 signatures
past the post-quantum transition. The anchoring stays verifiable
as long as the Bitcoin chain exists.

---

## 5. Failure modes — what the architecture does and does not solve

### 5.1 What it solves

- **Tampering**: a receipt's signature reproducibly verifies or it
  doesn't.
- **Suppression**: an issuer that signs a receipt but never
  publishes it leaves a gap in the transparency log that audit can
  detect.
- **Backdating**: the Bitcoin anchor pins receipts to a tree state
  at a specific time on a chain the vendor does not control.
- **Forking**: the consistency proof + N-witness signature makes
  divergent log histories cryptographically detectable.
- **Long-term integrity**: ML-DSA-65 dual-signing preserves
  verifiability past the post-quantum cryptographic transition.

### 5.2 What it does NOT solve

- **Model honesty**: VAOS proves what the model returned, not
  whether the model was internally honest. A model that returns
  "I considered factor X" while internally ignoring X cannot be
  caught by receipt verification. This is the domain of
  interpretability research and is out of scope.
- **Issuer key compromise**: if the issuer's signing key is
  exfiltrated, every receipt signed under that key becomes
  forgeable. Key management (HSM, KMS, rotation) is the issuer's
  operational responsibility.
- **Censorship**: VAOS does not force an issuer to issue a receipt
  in the first place. A buyer who needs every decision-in-scope to
  produce a receipt must specify that in their procurement contract.
- **PII protection**: VAOS signs the canonical bytes as-is. If the
  receipt body contains PII, the signature commits to the PII.
  Issuers MUST redact before signing if the receipt may be exposed
  to unauthorized parties.

The architecture is one layer of a defense-in-depth stack, not a
universal AI safety solution.

---

## 6. Comparison to adjacent work

| System / Standard                               | Domain                       | What overlaps with VAOS/ART-Log                   | What differs                                                   |
| ----------------------------------------------- | ---------------------------- | ------------------------------------------------- | -------------------------------------------------------------- |
| Certificate Transparency (RFC 6962 / 9162)      | TLS PKI                      | The Merkle-log architecture is identical          | CT logs certificates; ART-Log logs AI receipts                 |
| Sigstore / Rekor                                | Software supply chain        | The append-only transparency-log pattern          | Sigstore commits to source code, not AI decisions              |
| C2PA / Content Authenticity Initiative          | Media (photo, video)         | PKI-signed provenance for media artifacts         | Different artifact class; VAOS targets agent decisions         |
| Guardtime KSI                                   | General-purpose timestamping | Public-ledger anchoring                           | KSI uses its own ledger; ART-Log uses Bitcoin                  |
| W3C Verifiable Credentials                      | Identity / credentials       | Cryptographic envelope around structured data     | VC targets identity claims, not transient decision records     |
| NeMo Guardrails, Llama Guard, Constitutional AI | In-band AI safety            | Adjacent — guardrails enforce policy at inference | VAOS is post-hoc evidence, not real-time prevention            |
| Trustible.ai, Credo AI, Holistic AI             | AI governance + audit        | Same regulatory target market                     | Use traditional vendor-controlled logs; no crypto verification |

The closest architectural parallel is **Sigstore** for software
supply-chain provenance. The closest spiritual parallel is **C2PA**
for media provenance. The intellectual debt of ART-Log to CT is
explicit and openly acknowledged — we apply the same hash domains,
the same proof shapes, and the same RFC 6962 §2.1 Merkle Tree Hash.

---

## 7. Reference implementation status

| Component                                                                                                         | License    | Status                                                            |
| ----------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------- |
| VAOS specs (1.0 / 2.0 / 3.0)                                                                                      | CC0        | Published; SPEC.md frozen with every npm release                  |
| `@sovereign-matrix/verifiable-receipts`                                                                           | Apache-2.0 | Ready for npm publication (release pipeline wired)                |
| OSS CLI verifier (`verify`)                                                                                       | Apache-2.0 | Shipped — runs against any v1/v2/v3 receipt                       |
| OSS witness CLI (`witness`)                                                                                       | Apache-2.0 | Shipped — any third party can run a witness                       |
| Transparency log (primitives)                                                                                     | Apache-2.0 | Shipped — RFC 6962 inclusion + consistency proofs                 |
| Transparency log (server impl)                                                                                    | (platform) | Shipped — Upstash-backed durable, in-memory dev                   |
| Public `/api/transparency/*` endpoints                                                                            | (platform) | Shipped — CORS-open, no-account                                   |
| Public `/transparency` monitor UI                                                                                 | (platform) | Shipped — visual STH + protocol walkthrough                       |
| Public `/security/live` posture                                                                                   | (platform) | Shipped — machine-readable evidence dashboard                     |
| 11 Guardian rule packs (HIPAA, SR 11-7, NAIC, DSCSA, CSRD, CFPB, MAS, FCA, PCI DSS v4, EU AI Act, NYDFS Part 500) | Apache-2.0 | Shipped                                                           |
| Bitcoin anchoring (OpenTimestamps)                                                                                | OTS        | Wired — anchors hourly via OTS calendar servers                   |
| IETF Internet-Draft                                                                                               | n/a        | Drafted (`draft-dewet-vaos-receipts-00`); ready for submission    |
| External cryptographer review                                                                                     | n/a        | Not yet engaged — Trail of Bits / NCC Group recommended pre-pilot |
| First regulated-vertical pilot                                                                                    | n/a        | Outreach work; not yet underway                                   |

3244 conformance tests cover the cryptographic primitives + the
server endpoints + the CLI tools. The verifier and witness binaries
run in any Node 18+ environment.

---

## 8. Adoption pathway

For a regulated buyer evaluating VAOS adoption:

**Week 1 — Read.** This whitepaper, the VAOS specs in `docs/specs/`,
the reproducible-builds guide in `docs/REPRODUCIBLE.md`, and the
threat model in §9 of `docs/specs/transparency-log.md`.

**Week 2 — Verify the math.** Install the OSS package, download
`/sample-bundle.json` + `/sample-bundle.ed25519.pem`, run the
verifier. Tamper a byte; confirm rejection. Run a consistency-proof
check on the live transparency log.

**Weeks 3-4 — Pilot.** A two-week engagement on a single workflow
(see `/pilot`). One product line, read-only integration into your
existing system of record. 100-200 historical decisions replayed
side-by-side with your existing process.

**Weeks 5-6 — Audit.** Your internal audit team verifies sample
receipts independently using the OSS verifier. Your QPPV / CISO /
chief credit officer signs off or wnds the pilot.

**Month 2+ — Production.** Receipts on every decision in the
scoped workflow. Daily Bitcoin anchoring. Optional: stand up your
own witness running the OSS witness CLI against our log.

**Month 6+ — Scale.** Multi-workflow contract. Cross-vendor
witnesses. Reference the OSS toolkit in your procurement template
so other AI vendors can adopt the same wire format.

---

## 9. Open questions

- **Witness incentives**: in the CT ecosystem, witnesses are
  motivated by browser-vendor policy. In ART-Log we lack a
  comparable institutional driver. Recruiting initial witnesses
  will require explicit contractual or grant funding. The IETF
  Internet-Draft is the first step toward institutional
  legitimacy that could underwrite this.
- **Scaling the log**: today's reference implementation handles
  millions of leaves comfortably. Billions of leaves require a
  more sophisticated storage layout (tile-based stores like
  Sumatra). The interface is forward-compatible; the storage swap
  is a v0.6 problem.
- **Witness honesty**: a witness that signs anything is worse
  than no witness. Witnesses must be operated by parties with a
  stake in the integrity of the log AND with no conflicting
  business relationship with the issuer. Cross-jurisdictional
  diversity (one in EU, one in US, one in Africa, etc.) is the
  practical hedge.
- **Cost of v3 dual-sign**: 3293-byte signatures bloat the receipt
  body by ~50× for the post-quantum half. For high-volume agents
  (millions of receipts per day) the storage cost adds up. A
  reasonable architecture issues v2 receipts by default and v3
  receipts only for decisions with retention horizons > 5 years.

---

## 10. Conclusion

The infrastructure exists today to make AI vendor claims
mechanically reproducible by any third party, without trusting the
vendor's database. The cryptographic primitives are public-domain
(SHA-256, Ed25519, ML-DSA-65, RFC 6962). The reference
implementation is Apache-2.0 on npm. The wire format is in IETF
submission.

What remains is **adoption**: regulated buyers writing the receipt
format into procurement language, other AI vendors implementing
the spec, third parties standing up witnesses, and standards
bodies endorsing the format. None of those steps requires further
cryptographic research; they require sales work, RFP language, and
ecosystem coordination.

The technical bottleneck has been solved. The market bottleneck
has not. This paper is an attempt to accelerate the market side.

---

## 11. Acknowledgments

This work draws on:

- [RFC 6962 / 9162](https://www.rfc-editor.org/rfc/rfc9162) —
  Certificate Transparency, which provided the Merkle-log
  architecture wholesale.
- [NIST FIPS 204](https://csrc.nist.gov/pubs/fips/204/final) —
  ML-DSA standardization.
- [NIST SP 1800-38](https://www.nccoe.nist.gov/projects/migration-post-quantum-cryptography)
  — the dual-signature migration playbook this paper applies.
- The [`@noble/post-quantum`](https://github.com/paulmillr/noble-post-quantum)
  authors for the audited ML-DSA-65 implementation.
- [OpenTimestamps](https://opentimestamps.org/) for the public
  Bitcoin-anchoring infrastructure.

---

## 12. Contact

- Editorial / spec: `spec@sovereignmatrix.agency`
- Security disclosure: `security@sovereignmatrix.agency`
- Pilots: `christiaan@sovereignmatrix.agency`
- Source: <https://github.com/christiaan839-beep/sovereign-v2>
- npm: <https://www.npmjs.com/package/@sovereign-matrix/verifiable-receipts>

---

## License

This paper is published under **CC0 1.0 (public domain)**. Reuse,
fork, cite, build on top of, or republish without restriction.
Attribution appreciated but not required.

— Christiaan de Wet, Cape Town, May 2026
