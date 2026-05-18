# @sovereign-matrix/anthropic-receipts

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

**Drop-in wrapper that mints post-quantum-signed VAOS receipts
around Anthropic SDK calls.** Three lines of integration;
regulator-defensible audit envelope around every Claude message.

## Why this exists

Every regulated buyer using Claude asks the same question:

> "If Claude makes a decision the regulator later challenges, what
> evidence do we hand the court that it was defensible at the
> moment it was made?"

Anthropic's answer is some variant of "we logged it somewhere."
This package is the **open-source answer that travels with the
call** — a cryptographically-signed, post-quantum-secure receipt
that any third party can verify with the issuer's public key.
Apache 2.0, no vendor lock-in.

## Install

```bash
npm install @sovereign-matrix/anthropic-receipts @anthropic-ai/sdk @sovereign-matrix/verifiable-receipts
```

Peer deps: `@anthropic-ai/sdk >=0.30.0`, `@sovereign-matrix/verifiable-receipts >=0.3.0`.

## Quick start — 3 lines

```ts
import Anthropic from "@anthropic-ai/sdk";
import { mintMessageReceipt } from "@sovereign-matrix/anthropic-receipts";
import { sign as ed25519Sign } from "node:crypto";

const client = new Anthropic();

const message = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Summarize this contract..." }],
});

// ← This is the only added line:
const receipt = await mintMessageReceipt(message, {
  sign: (canonical) =>
    "v2=" +
    ed25519Sign(null, Buffer.from(canonical), privateKey).toString("base64"),
  agentSlug: "contract-summarizer",
  runId: crypto.randomUUID(),
});

// receipt.signature → "v2=<base64>" — verifiable forever
// receipt.overall   → "pass"
```

## With jurisdiction-cited rules (42 packs available)

```ts
import {
  hipaaPack,
  euAiActPack,
} from "@sovereign-matrix/verifiable-receipts/packs";

const receipt = await mintMessageReceipt(message, {
  sign,
  agentSlug: "clinical-decision-support",
  runId,
  rules: [...hipaaPack.rules, ...euAiActPack.rules],
});

if (receipt.overall === "block") {
  // A rule explicitly blocked the output (e.g. PHI in summary)
  throw new Error(
    `Blocked: ${receipt.rules.find((r) => r.verdict === "block")?.ruleId}`,
  );
}
```

42 packs across 7 continents: HIPAA / SR 11-7 / EU AI Act /
CFPB / NAIC / FDA SaMD / FERPA / NYC AEDT / Colorado SB 24-205 /
NIST AI RMF / OWASP Agentic Top 10 / MCP governance / and 30 more.
See [`@sovereign-matrix/verifiable-receipts`](https://www.npmjs.com/package/@sovereign-matrix/verifiable-receipts).

## Multi-block content (text + tool-use)

Anthropic messages can contain multiple content blocks (e.g. text

- tool_use). This wrapper extracts **only the text blocks** for the
  receipt's canonical projection — tool calls require the VAOS-RSA
  streaming primitive for proper commitment.

```ts
// Message with text + tool_use blocks:
const receipt = await mintMessageReceipt(message, { sign, agentSlug, runId });
// receipt commits to the concatenated text only; tool-use blocks skipped
```

## API

### `mintMessageReceipt(message, opts) → Promise<GuardianAttestation>`

- `message` — the return value of `client.messages.create()` (non-stream).
- `opts.sign(canonical: string) → string` — your signature function.
- `opts.agentSlug: string` — stable slug for the agent.
- `opts.runId: string` — caller-supplied UUID for this run.
- `opts.tokenId?: string` — optional idempotency key (defaults to `message.id`).
- `opts.rules?: GuardianRule[]` — optional Guardian rules.

### `withReceipt(messagePromise, opts) → Promise<{message, receipt}>`

One-liner that awaits + mints in one step:

```ts
const { message, receipt } = await withReceipt(
  client.messages.create({ ... }),
  { sign, agentSlug: "x", runId: "y" }
);
```

## Verifying receipts later

```ts
import { verifyGuardianAttestation } from "@sovereign-matrix/verifiable-receipts";
import { verify as ed25519Verify, createPublicKey } from "node:crypto";

const pubKey = createPublicKey(pemBytes);

const result = verifyGuardianAttestation(receipt, (canonical, signature) => {
  if (!signature.startsWith("v2=")) return false;
  return ed25519Verify(
    null,
    Buffer.from(canonical),
    pubKey,
    Buffer.from(signature.slice(3), "base64"),
  );
});

console.log(result.ok); // true if the receipt verifies under pubKey
```

Verifiers exist in TypeScript + Python + Go — same wire format,
byte-deterministic across all three.

## Doesn't cover

- **Streaming messages** — v0.2 adds streaming attestation via
  VAOS-RSA 1.0. Use the non-stream `messages.create()` path for v0.1.
- **Tool-use blocks** — committed-to via canonical projection but
  not separately receipt-tracked. Full tool-call commitment is the
  VAOS-RSA streaming primitive's job.

## License

Apache 2.0 © Sovereign Matrix.

Bug reports: `github.com/christiaan839-beep/sovereign-v2`.
Security issues: `security@sovereignmatrix.agency` (90-day
responsible-disclosure window).
