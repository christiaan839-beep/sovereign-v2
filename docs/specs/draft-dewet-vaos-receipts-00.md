---
title: "Verifiable Agent Output Specification (VAOS)"
abbrev: "VAOS"
docname: draft-dewet-vaos-receipts-00
category: info
ipr: trust200902

stand_alone: yes
pi: [toc, sortrefs, symrefs]

author:
  - ins: C. de Wet
    name: Christiaan de Wet
    organization: Sovereign Matrix
    email: spec@sovereignmatrix.agency
    country: ZA
    city: Cape Town

normative:
  RFC2119:
  RFC4648:
  RFC7468:
  RFC8032:
  RFC8174:
  RFC6962:
  FIPS204:
    title: "Module-Lattice-Based Digital Signature Standard"
    target: https://csrc.nist.gov/pubs/fips/204/final
    author:
      - org: National Institute of Standards and Technology

informative:
  RFC9162:
  CTRFC:
    title: "Certificate Transparency"
    target: https://certificate.transparency.dev
  C2PA:
    title: "Coalition for Content Provenance and Authenticity"
    target: https://c2pa.org
  SIGSTORE:
    title: "Sigstore — Code signing and transparency log"
    target: https://www.sigstore.dev/
  NIST1800-38:
    title: "Migration to Post-Quantum Cryptography"
    target: https://www.nccoe.nist.gov/projects/migration-post-quantum-cryptography
    author:
      - org: National Institute of Standards and Technology
---

abstract

This document defines the Verifiable Agent Output Specification
(VAOS), an open, portable, cryptographically-signed receipt format
for the outputs of AI agents. A VAOS receipt lets any third party --
auditor, customer, regulator, counterparty -- confirm that a specific
agent run produced a specific output under specific safety checks at
a specific time, without trusting the platform that produced it.

VAOS supports three signature primitives in a single wire-stable
format family:

- v1 = HMAC-SHA256 (shared-secret)
- v2 = Ed25519 (public-key) per RFC 8032
- v3 = Ed25519 + ML-DSA-65 (post-quantum dual-sign) per FIPS 204

VAOS is platform-agnostic. Any agent runtime -- proprietary or
open-source, in any programming language -- that can compute SHA-256
over a canonical-projection of a JSON document can emit and verify
VAOS receipts.

--- middle

# Introduction

## Motivation

In 2026 every regulated buyer of AI services asks the same question:
"If your AI made a decision that ends up in front of a judge, what
evidence can you hand the court that the decision was defensible at
the moment it was made?"

Most AI vendors today answer with internal application logs --
vendor-controlled records that the vendor itself is trusted not to
have rewritten. This trust assumption is incompatible with regulatory
frameworks such as the EU AI Act, the U.S. NIST AI RMF, HIPAA, the
NAIC AI Bulletin, and the FDA's 21 CFR Part 11. Each requires
inspectable audit trails that the audited party cannot unilaterally
alter.

VAOS provides a wire-stable, cryptographically signed receipt that
solves the per-decision integrity question. Combined with an
append-only transparency log (out of scope for this document, but
addressed in a companion specification), VAOS receipts give
regulated-AI buyers procurement-grade evidence that any AI output
is reproducible, attributable, and tamper-evident.

## Requirements Language

{::boilerplate bcp14-tagged}

## Terminology

- **Issuer** -- the party that runs the AI agent and signs the receipt.
- **Verifier** -- any party that holds a receipt, the canonical
  projection algorithm, and the issuer's verification key. The
  verifier need not have any relationship with the issuer.
- **Receipt** -- a JSON document describing a single agent run
  (input, output, agent identity, model identity, safety result,
  timing). See {{receipt-structure}}.
- **Canonical projection** -- the byte-stable UTF-8 serialization
  of a receipt, used as the signing input. See {{canonical}}.
- **Signature** -- the wire-format string of the form
  `v<n>=<base64>` (or `v3=<base64>.<base64>` for dual-sign). See
  {{signatures}}.

# Receipt Structure {#receipt-structure}

A VAOS receipt is a JSON object with the following REQUIRED fields:

| Field          | Type                         | Description                                          |
| -------------- | ---------------------------- | ---------------------------------------------------- |
| `v`            | integer                      | Schema version; MUST be 1 for this document.         |
| `id`           | string                       | Globally-unique receipt id chosen by the issuer.     |
| `agentName`    | string                       | Identifier of the AI agent that produced the output. |
| `modelUsed`    | string                       | Identifier of the underlying model.                  |
| `input`        | object \| array \| primitive | The input to the agent run.                          |
| `output`       | object \| array \| primitive | The output of the agent run.                         |
| `safetyResult` | object                       | Outcome of the safety checks applied to `output`.    |
| `durationMs`   | integer                      | Wall-clock duration of the run in milliseconds.      |
| `createdAt`    | string (RFC 3339 timestamp)  | When the run completed.                              |
| `signature`    | string                       | Wire-format signature; see {{signatures}}.           |

Implementations MAY include additional fields. Additional fields
MUST be included in the canonical projection ({{canonical}}) so they
participate in the signature.

# Canonical Projection {#canonical}

A VAOS verifier MUST recompute the byte-stable UTF-8 serialization
of the receipt's content fields (all fields except `signature`) by
applying the following algorithm:

1. Remove the `signature` field.
2. Recursively sort the resulting object's keys at every depth using
   lexicographic ordering of UTF-16 code units.
3. JSON-stringify the result with no whitespace, using ECMA-404
   serialization for numbers, strings, booleans, `null`, arrays, and
   objects.

The resulting UTF-8 byte string is the input to all signature
primitives defined in {{signatures}}.

# Signatures {#signatures}

VAOS defines three signature wire formats, distinguished by a
version prefix on the `signature` field. A verifier MUST dispatch on
the prefix and reject any unrecognized version.

## v1 -- HMAC-SHA256

```
v1=<lowercase-hex of 32-byte HMAC-SHA256 of canonical bytes>
```

The HMAC key is shared out-of-band between issuer and verifier. v1
is RECOMMENDED only for closed-loop deployments where both parties
are operationally co-located; it does NOT support independent
third-party verification.

## v2 -- Ed25519

```
v2=<RFC 4648 standard-alphabet base64 of 64-byte Ed25519 signature>
```

Ed25519 signature per {{RFC8032}} Section 5.1.6 over the canonical
bytes. The verification key (32-byte public key) MUST be published
at a stable URL; the RECOMMENDED location is

```
https://<issuer-domain>/.well-known/sovereign-receipts/ed25519.pem
```

in PEM format ({{RFC7468}}) with HTTP response headers
`Content-Type: application/x-pem-file` and
`Access-Control-Allow-Origin: *`.

## v3 -- Ed25519 + ML-DSA-65 dual-sign

```
v3=<base64-ed25519>.<base64-ml-dsa-65>
```

Two independent signatures over the SAME canonical bytes,
concatenated with a literal `.` separator. The Ed25519 half is
identical to the v2 form. The ML-DSA-65 half is the FIPS 204
({{FIPS204}}) Dilithium3 signature output, base64-encoded with the
RFC 4648 standard alphabet.

A v3 verifier MUST report per-primitive verification results in the
following envelope:

```
{ "ok": <both-verified>, "ed25519": <bool>, "mldsa65": <bool> }
```

The asymmetric outcome `{ ok: false, ed25519: false, mldsa65: true }`
is well-defined and indicates a post-quantum-adversary scenario in
which the classical primitive has been broken but the post-quantum
primitive holds. A receipt MUST be treated as authentic in this
case under the forward-security clause; issuers SHOULD rotate keys.

## Algorithm Confusion Mitigation

Verifiers MUST hard-branch on the version prefix. Implementations
MUST NOT attempt fallback verification under a different algorithm
when a primary check fails. The set of recognized prefixes is
closed at `{v1, v2, v3}` for this document; future versions will
reserve additional prefixes via the IANA registry (Section
{{iana}}).

# Verification Procedure

Given a receipt and the issuer's verification key(s), a verifier:

1. Parses the `signature` field's version prefix.
2. Strips the prefix and decodes the remainder per the algorithm
   identified.
3. Recomputes the canonical projection of the receipt per
   {{canonical}}.
4. Invokes the corresponding signature-primitive verifier with the
   canonical bytes, the decoded signature, and the verification key.
5. For v3 only: invokes both primitives and produces the envelope
   described in {{signatures}}.
6. Returns the boolean verification result (and, for v3, the
   per-primitive envelope).

A verifier MUST NOT execute side-effects (database writes, network
calls, log lines containing the receipt body) before the signature
check returns true.

# IANA Considerations {#iana}

This document requests IANA to establish the "VAOS Signature Version
Prefix" registry. Initial values:

| Prefix | Algorithm                     | Reference     |
| ------ | ----------------------------- | ------------- |
| `v1=`  | HMAC-SHA256                   | This document |
| `v2=`  | Ed25519                       | This document |
| `v3=`  | Ed25519 + ML-DSA-65 dual-sign | This document |

Future allocations MUST follow Specification Required ({{RFC8126}}).

# Security Considerations

## Cryptographic Security

- Ed25519 provides classical 128-bit security ({{RFC8032}}).
- ML-DSA-65 (Dilithium3) provides NIST Category 3 post-quantum
  security ({{FIPS204}}).
- HMAC-SHA256 (v1) provides 128-bit security against unauthorized
  signature forgery, but relies on a shared secret; compromise of
  the secret invalidates every receipt signed under it.

## Threat Model

| Threat                                             | Mitigation                                                                                                   |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Forged signature without key                       | Cryptographically infeasible under the security assumptions of the underlying primitive.                     |
| Issuer key exfiltration                            | Out of scope; manage keys in an HSM or KMS. The protocol signs whatever the host hands it.                   |
| Cross-protocol confusion                           | The version prefix is a hard branch in the verifier. Implementations MUST NOT attempt fallback verification. |
| Cryptographically-relevant quantum computer (CRQC) | Ed25519 falls; ML-DSA-65 holds. Dual-sign receipts remain verifiable under the post-quantum primitive.       |
| Canonical projection drift                         | Implementations MUST share the projection algorithm. The reference implementation is normative.              |

## Replay

VAOS does not address replay -- a receipt with the same content and
signature is trivially identical regardless of where it appears.
Replay prevention is a property of the deployment around VAOS (e.g.,
an idempotency table or an append-only transparency log).

## PII

VAOS does not impose PII redaction. Issuers MUST NOT include
personal data in the receipt body if the receipt may be exposed to
parties without authorization to see it. Compliance frameworks
(GDPR, POPIA, HIPAA) take precedence over verifiability when in
conflict; redact before signing.

# Acknowledgments

This document is informed by:

- {{RFC6962}} / {{RFC9162}} (Certificate Transparency) for the
  transparency log architecture that complements VAOS.
- {{C2PA}} for content provenance signing in adjacent domains.
- {{SIGSTORE}} for software-supply-chain transparency.
- {{NIST1800-38}} for the dual-signature migration pattern that
  VAOS v3 adopts.

--- back

# Reference Implementation

A reference implementation of VAOS verifiers (v1, v2, v3) ships as
an Apache-2.0 npm package:

- Name: `@sovereign-matrix/verifiable-receipts`
- Source:
  https://github.com/christiaan839-beep/sovereign-v2/tree/main/packages/verifiable-receipts
- Frozen specification per published version: `SPEC.md` inside the
  package distribution.

The same repository provides a Certificate-Transparency-style
transparency log primitive set and a self-hostable CLI verifier.

# Test Vectors

## A.1 -- VAOS v2 minimal receipt

Receipt (whitespace shown for readability; not part of the
canonicalization input):

```json
{
  "v": 1,
  "id": "rcpt_test_001",
  "agentName": "echo",
  "modelUsed": "nim-nemotron",
  "input": { "prompt": "hello" },
  "output": { "text": "hello" },
  "safetyResult": { "passed": true, "score": 1.0 },
  "durationMs": 42,
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

Canonical projection (UTF-8 bytes; no whitespace):

```
{"v":1,"id":"rcpt_test_001","agentName":"echo","modelUsed":"nim-nemotron","input":{"prompt":"hello"},"output":{"text":"hello"},"safetyResult":{"passed":true,"score":1},"durationMs":42,"createdAt":"2026-01-01T00:00:00.000Z"}
```

Sign with any Ed25519 keypair per {{RFC8032}}. The resulting
signature, prepended with `v2=` and base64-encoded, is the value
of the receipt's `signature` field.

## A.2 -- VAOS v3 dual-sign

Sign the canonical bytes of A.1 with Ed25519 AND with ML-DSA-65.
Concatenate the base64-encoded outputs with a literal `.` separator
and prepend `v3=`. The resulting wire string verifies against both
the Ed25519 and ML-DSA-65 public keys independently.

# Change Log

- `-00` (Initial submission) -- Defines v1, v2, v3 wire formats,
  canonical projection algorithm, verification procedure, IANA
  registry request, security considerations, and test vectors.

# Author's Address

Christiaan de Wet
Sovereign Matrix
Cape Town, South Africa
spec@sovereignmatrix.agency
