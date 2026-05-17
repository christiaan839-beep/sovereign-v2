# @sovereign-matrix/verifiable-receipts

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6.svg)](https://www.typescriptlang.org/)

**Pure-TypeScript primitives for cryptographically-signed AI agent receipts.** Drop into any AI agent runtime — zero platform coupling, one dependency, audit-grade by default.

Three composable pieces:

1. **Post-quantum dual-signing** — Ed25519 + ML-DSA-65 (Dilithium3, NIST FIPS 204). Receipts stay verifiable across the post-quantum transition (7–25 year retention horizons covered).
2. **Signed receipt bundles** — pure-Node STORE-method ZIP writer (no compression, byte-deterministic) with a top-level `MANIFEST.signed.json`. Hand the bundle to an auditor; they re-derive the math without unzipping.
3. **Guardian rule runner + 5 regulated-vertical packs** — HIPAA, SR 11-7, NAIC AI Bulletin, DSCSA, EU CSRD. Compose rules into a pack, get a signed verdict envelope.

Extracted from the [Sovereign Matrix](https://sovereignmatrix.agency) platform as a standalone library. Apache 2.0. No runtime fee. No telemetry.

---

## Install

```bash
npm install @sovereign-matrix/verifiable-receipts
# or
pnpm add @sovereign-matrix/verifiable-receipts
```

Node 18+. Single runtime dependency: [`@noble/post-quantum`](https://www.npmjs.com/package/@noble/post-quantum) (for ML-DSA-65 only).

## Quick start — sign + verify a Guardian verdict

```ts
import {
  runGuardian,
  verifyGuardianAttestation,
  hipaaPack,
  composePacks,
  sr117Pack,
} from "@sovereign-matrix/verifiable-receipts";
import {
  createSign,
  createVerify,
  createPrivateKey,
  createPublicKey,
} from "node:crypto";

// 1. Compose the verticals you care about.
const rules = composePacks(hipaaPack, sr117Pack);

// 2. Your existing Ed25519 keypair (one-shot).
const priv = createPrivateKey({
  key: process.env.ED25519_PRIVATE_PEM!,
  format: "pem",
});
const pub = createPublicKey(priv);

// 3. Run the Guardian; sign the verdict.
const verdict = await runGuardian(
  rules,
  {
    runId: "run_test",
    agentSlug: "loan-underwriter",
    tokenId: "tok_abc",
    input: { applicantId: "u1" },
    output: { decision: "approved", reasoning: "..." },
  },
  (canonical) => {
    // Sign with your own primitive — Node Ed25519, HMAC, KMS, anything.
    const sig = require("node:crypto").sign(null, Buffer.from(canonical), priv);
    return `v2=${sig.toString("base64")}`;
  },
);

console.log(verdict.overall); // "pass" | "warn" | "block"
console.log(verdict.signature); // "v2=..."

// 4. An auditor — anywhere in the world — re-verifies.
const result = verifyGuardianAttestation(verdict, (canonical, signature) => {
  if (!signature.startsWith("v2=")) return false;
  const sig = Buffer.from(signature.slice(3), "base64");
  return require("node:crypto").verify(null, Buffer.from(canonical), pub, sig);
});
console.log(result.ok); // true
```

## Quick start — post-quantum dual-signing

```ts
import {
  signMlDsa65,
  verifyMlDsa65,
  generateMlDsa65Keypair,
} from "@sovereign-matrix/verifiable-receipts";

// One-time keygen.
const { secretKeyB64, publicKeyB64 } = generateMlDsa65Keypair();
// Persist secretKeyB64 to env. Publish publicKeyB64 at /.well-known.

// At sign time.
const sig = signMlDsa65(canonical, Buffer.from(secretKeyB64, "base64"));

// At verify time (anywhere, no secret).
const ok = verifyMlDsa65(canonical, sig, Buffer.from(publicKeyB64, "base64"));
```

## Quick start — signed receipt bundle (ZIP + MANIFEST)

```ts
import {
  buildSignedBundle,
  verifyManifest,
} from "@sovereign-matrix/verifiable-receipts";
import { writeFileSync } from "node:fs";

const { zip, manifest } = buildSignedBundle(
  receiptRows, // your BundleReceiptRow[]
  (hash) => sign(hash), // your signer
);

writeFileSync("./company-receipts.zip", zip);
// Hand the ZIP to your auditor.

// The auditor (or you, anywhere in time) re-verifies:
const result = verifyManifest(manifest, (canonical, sig) =>
  verify(canonical, sig),
);
console.log(result.ok); // true | false-with-reason
```

## CLI — verify without writing any code

The package ships a self-hostable verifier binary. After install:

```bash
npx @sovereign-matrix/verifiable-receipts verify \
  --manifest ./MANIFEST.signed.json \
  --pubkey ./ed25519.pem
```

Exit codes: `0` valid · `1` invalid (with `--json` the reason is in the
output: `hash-mismatch` / `signature-mismatch` / `wrong-type` /
`wrong-version`) · `2` usage error.

Pipe via stdin to slot the verifier into any audit pipeline:

```bash
curl -s https://issuer.example/bundles/2026-Q1.json \
  | npx @sovereign-matrix/verifiable-receipts verify --pubkey ./ed25519.pem
```

This is the binary an auditor in 2040 runs against a manifest you
signed in 2026 — `npm install` resolves the same version, the
algorithm doesn't shift, the bytes verify or they don't.

## Wire format spec (frozen with this version)

Every published version of this package ships a frozen copy of the
wire-format spec at `SPEC.md`. It documents:

- v1 (HMAC-SHA256) — legacy VAOS 1.0 compatibility
- v2 (Ed25519, RFC 8032) — public-key verifiable
- v3 (Ed25519 + ML-DSA-65 / Dilithium3, FIPS 204) — post-quantum forward-secure

A receipt signed under this version (0.1.x) verifies forever under
any future verifier that retains v2/v3 support. The math is the
contract. See `SPEC.md` and the canonical sources at
[`docs/specs/vaos-2.0.md`](https://github.com/christiaan839-beep/sovereign-v2/blob/main/docs/specs/vaos-2.0.md)
and [`docs/specs/vaos-3.0.md`](https://github.com/christiaan839-beep/sovereign-v2/blob/main/docs/specs/vaos-3.0.md).

## Why this library exists

In 2026 every regulated buyer asks the same question of every AI vendor: **"if your AI made a decision that ends up in front of a judge, what evidence can you hand the court that the decision was defensible at the moment it was made?"**

The answer most vendors give is "we logged it somewhere." The answer this library lets you give is "here are the bytes, here is the signature, here is the public key. Verify it yourself."

That answer is the moat. It's also the only answer that compounds — the math holds in 2026, in 2030, and (with ML-DSA-65) in 2050.

## Why we open-sourced it

The primitive should be public. Vendors compete on the **integration** of receipts into a workflow, the **dashboard**, the **monitoring**, the **support contract** — not on whether the math is verifiable. Locking the math behind a paywall makes the entire AI-in-regulated-industries category move slower.

So: take it, ship it, run it against your own AI stack. If you're building a regulated-AI product and you want to compare notes, reach out — `christiaan@sovereignmatrix.agency`.

## Five regulated-vertical packs included

| Pack        | Citation                          | Rules                                     |
| ----------- | --------------------------------- | ----------------------------------------- |
| `hipaaPack` | 45 CFR §164.514 Safe Harbor       | SSN block, MRN/DOB/phone warns            |
| `sr117Pack` | Fed SR 11-7 / OCC 2011-12         | bare-numeric block, short-narrative warn  |
| `naicPack`  | NAIC AI Bulletin (Dec 2023)       | protected-class warn, model-citation warn |
| `dscsaPack` | DSCSA §581(11), §582(b)(2)(A)(iv) | NDC + lot/serial enforcement              |
| `csrdPack`  | EU CSRD + ESRS                    | source-citation + double-materiality      |

Every rule cites the specific regulatory clause in its `description`. Pure functions, sub-10ms each, composable.

## Subpath imports

```ts
// Tree-shake just what you need.
import { signMlDsa65 } from "@sovereign-matrix/verifiable-receipts/pq-sign";
import { runGuardian } from "@sovereign-matrix/verifiable-receipts/guardian";
import { buildSignedBundle } from "@sovereign-matrix/verifiable-receipts/bundle";
import { hipaaPack } from "@sovereign-matrix/verifiable-receipts/packs";
```

## License

Apache 2.0 © Sovereign Matrix.

Use it. Fork it. Ship it. We only ask that if you find a bug in the cryptographic primitives, you report it to `security@sovereignmatrix.agency` before public disclosure.
