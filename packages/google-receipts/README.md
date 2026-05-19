# @sovereign-matrix/google-receipts

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

**Drop-in wrapper that mints post-quantum-signed VAOS receipts
around Google Gemini SDK calls.** Three-line integration;
regulator-defensible audit envelope around every Gemini generation.

## Install

```bash
npm install @sovereign-matrix/google-receipts @google/generative-ai @sovereign-matrix/verifiable-receipts
```

## Quick start

```ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { mintGenerationReceipt } from "@sovereign-matrix/google-receipts";
import { sign as ed25519Sign } from "node:crypto";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

const result = await model.generateContent("Summarize this contract...");

// ← One added line:
const receipt = await mintGenerationReceipt(result, {
  sign: (canonical) =>
    "v2=" +
    ed25519Sign(null, Buffer.from(canonical), privateKey).toString("base64"),
  agentSlug: "contract-summarizer",
  runId: crypto.randomUUID(),
  modelName: "gemini-1.5-pro",
});
```

## With jurisdiction-cited rules

```ts
import {
  hipaaPack,
  euAiActPack,
} from "@sovereign-matrix/verifiable-receipts/packs";

const receipt = await mintGenerationReceipt(result, {
  sign,
  agentSlug: "clinical-decision-support",
  runId,
  modelName: "gemini-1.5-pro",
  rules: [...hipaaPack.rules, ...euAiActPack.rules],
});
```

42 packs available — see `@sovereign-matrix/verifiable-receipts`.

## Notes specific to Gemini

- **No stable response id.** Gemini doesn't return an `id` field like
  OpenAI does. This wrapper derives a deterministic `tokenId` from
  the first candidate's `finishReason` + safety-rating category when
  caller omits one. Pass an explicit `tokenId` for proper idempotency.
- **Multi-candidate generation surfaces all candidates.** Unlike
  the SDK's `.text()` method (which returns the first candidate),
  this wrapper concatenates text across every candidate so n-best
  sampling commits everything to the receipt.
- **`modelName` parameter recommended.** Gemini SDK doesn't echo
  the model in the response; pass it from your
  `getGenerativeModel({ model: "..." })` call site.

## API

### `mintGenerationReceipt(result, opts) → Promise<GuardianAttestation>`

### `withReceipt(resultPromise, opts) → Promise<{result, receipt}>`

## Sibling packages

- `@sovereign-matrix/openai-receipts` — OpenAI SDK wrapper
- `@sovereign-matrix/anthropic-receipts` — Anthropic SDK wrapper
- `@sovereign-matrix/ai-sdk-receipts` — Vercel AI SDK universal wrapper

## License

Apache 2.0 © Sovereign Matrix.
