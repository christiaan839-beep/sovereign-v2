# @sovereign-matrix/openai-receipts

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

**Drop-in wrapper that mints post-quantum-signed VAOS receipts
around OpenAI SDK calls.** Three lines of integration;
regulator-defensible audit envelope around every chat completion.

## Why this exists

Every regulated buyer using OpenAI asks the same question:

> "If GPT-4 makes a decision the regulator later challenges, what
> evidence do we hand the court that it was defensible at the
> moment it was made?"

OpenAI's answer is "we logged it somewhere." This package is the
**open-source answer that travels with the call** — a
cryptographically-signed, post-quantum-secure receipt that any
third party can verify with the issuer's public key. Apache 2.0,
no vendor lock-in.

## Install

```bash
npm install @sovereign-matrix/openai-receipts openai @sovereign-matrix/verifiable-receipts
```

Peer deps: `openai >=4.0.0`, `@sovereign-matrix/verifiable-receipts >=0.3.0`.

## Quick start — 3 lines

```ts
import OpenAI from "openai";
import { mintCompletionReceipt } from "@sovereign-matrix/openai-receipts";
import { sign as ed25519Sign } from "node:crypto";

const openai = new OpenAI();

const completion = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Summarize this contract..." }],
});

// ← This is the only added line:
const receipt = await mintCompletionReceipt(completion, {
  sign: (canonical) =>
    "v2=" +
    ed25519Sign(null, Buffer.from(canonical), privateKey).toString("base64"),
  agentSlug: "contract-summarizer",
  runId: crypto.randomUUID(),
});

// receipt.signature → "v2=<base64>" — verifiable forever
// receipt.overall   → "pass"
```

## With jurisdiction-cited rules

```ts
import {
  hipaaPack,
  cfpbPack,
} from "@sovereign-matrix/verifiable-receipts/packs";

const receipt = await mintCompletionReceipt(completion, {
  sign,
  agentSlug: "loan-underwriter",
  runId,
  rules: [...hipaaPack.rules, ...cfpbPack.rules],
});

if (receipt.overall === "block") {
  // A rule explicitly blocked the output (e.g. SSN in clinical note)
  // The signed receipt records WHY for the auditor.
  throw new Error(
    `Blocked by rule: ${receipt.rules.find((r) => r.verdict === "block")?.ruleId}`,
  );
}
```

42 jurisdiction packs available — see
[`@sovereign-matrix/verifiable-receipts`](https://www.npmjs.com/package/@sovereign-matrix/verifiable-receipts)
for the full list (HIPAA / SR 11-7 / EU AI Act / CFPB / NAIC / FDA SaMD / etc.).

## Verifying receipts later

Any third party — auditor, regulator, customer — can verify a receipt
with just the issuer's published Ed25519 public key:

```ts
import { verifyGuardianAttestation } from "@sovereign-matrix/verifiable-receipts";
import { verify as ed25519Verify, createPublicKey } from "node:crypto";

const pubKey = createPublicKey(pemBytes);

const ok = verifyGuardianAttestation(receipt, (canonical, signature) => {
  if (!signature.startsWith("v2=")) return false;
  return ed25519Verify(
    null,
    Buffer.from(canonical),
    pubKey,
    Buffer.from(signature.slice(3), "base64"),
  );
});

console.log(ok.ok); // true if the receipt verifies under pubKey
```

Same wire format, same math. Verifiers exist in TypeScript +
Python (`sovereign-matrix-verifiable-receipts`) + Go
(`github.com/christiaan839-beep/sovereign-v2/packages/verifiable-receipts-go`).

## API

### `mintCompletionReceipt(completion, opts) → Promise<GuardianAttestation>`

Mint a signed receipt around an OpenAI chat completion.

- `completion` — the return value of `openai.chat.completions.create()`
  (non-stream).
- `opts.sign(canonical: string) → string` — your signature function.
  Receives canonical UTF-8 bytes; returns wire signature (`v2=<base64>`).
- `opts.agentSlug: string` — stable slug for the agent.
- `opts.runId: string` — caller-supplied UUID for this run.
- `opts.tokenId?: string` — optional idempotency key (defaults to
  `completion.id`).
- `opts.rules?: GuardianRule[]` — optional Guardian rules to evaluate
  against the output. Omit for sign-only.

### `withReceipt(completionPromise, opts) → Promise<{completion, receipt}>`

Convenience one-liner that awaits the OpenAI call + mints the receipt
in a single step:

```ts
const { completion, receipt } = await withReceipt(
  openai.chat.completions.create({ ... }),
  { sign, agentSlug: "x", runId: "y" }
);
```

## What this rules out

- **"We don't have an audit trail."** Every completion produces a
  cryptographically signed receipt.
- **"We can't prove the output wasn't tampered with after the fact."**
  The signature is over the canonical projection of the completion;
  tampering breaks the signature.
- **"Our receipts are forgeable to future quantum computers."** Pair
  with VAOS 3.0 (Ed25519 + ML-DSA-65 dual-signing) for post-quantum
  forward security.

## Doesn't cover

- **Streaming completions** — v0.2 adds streaming attestation via
  VAOS-RSA 1.0 (Merkle tree over chunks). Use the non-stream path
  for v0.1.
- **Embeddings / images / audio** — wrap your own calls; this
  package targets chat completions specifically.

## License

Apache 2.0 © Sovereign Matrix.

If you find a bug in the wrapper, file an issue at
`github.com/christiaan839-beep/sovereign-v2`. If you find a bug in
the cryptographic primitives, email `security@sovereignmatrix.agency`
before public disclosure.
