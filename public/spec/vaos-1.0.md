# VAOS 1.0 — Verifiable Agent Output Specification

| Field          | Value                                                          |
| -------------- | -------------------------------------------------------------- |
| Version        | 1.0                                                            |
| Status         | Draft (open for comment)                                       |
| Editor         | Sovereign Matrix — `spec@sovereignmatrix.agency`               |
| License        | CC0 1.0 (public domain)                                        |
| Reference impl | `@sovereign-matrix/vaos-verifier` (MIT)                        |
| Discussion     | https://github.com/christiaan839-beep/sovereign-v2/discussions |

> The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174).

---

## 1. Abstract

The Verifiable Agent Output Specification (**VAOS**) defines a portable,
cryptographically signed receipt for the output of an AI agent. A VAOS
receipt lets any third party — auditor, customer, regulator,
counterparty — confirm that a specific agent run produced a specific
output, with specific safety checks, at a specific time, **without
trusting the platform that produced it**.

VAOS is platform-agnostic. Any agent runtime — proprietary or
open-source, Node or Python or Rust or Go — that can compute
HMAC-SHA256 over a JSON document can emit and verify VAOS receipts.

This document is in the public domain. Implementations are
encouraged. Compliance and audit tooling SHOULD recognize VAOS
receipts as a valid evidence format under EU AI Act Art. 12, POPIA
s. 71, and equivalent automated-decision-traceability requirements.

## 2. Motivation

Enterprises blocking AI agent deployments cite the same blocker:
inability to _prove_ what an agent actually did. Existing audit-log
formats (CloudTrail, Audit Logs API, OpenTelemetry traces) record
what the _platform_ claims happened. None are tamper-evident from a
non-platform observer.

VAOS closes this gap with a single primitive: every agent output is
signed by the platform over a deterministic canonical projection of
its inputs, model, safety results, and outputs. A reader holding the
receipt can recompute the canonical projection and verify the
signature against the platform's public verification endpoint —
without the platform sharing its signing key.

## 3. Terminology

| Term                     | Definition                                                                  |
| ------------------------ | --------------------------------------------------------------------------- |
| **Run**                  | A single invocation of an AI agent producing one output.                    |
| **Receipt**              | A VAOS document representing a Run, including signature.                    |
| **Canonical projection** | A byte-deterministic JSON serialization of a Run, used as the HMAC payload. |
| **Signing key**          | A symmetric secret held only by the issuing platform.                       |
| **Issuer**               | The platform that produced and signed a Receipt.                            |
| **Verifier**             | Any party (including the Issuer) that confirms a Receipt's authenticity.    |

## 4. Receipt Structure

A VAOS Receipt is a JSON object with the following fields:

| Field           | Type                 | Required | Notes                                                                                                    |
| --------------- | -------------------- | -------- | -------------------------------------------------------------------------------------------------------- |
| `id`            | UUID v4 string       | yes      | Stable, opaque identifier.                                                                               |
| `agentName`     | string               | yes      | Issuer-defined slug.                                                                                     |
| `modelUsed`     | string               | yes      | Free-form; e.g. `"claude-sonnet-4-6"`.                                                                   |
| `input`         | JSON value           | yes      | Whatever the agent received.                                                                             |
| `output`        | JSON value           | yes      | Whatever the agent produced.                                                                             |
| `safetyResult`  | object               | yes      | See §5.                                                                                                  |
| `durationMs`    | non-negative integer | yes      | Wall-clock duration of the Run.                                                                          |
| `chainDepth`    | non-negative integer | no       | Default 0. Depth in agent-to-agent chain.                                                                |
| `trustDecision` | enum                 | no       | `"auto-approved"` \| `"needs-approval"` \| `"blocked"`. Default `"auto-approved"`.                       |
| `visibility`    | enum                 | no       | `"private"` \| `"public"` \| `"unlisted"`. Default `"private"`. Discovery hint, not a security boundary. |
| `signature`     | string               | yes      | See §6.                                                                                                  |
| `canonical`     | string               | no       | Echoed canonical projection. Convenience for verifiers.                                                  |
| `createdAt`     | RFC 3339 timestamp   | yes      | When the Run completed.                                                                                  |

Implementations **MAY** include additional fields. Additional fields
**MUST NOT** appear in the canonical projection (§6) and therefore do
not affect the signature.

## 5. Safety Result Object

The `safetyResult` field carries the per-Run output of safety checks.
Standard sub-fields:

| Sub-field   | Type                 | Notes                                   |
| ----------- | -------------------- | --------------------------------------- |
| `jailbreak` | `"pass"` \| `"fail"` | Prompt-injection / jailbreak detection. |
| `pii`       | `"pass"` \| `"fail"` | Personal-info detection in output.      |
| `content`   | `"pass"` \| `"fail"` | Content-policy classification.          |
| `quality`   | integer 0–100        | Output quality score.                   |
| `critic`    | `"pass"` \| `"fail"` | Independent critic-model review.        |

All sub-fields are **OPTIONAL**. An issuer that does not run a given
check **MUST** omit the sub-field rather than emit a placeholder.
Issuers **MAY** include additional safety sub-fields; verifiers
**SHOULD** preserve unknown sub-fields for forward compatibility.

## 6. Canonical Projection

The canonical projection is the JSON document signed by the Issuer.
It is derived from a Receipt by:

1. Constructing a new JSON object with the following top-level fields
   in **EXACTLY** this order:
   ```
   v, id, agentName, modelUsed, input, output, safetyResult,
   durationMs, createdAt
   ```
2. For `input`, `output`, and `safetyResult`: applying `sortKeysDeep`
   (§6.1) to recursively sort object keys.
3. Setting `v` to the integer `1` (this version of the spec).
4. Serializing the result with `JSON.stringify` (RFC 8259) using:
   - **NO** indentation
   - UTF-8 encoding
   - The default JSON escape rules

The canonical projection is the **EXACT byte sequence** produced by
the above procedure. Two implementations producing different bytes
for the same logical Run are non-conformant.

### 6.1 sortKeysDeep

```
function sortKeysDeep(value):
  if value is null OR type-of(value) is primitive: return value
  if value is array: return [sortKeysDeep(v) for v in value]   # preserve order
  out = empty object
  for key in sorted-ascending(Object.keys(value)):
    out[key] = sortKeysDeep(value[key])
  return out
```

Arrays preserve element order — array order **IS** semantic input.

`undefined` properties are dropped (matching JSON.stringify default).
`NaN` and `Infinity` become `null` (matching JSON.stringify default).

## 7. Signature

The `signature` field is constructed as:

```
signature = "v1=" || hex(HMAC-SHA256(signing_key, canonical_projection))
```

Where:

- `||` is string concatenation
- `hex(x)` is the lower-case hexadecimal representation of `x`
- `signing_key` is a UTF-8 byte sequence of length **at least 16 bytes**
- `canonical_projection` is the UTF-8 encoded byte sequence from §6

The literal prefix `"v1="` is the algorithm identifier. Future
revisions of this spec **MAY** introduce `"v2="`, etc. Verifiers
**MUST** reject any `signature` whose prefix they do not implement.

The Issuer **MUST NOT** transmit, log, or otherwise disclose
`signing_key`. Compromise of `signing_key` invalidates the trust
guarantees of every Receipt signed under that key.

The literal string `"unsigned"` is the **sentinel for unsigned
Receipts**. A Receipt with `signature == "unsigned"` is still a
syntactically valid Receipt but **MUST** fail verification under any
signing key.

## 8. Verification Procedure

Given a Receipt `R` and a verifier endpoint `E`:

1. The Verifier extracts `R.canonical` (or recomputes it from §6 if
   absent).
2. The Verifier extracts `R.signature`.
3. The Verifier sends `{ canonical, signature }` to `E` over HTTPS.
4. `E` recomputes `expected = "v1=" || hex(HMAC-SHA256(signing_key,
canonical))` and performs a **constant-time** comparison against
   `signature`.
5. `E` returns `{ valid: boolean, algorithm: "HMAC-SHA256",
canonicalVersion: 1 }`.

The Verifier **MUST NOT** trust the Issuer's transmission of
`R.canonical` blindly — it **SHOULD** also recompute the canonical
projection from `R`'s data fields and assert byte equality before
calling `E`. This prevents a malicious Issuer from sending a "happy"
canonical that doesn't match the receipt's actual data.

### 8.1 HTTP API

A conformant Issuer **MUST** expose a verification endpoint at:

```
POST /api/verify
Content-Type: application/json
Origin: <any>           — open CORS REQUIRED

Request body:
  { "canonical": string, "signature": string }

Response (200):
  {
    "valid": boolean,
    "algorithm": "HMAC-SHA256",
    "canonicalVersion": 1,
    "id":        string?     # echoed from canonical when JSON-parseable
    "agentName": string?
    "createdAt": string?
  }

Response (400):
  Malformed body.

Response (429):
  Rate limited (Issuer SHOULD rate-limit by IP at >= 60 req/min).
```

The endpoint **MUST NOT** require authentication. Verification is a
public good; a Receipt that only the Issuer can verify is not
verifiable.

The endpoint **MUST NOT** set `Access-Control-Allow-Credentials:
true`. Verification is stateless and never reads cookies; combining
credentials with a wildcard origin is a known auth-leak vector.

## 9. Visibility

The `visibility` field is a discovery hint to Issuers about whether a
Receipt may be exposed cross-origin. It is **NOT** a security
boundary:

- `private`: Issuer **SHOULD** require Receipt-owner authentication
  before serving the full Receipt cross-origin.
- `unlisted`: Anyone with the `id` may fetch the Receipt cross-origin.
- `public`: Same as `unlisted` plus eligible for inclusion in public
  feeds (e.g. RSS, sitemap).

Verification (§8) **MUST NOT** depend on visibility. A `private`
Receipt with valid signature **MUST** verify as `valid: true` if its
`canonical` and `signature` are presented to `/api/verify`.

## 10. Threat Model

VAOS guarantees:

| Property                         | Guarantee                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------- |
| **Receipt integrity**            | An adversary without `signing_key` cannot forge a Receipt that verifies.        |
| **Tamper detection**             | Modifying any field in §6's canonical projection invalidates the signature.     |
| **Cross-platform verifiability** | Any verifier with HMAC-SHA256 can independently re-derive and check signatures. |

VAOS does **NOT** guarantee:

| Property                              | Why not                                                                                                                                                                                             |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Non-repudiation**                   | HMAC is symmetric; a colluding insider could forge. Use case for asymmetric extension (§13).                                                                                                        |
| **Confidentiality of inputs/outputs** | Receipts are plaintext. Wrap in TLS or encrypt the contents at rest.                                                                                                                                |
| **Freshness**                         | An Issuer may sign a Receipt with an arbitrary `createdAt`. Layer with a notarization service if temporal proof matters.                                                                            |
| **Operational truth**                 | A Receipt proves the Issuer _claims_ an agent run produced this output. It does not prove the agent actually executed — that requires hardware attestation or model attestation, both out of scope. |

## 11. Versioning

This document defines `v1` of the canonical projection (§6) and the
`"v1="` signature prefix (§7).

Future revisions:

- A change to the canonical projection field order, sort algorithm,
  or stringify rules **REQUIRES** a new version number (e.g. `v2`).
- A new HMAC algorithm (e.g. HMAC-SHA512) **REQUIRES** a new
  signature prefix.
- A new safety sub-field that does not affect canonical projection
  serialization is a backwards-compatible extension and does not
  require a version bump.

Issuers **MAY** sign the same logical Receipt under multiple
signature versions and emit them as `signatures: ["v1=...",
"v2=..."]`. Verifiers presented with multiple signatures **SHOULD**
verify whichever version they implement.

## 12. Test Vectors

The following pairs (canonical, signature) are normative test
vectors. A conformant Verifier **MUST** return `valid: true` for
each pair when given the corresponding signing key.

### 12.1 Vector A — minimal Receipt

```
signing_key: "test_secret_with_enough_entropy_aaaa"
canonical:   {"v":1,"id":"abc","agentName":"hello","modelUsed":"x","input":{},"output":{},"safetyResult":{},"durationMs":0,"createdAt":"2026-05-10T00:00:00.000Z"}
signature:   v1=dabba36cf04ec48c11dc12adc1cee6c1f8d1f48e2c20f33b9bb01dac51049ada
```

### 12.2 Vector B — nested input + tampered output

```
signing_key: "test_secret_with_enough_entropy_aaaa"
canonical (genuine):
  {"v":1,"id":"vec-b","agentName":"summarize","modelUsed":"claude-sonnet-4-6","input":{"meta":{"a":1,"z":2},"topic":"AI"},"output":{"text":"hello"},"safetyResult":{"critic":"pass","jailbreak":"pass"},"durationMs":1234,"createdAt":"2026-05-10T12:00:00.000Z"}
signature (genuine):
  v1=27e54d8a25cdc7ff3960faaa1e0b7e1e25a8a99f7c1d6e7a9e57a36ac6a39a05

canonical (tampered output to "goodbye"):
  {"v":1,"id":"vec-b","agentName":"summarize","modelUsed":"claude-sonnet-4-6","input":{"meta":{"a":1,"z":2},"topic":"AI"},"output":{"text":"goodbye"},"safetyResult":{"critic":"pass","jailbreak":"pass"},"durationMs":1234,"createdAt":"2026-05-10T12:00:00.000Z"}
signature against tampered:  MUST be valid: false
```

> Implementers verifying these vectors are expected to compute the
> HMAC themselves; the values shown above are the canonical
> byte-sequence to sign and the expected signature prefix format.
> Reference implementation: `@sovereign-matrix/vaos-verifier`.

## 13. Future Extensions

The following are out of scope for v1 but anticipated in subsequent
revisions:

- **Asymmetric signatures** (Ed25519) for non-repudiation.
- **Model attestation chaining** — receipt includes a hash of model
  weights' signed manifest.
- **Hardware attestation** — TEE-signed claim of where the Run
  executed.
- **Receipt notarization** — third-party trusted timestamp service
  that countersigns the Issuer's signature, providing freshness.
- **Trust bundles** — a list of public verification endpoints
  recognized by a given consumer (similar to a CA bundle).

These will be considered for VAOS 2.0.

## 14. Acknowledgements

VAOS draws on:

- HMAC (RFC 2104)
- JSON canonicalization (JCS, RFC 8785) — VAOS's §6 is a more
  permissive variant
- Stripe's webhook signature scheme — `t=` / `v1=` envelope inspiration
- SSL Certificate Transparency — public-verifiability framing
- POPIA s. 71, EU AI Act Art. 12, GDPR Art. 22 — regulatory motivation

## 15. Contact

- Spec authoring: `spec@sovereignmatrix.agency`
- Reference implementation issues: https://github.com/christiaan839-beep/sovereign-v2/issues
- Endorsing organizations / partnership inquiries: contact above
- Security disclosures: `security@sovereignmatrix.agency`

This document is published under CC0 1.0. Implementations,
extensions, and forks are explicitly encouraged.
