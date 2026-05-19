# @sovereign-matrix/ai-sdk-receipts

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

**Universal drop-in wrapper that mints post-quantum-signed VAOS
receipts around any Vercel AI SDK call.** Works with OpenAI,
Anthropic, Google, Mistral, Cohere, Groq, or any provider plugged
into the AI SDK.

## Why universal?

The Vercel AI SDK (`ai` on npm) is becoming the de-facto streaming +
multi-provider abstraction for AI calls in Next.js + Node. **One
wrapper around `generateText()` and `generateObject()` covers every
provider the AI SDK supports, present and future** — eliminating
the need for provider-specific receipt packages (though we still
ship `@sovereign-matrix/openai-receipts`,
`@sovereign-matrix/anthropic-receipts`, and
`@sovereign-matrix/google-receipts` for callers using the raw SDKs).

## Install

```bash
npm install @sovereign-matrix/ai-sdk-receipts ai @sovereign-matrix/verifiable-receipts
```

## Quick start — generateText

```ts
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { mintTextReceipt } from "@sovereign-matrix/ai-sdk-receipts";
import { sign as ed25519Sign } from "node:crypto";

const result = await generateText({
  model: openai("gpt-4o"),
  prompt: "Summarize this contract...",
});

// ← One added line:
const receipt = await mintTextReceipt(result, {
  sign: (canonical) =>
    "v2=" +
    ed25519Sign(null, Buffer.from(canonical), privateKey).toString("base64"),
  agentSlug: "contract-summarizer",
  runId: crypto.randomUUID(),
  providerHint: "openai/gpt-4o",
});
```

## Quick start — generateObject (structured output)

```ts
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { mintObjectReceipt } from "@sovereign-matrix/ai-sdk-receipts";

const result = await generateObject({
  model: anthropic("claude-sonnet-4-6"),
  schema: z.object({
    verdict: z.enum(["approved", "denied"]),
    confidence: z.number().min(0).max(1),
  }),
  prompt: "Decide on loan application 12345...",
});

const receipt = await mintObjectReceipt(result, {
  sign,
  agentSlug: "loan-underwriter",
  runId: crypto.randomUUID(),
});

// result.object → { verdict: "approved", confidence: 0.92 }
// receipt.signature → "v2=<base64>" — committed to the OBJECT bytes
```

**Object canonicalization is deterministic** — keys are
lexicographically sorted before stringify, so the same object
produces byte-identical canonical bytes regardless of property
insertion order. Critical for cross-implementation verifier
consistency.

## With jurisdiction-cited rules

```ts
import {
  hipaaPack,
  euAiActPack,
  cfpbPack,
} from "@sovereign-matrix/verifiable-receipts/packs";

const receipt = await mintTextReceipt(result, {
  sign,
  agentSlug: "credit-decisioning",
  runId,
  rules: [...hipaaPack.rules, ...euAiActPack.rules, ...cfpbPack.rules],
});

if (receipt.overall === "block") {
  // A rule explicitly blocked the output (e.g. SSN in clinical note,
  // missing FCRA adverse-action disclosure, etc.)
  throw new Error(
    `Blocked: ${receipt.rules.find((r) => r.verdict === "block")?.ruleId}`,
  );
}
```

42 packs across 7 continents available. See
[`@sovereign-matrix/verifiable-receipts`](https://www.npmjs.com/package/@sovereign-matrix/verifiable-receipts).

## Version-agnostic — AI SDK v3 / v4 / v5

The wrapper accepts both naming conventions for usage tokens:

- **AI SDK v3 / v4:** `usage.promptTokens` + `usage.completionTokens`
- **AI SDK v5:** `usage.inputTokens` + `usage.outputTokens`

Both surface in the receipt's input projection under the canonical
`promptTokens` / `completionTokens` keys.

## API

### `mintTextReceipt(result, opts) → Promise<GuardianAttestation>`

Wraps a `generateText()` result.

### `mintObjectReceipt(result, opts) → Promise<GuardianAttestation>`

Wraps a `generateObject()` result. Uses sorted-key JSON
canonicalization so the receipt is verifier-deterministic.

### `withTextReceipt(promise, opts)` + `withObjectReceipt(promise, opts)`

One-liner helpers that await the AI SDK call + mint the receipt in
a single step:

```ts
const { result, receipt } = await withTextReceipt(
  generateText({ model: openai("gpt-4o"), prompt: "..." }),
  { sign, agentSlug: "x", runId: "y" },
);
```

## Common pattern — Next.js route handler

```ts
// app/api/agents/loan-decision/route.ts
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { mintObjectReceipt } from "@sovereign-matrix/ai-sdk-receipts";
import { cfpbPack } from "@sovereign-matrix/verifiable-receipts/packs";
import { z } from "zod";

export async function POST(req: Request) {
  const { applicantId } = await req.json();
  const runId = crypto.randomUUID();

  const result = await generateObject({
    model: openai("gpt-4o"),
    schema: z.object({
      decision: z.enum(["approved", "denied"]),
      adverseActionCodes: z.array(z.string()),
    }),
    prompt: `Decide on loan ${applicantId}...`,
  });

  const receipt = await mintObjectReceipt(result, {
    sign: process.env.SIGN_FN, // your Ed25519 / KMS signer
    agentSlug: "loan-underwriter",
    runId,
    rules: cfpbPack.rules,
  });

  if (receipt.overall === "block") {
    return Response.json({ error: "blocked", receipt }, { status: 403 });
  }

  return Response.json({
    decision: result.object,
    receipt: {
      verdictId: receipt.verdictId,
      signature: receipt.signature,
      verifyUrl: `/r/${receipt.verdictId}`,
    },
  });
}
```

## Sibling packages

For callers using a raw provider SDK instead of the AI SDK:

- `@sovereign-matrix/openai-receipts` — raw OpenAI SDK
- `@sovereign-matrix/anthropic-receipts` — raw Anthropic SDK
- `@sovereign-matrix/google-receipts` — raw Google Gemini SDK

## License

Apache 2.0 © Sovereign Matrix.
