# IETF Internet-Draft: VAOS — Verifiable AI Operation Statements

```
Internet-Draft                                              C. de Wet
Independent Submission                                Sovereign Matrix
Intended status: Informational                            18 May 2026
Expires: 19 November 2026
```

## Status of this Memo

This Internet-Draft is submitted in full conformance with the
provisions of BCP 78 and BCP 79.

Internet-Drafts are working documents of the Internet Engineering
Task Force (IETF). Note that other groups may also distribute
working documents as Internet-Drafts. The list of current Internet-
Drafts is at <https://datatracker.ietf.org/drafts/current/>.

This Internet-Draft will expire on 19 November 2026.

## Copyright Notice

Copyright (c) 2026 Sovereign Matrix and the persons identified as
the document authors. All rights reserved.

This document is subject to BCP 78 and the IETF Trust's Legal
Provisions Relating to IETF Documents
(<https://trustee.ietf.org/license-info>) in effect on the date of
publication of this document. Code components extracted from this
document must include Revised BSD License text as described in
Section 4.e of the Trust Legal Provisions and are provided without
warranty as described in the Revised BSD License.

---

## Abstract

This document specifies a wire format and verification algorithm
for cryptographically signed receipts attesting to the operation of
artificial intelligence agents. The format, called Verifiable AI
Operation Statements (VAOS), provides byte-deterministic canonical
projections that enable independent verification by any party
without coordination with the issuer. Versions 1 (HMAC-SHA256), 2
(Ed25519, RFC 8032), and 3 (Ed25519 + ML-DSA-65 per NIST FIPS 204)
are specified.

VAOS receipts compose with RFC 9162 transparency logs, the C2PA
content-provenance manifest format, and existing supply-chain
attestation primitives. A reference implementation in TypeScript,
Python, and Go is published under the Apache License 2.0.

## Status of this Memo

This memo provides information for the Internet community. It does
not specify an Internet standard of any kind. Distribution of this
memo is unlimited.

## Table of Contents

1. Introduction
2. Conventions and Terminology
3. Wire Format
   3.1. Canonical Projection
   3.2. Version 1 (Legacy HMAC-SHA256)
   3.3. Version 2 (Ed25519)
   3.4. Version 3 (Ed25519 + ML-DSA-65)
4. Verification Algorithm
5. Threshold Cosigning Extension (VAOS-TRS)
6. Streaming Attestation Extension (VAOS-RSA)
7. Discovery via /.well-known/vaos (RFC 8615)
8. Composition with RFC 9162 Transparency Logs
9. Composition with C2PA Manifests
10. Security Considerations
11. IANA Considerations
12. References

---

## 1. Introduction

Modern AI agents act autonomously across organizational boundaries:
they call APIs, modify databases, execute purchases, and recommend
decisions with regulatory consequences. Existing audit infrastructure
treats agent actions as opaque log entries — at best HMAC-signed by
the issuing platform, at worst plain JSON in a SaaS dashboard.

This document specifies VAOS, a wire format that makes every AI
agent operation independently verifiable by any party. The design
goals are:

- **Independent verification.** No dependence on the issuer's
  infrastructure to verify a receipt.
- **Math-as-contract.** The cryptographic primitives (SHA-256,
  Ed25519, ML-DSA-65) are well-studied and standardized; the wire
  format is a thin envelope around them.
- **Post-quantum forward security.** Receipts retained for 7–25
  year regulatory horizons remain verifiable under future quantum
  adversaries.
- **Composable.** VAOS receipts can be transparency-logged
  (RFC 9162), embedded in C2PA manifests, or wrapped in supply-chain
  attestations without modification.

## 2. Conventions and Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT",
"SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in
this document are to be interpreted as described in BCP 14 [RFC2119]
[RFC8174] when, and only when, they appear in all capitals.

- **Issuer**: A party that mints VAOS receipts. Each Issuer holds
  one or more cryptographic key pairs.
- **Verifier**: A party that checks a receipt's validity. Verifiers
  do not require any pre-existing relationship with the Issuer
  beyond the ability to fetch the Issuer's public key.
- **Canonical Projection**: The exact UTF-8 byte string that the
  Issuer signs. Defined in §3.1.
- **Wire Version**: The format version that determines the
  signature algorithm. v1 = HMAC, v2 = Ed25519, v3 = Ed25519 +
  ML-DSA-65.

## 3. Wire Format

### 3.1. Canonical Projection

The Canonical Projection is a JSON document with keys serialized
in lexicographic (alphabetical) order. The encoding is UTF-8
without BOM. Whitespace MUST NOT appear except where required
inside string values.

Issuers MUST produce identical bytes for identical receipts. The
following minimum field set is REQUIRED:

```
{
  "agentSlug": <string>,
  "issuedAt": <ISO 8601 string with 'Z' suffix>,
  "overall": <"pass" | "warn" | "block">,
  "rules": [<rule verdict>...],
  "runId": <string>,
  "tokenId": <string | null>,
  "verdictId": <string>
}
```

Implementations MAY add additional fields. Verifiers MUST tolerate
unknown fields (Postel's law).

### 3.2. Version 1 (Legacy HMAC-SHA256)

```
signature := "v1=" base64( HMAC-SHA256( shared_secret, canonical ) )
```

v1 is supported for legacy compatibility only. It does NOT permit
independent verification — the verifier must hold the same shared
secret as the issuer. New deployments MUST use v2 or v3.

### 3.3. Version 2 (Ed25519)

```
signature := "v2=" base64( Ed25519.sign( private_key, canonical ) )
```

Ed25519 is specified by [RFC8032]. The signature is 64 bytes,
base64-encoded.

### 3.4. Version 3 (Ed25519 + ML-DSA-65)

```
signature := "v3=" base64( ed25519_sig || mldsa65_sig )
```

ML-DSA-65 is specified by [FIPS204]. Both signatures are over the
same canonical bytes. Verifiers MUST verify both signatures; a
single-failure response is "invalid receipt".

This provides forward security against the Harvest-Now-Decrypt-
Later threat model: receipts signed today remain unforgeable to
adversaries with future cryptographically-relevant quantum
computers.

## 4. Verification Algorithm

```
function verify(receipt, public_keys):
  1. Parse signature; reject if prefix not in {v1=, v2=, v3=}.
  2. If contentHash present, recompute sha256(canonical) and
     compare; reject on mismatch.
  3. By version:
       v1: HMAC.verify(shared_secret, canonical, sig)
       v2: Ed25519.verify(public_keys.ed25519, canonical, sig)
       v3: Ed25519.verify(public_keys.ed25519, canonical, ed_sig)
           AND ML-DSA-65.verify(public_keys.mldsa, canonical, pq_sig)
  4. Return OK if all checks pass.
```

A verifier MUST NOT accept a receipt with an unknown version.

## 5. Threshold Cosigning Extension (VAOS-TRS)

A VAOS-TRS envelope aggregates m-of-n cosignatures over the same
canonical projection. The envelope wraps:

```
{
  "scheme": "trs1",
  "canonical": <UTF-8 bytes each cosigner signs>,
  "contentHash": <hex sha256(canonical)>,
  "threshold": { "m": <int>, "n": <int> },
  "authorizedIssuers": [<n distinct issuer ids>],
  "cosigners": [<{issuerId, signature, publicKeyUrl?}>...],
  "assembledAt": <ISO 8601>
}
```

Verification: count cosigner signatures where issuerId is in
authorizedIssuers, signature verifies under that issuer's pubkey,
and issuerId is unique. Return OK iff count ≥ m.

Reference: `docs/specs/vaos-trs-1.0.md`.

## 6. Streaming Attestation Extension (VAOS-RSA)

A VAOS-RSA envelope signs the Merkle root of an LLM stream's
chunk hashes alongside the concatenated final output:

```
{
  "scheme": "rsa1",
  "streamId": <string>,
  "totalChunks": <int>,
  "merkleRoot": <hex sha256>,
  "finalOutput": <string>,
  "finalOutputHash": <hex sha256>,
  "finishedAt": <ISO 8601>
}
```

Per-chunk inclusion proofs reuse the RFC 9162 §2.1.1 algorithm.

Reference: `docs/specs/vaos-rsa-1.0.md`.

## 7. Discovery via /.well-known/vaos (RFC 8615)

Issuers SHOULD serve a discovery document at
`/.well-known/vaos` per [RFC8615] containing:

- Supported wire versions
- Public key URLs (ed25519, ml-dsa-65)
- Transparency log URLs (sth, inclusion proof, witness)
- Issuer registry URL
- Specification references
- Security contact

Discovery responses MUST set CORS `Access-Control-Allow-Origin: *`
to permit cross-origin verifiers.

## 8. Composition with RFC 9162 Transparency Logs

Issuers SHOULD anchor every VAOS receipt to an [RFC9162] transparency
log. The log leaf SHALL be the sha256 of the canonical projection.
Verifiers can then prove a receipt's inclusion in the log via
the standard RFC 9162 inclusion proof verification algorithm.

## 9. Composition with C2PA Manifests

VAOS receipts MAY be wrapped in a [C2PA] manifest assertion with
the reserved label `org.sovereignmatrix.vaos.v1`. The assertion's
`data.vaos` field contains the full VAOS receipt envelope. C2PA
consumers (Adobe Firefly, Microsoft Copilot, Truepic) can surface
VAOS verdicts inline with content provenance.

## 10. Security Considerations

### 10.1 Wire-format non-malleability

The lexicographic canonical projection plus Ed25519 SUF-CMA security
ensures that no signature-respelling or canonical-tamper produces a
different verifying receipt. See proof corpus
`packages/verifiable-receipts/proofs/vaos-v2-non-malleability.md`
for a complete reduction.

### 10.2 Key compromise

A compromised single Issuer key allows retroactive forgery of every
receipt that Issuer ever produced. Mitigation: deploy VAOS-TRS
m-of-n cosigning. With m ≥ ⌈(n+1)/2⌉, the system is Byzantine-
fault-tolerant against minority compromise.

### 10.3 Post-quantum adversaries

v2 (Ed25519-only) receipts become forgeable to cryptographically-
relevant quantum computers. Deployments with retention horizons
beyond ~10 years SHOULD use v3 (Ed25519 + ML-DSA-65).

### 10.4 Replay

Receipts have no built-in replay protection at the wire layer.
Idempotency, where required, SHOULD be enforced at the application
layer using `sha256(canonical)` as the idempotency key. The VAPT
extension for agentic payment tokens does include explicit replay
windows.

## 11. IANA Considerations

This document requests IANA register:

### 11.1 Well-known URI

| URI suffix | Reference           |
| ---------- | ------------------- |
| `vaos`     | §7 of this document |

### 11.2 Media type

```
Media type:     application/vaos+json
Encoding:       UTF-8
Reference:      §3.1 of this document
Owner:          Sovereign Matrix
```

## 12. References

### 12.1 Normative References

- [RFC2119] Bradner, S., "Key words for use in RFCs to Indicate
  Requirement Levels", BCP 14, RFC 2119, March 1997.
- [RFC8032] Josefsson, S. and Liusvaara, I., "Edwards-Curve
  Digital Signature Algorithm (EdDSA)", RFC 8032,
  January 2017.
- [RFC8174] Leiba, B., "Ambiguity of Uppercase vs Lowercase in
  RFC 2119 Key Words", BCP 14, RFC 8174, May 2017.
- [RFC8615] Nottingham, M., "Well-Known Uniform Resource
  Identifiers (URIs)", RFC 8615, May 2019.
- [RFC9162] Laurie, B., Messeri, E., Stradling, R., "Certificate
  Transparency Version 2.0", RFC 9162, December 2021.
- [FIPS204] NIST, "Module-Lattice-Based Digital Signature
  Standard", FIPS 204, August 2024.

### 12.2 Informative References

- [C2PA] Coalition for Content Provenance and Authenticity,
  "C2PA Technical Specification v2.1", 2024.
- [OWASP-AGENTIC] OWASP Foundation, "Top 10 for Agentic AI
  Applications", 2024-2026.

## Author's Address

Christiaan de Wet  
Sovereign Matrix  
Cape Town, South Africa  
Email: spec@sovereignmatrix.agency  
URI: https://sovereignmatrix.agency

---

## Appendix A. Reference Implementation

A reference implementation is published under Apache License 2.0:

- TypeScript (issuer + verifier):
  `@sovereign-matrix/verifiable-receipts` on npm
- Python (verifier): `sovereign-matrix-verifiable-receipts` on PyPI
- Go (verifier):
  `github.com/christiaan839-beep/sovereign-v2/packages/verifiable-receipts-go`

A formal-proof corpus reducing every security claim in §10 to
standard cryptographic assumptions is published at:

`packages/verifiable-receipts/proofs/`

A cross-language conformance test suite ensuring byte-identical
verification across all three reference implementations is at:

`packages/verifiable-receipts/conformance/`

---

This Internet-Draft is intended for submission to the Independent
Stream of the IETF as an Informational RFC, with the goal of
establishing VAOS as a stable, vendor-neutral wire format for AI
operation receipts in the regulatory + procurement landscape.
