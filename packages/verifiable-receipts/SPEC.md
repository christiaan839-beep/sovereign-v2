# SPEC.md — Frozen wire specification

This file ships **with every published version of
`@sovereign-matrix/verifiable-receipts`**. The package version is the
authoritative reference: if you `npm install @sovereign-matrix/verifiable-receipts@0.1.0`
in 2040, this file describes exactly what wire formats that version
emits and accepts.

The canonical, version-tracked spec lives in the source repository:
[`docs/specs/`](https://github.com/christiaan839-beep/sovereign-v2/tree/main/docs/specs).
This SPEC.md is a snapshot at publication time.

> The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHOULD**, **MAY**, **OPTIONAL** are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) / [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174).

---

## Quick reference

| Wire prefix | Algorithm           | Sig bytes | Verifier                                     |
| ----------- | ------------------- | --------- | -------------------------------------------- |
| `v1=`       | HMAC-SHA256         | 32        | Shared secret — issuer trusts only itself.   |
| `v2=`       | Ed25519 (RFC 8032)  | 64        | Public-key — anyone with the PEM can verify. |
| `v3=`       | Ed25519 + ML-DSA-65 | 64 + 3293 | Dual — post-quantum forward security.        |

`v1=` is supported for ecosystem compatibility (VAOS 1.0). New
deployments SHOULD emit `v2=` at minimum and SHOULD emit `v3=` for
any record with a retention horizon longer than five years.

---

## Receipt canonical projection

Both signature versions sign **the same bytes**: the UTF-8
byte-stringification of the receipt JSON with keys sorted at every
depth.

```ts
function sortKeysDeep(v: unknown): unknown {
  if (v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map(sortKeysDeep);
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(v as Record<string, unknown>).sort()) {
    out[k] = sortKeysDeep((v as Record<string, unknown>)[k]);
  }
  return out;
}
const canonical = JSON.stringify(sortKeysDeep(receipt));
```

The projection MUST be byte-stable across implementations. The
reference is `stableStringify()` in `dist/bundle.js`.

---

## v2 wire format — Ed25519

```
v2=<base64-of-64-byte-Ed25519-signature>
```

The base64 alphabet is RFC 4648 §4 (standard, NOT URL-safe).

### Sign

```ts
import { sign } from "node:crypto";
const sig = sign(null, Buffer.from(canonical, "utf8"), ed25519SecretKey);
const wire = "v2=" + sig.toString("base64");
```

### Verify

```ts
import { verify } from "node:crypto";
const sig = Buffer.from(wire.slice(3), "base64");
const ok = verify(null, Buffer.from(canonical, "utf8"), ed25519PublicKey, sig);
```

The Ed25519 verification key is published at:

```
https://<issuer-domain>/.well-known/sovereign-receipts/ed25519.pem
```

`Content-Type: application/x-pem-file`, `Access-Control-Allow-Origin: *`.

---

## v3 wire format — Ed25519 + ML-DSA-65 dual-sign

```
v3=<base64-ed25519>.<base64-mldsa65>
```

The literal `.` is the only valid separator. Each half is
independently base64-decoded (standard alphabet).

### Sign

```ts
import { sign as edSign } from "node:crypto";
import { signMlDsa65 } from "@sovereign-matrix/verifiable-receipts/pq-sign";

const bytes = Buffer.from(canonical, "utf8");
const edSig = edSign(null, bytes, ed25519SecretKey);
const pqSig = signMlDsa65(canonical, mldsa65SecretKeyBytes);
const wire = `v3=${edSig.toString("base64")}.${pqSig}`;
```

`signMlDsa65()` returns a raw base64 string. The host must
concatenate it after the Ed25519 half.

### Verify

```ts
import { verifyDualSig } from "@sovereign-matrix/verifiable-receipts/pq-sign";

const verdict = verifyDualSig(
  canonical,
  wire,
  ed25519PublicKey,
  mldsa65PublicKeyBytes,
  (b, k, s) => crypto.verify(null, b, k, s), // host Ed25519 primitive
);

// verdict = { ok: boolean, ed25519: boolean, mldsa65: boolean }
```

Asymmetric outcomes are a feature, not a bug. A verifier in 2040
running against a quantum-broken Ed25519 will see
`{ ok: false, ed25519: false, mldsa65: true }` and SHOULD treat the
receipt as authentic under §7.1 of VAOS 3.0.

### Public-key endpoints

| Key              | URL                                           | Encoding             |
| ---------------- | --------------------------------------------- | -------------------- |
| Ed25519 public   | `/.well-known/sovereign-receipts/ed25519.pem` | PEM (RFC 7468)       |
| ML-DSA-65 public | `/.well-known/sovereign-receipts/mldsa65.b64` | base64 of 1952 bytes |

Both endpoints MUST set `Access-Control-Allow-Origin: *` so any
third-party verifier (browser-based or server-side) can fetch them
without a CORS proxy.

---

## Signed receipt bundle — `MANIFEST.signed.json`

A bundle is a zip of N receipts plus a top-level signed manifest:

```jsonc
{
  "v": 1,
  "type": "verifiable-receipt-bundle",
  "generatedAt": "2026-05-17T00:00:00.000Z",
  "receiptCount": 137,
  "bundleDigest": "<sha256 of concatenated entry hashes>",
  "receipts": [{ "id": "rcpt_...", "hash": "<sha256>" }, ...],
  "manifestHash": "<sha256 of the above object, canonicalized>",
  "signature": "v2=...  or  v3=...  or  v1=..."
}
```

Verifier algorithm (idempotent, no network):

1. Strip `manifestHash` and `signature` from the manifest.
2. Recompute `manifestHash` via `sha256(stableStringify(rest))`.
3. If recomputed `manifestHash !== stored manifestHash` →
   `{ ok: false, reason: "hash-mismatch" }`.
4. Verify `signature` against `manifestHash` using the wire-format
   rules above.
5. If signature verifies → `{ ok: true }`.
   Else → `{ ok: false, reason: "signature-mismatch" }`.

The CLI in `bin/verify.mjs` is the reference implementation. Run it
against any manifest with:

```bash
npx @sovereign-matrix/verifiable-receipts verify \
  --manifest ./MANIFEST.signed.json \
  --pubkey ./ed25519.pem
```

Exit code 0 = valid; 1 = invalid; 2 = usage error. JSON output is
available via `--json`.

---

## Forward compatibility

A receipt signed by this version of the package can be verified by:

- the same version of this package, in perpetuity (this is the
  guarantee — the math is the contract);
- any future version of this package that retains v2/v3 verifiers
  (no retirement is currently planned for either);
- any implementation in any language that re-derives the canonical
  projection per §2 and verifies the signature per §3 / §4 against
  the published keys.

If a future major version of this package deprecates v2 or v3 in
favour of `v4=`, this SPEC.md (frozen with version 0.1.0) is still
correct for receipts signed under 0.1.0. Verifiers SHOULD pin
package versions for long-retention archives.

---

## Conformance

A library is **VAOS 3.0 conformant** iff:

1. It can produce the canonical projection of §2 byte-for-byte
   identically to this package's `stableStringify()`.
2. It can sign with Ed25519 per RFC 8032 §5.1.6.
3. It can sign with ML-DSA-65 per FIPS 204 §6.
4. Its verifier returns `false` when either signature half fails,
   AND surfaces the per-primitive result so a v3.0 verifier can
   apply the forward-compatibility rule of §7.1.
5. It rejects unknown wire prefixes.

Run the test vectors in `docs/specs/vaos-2.0.md` and
`docs/specs/vaos-3.0.md` against your implementation. A diff is a
spec violation; please open an issue.

---

## License

This specification is in the public domain (CC0 1.0). The reference
implementation is Apache-2.0. Use both, fork both, ship both.

---

## Contact

- Editorial: `spec@sovereignmatrix.agency`
- Security: `security@sovereignmatrix.agency`
