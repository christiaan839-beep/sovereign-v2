/**
 * @sovereign-matrix/ai-sdk-receipts
 *
 * Universal drop-in wrapper that mints VAOS receipts around any
 * Vercel AI SDK call — works with OpenAI, Anthropic, Google,
 * Mistral, Cohere, Groq, or any provider plugged into the AI SDK.
 *
 * Why this exists:
 *   The Vercel AI SDK (`ai` on npm) is becoming the de-facto streaming
 *   abstraction for AI calls in Next.js + Node. One wrapper around
 *   `generateText()` and `generateObject()` covers every provider
 *   the AI SDK supports, present and future — eliminating the need
 *   for provider-specific receipt packages (though we still ship
 *   them for callers using the raw SDKs).
 *
 * Usage:
 *
 *   import { generateText } from "ai";
 *   import { openai } from "@ai-sdk/openai";
 *   import { mintTextReceipt } from "@sovereign-matrix/ai-sdk-receipts";
 *
 *   const result = await generateText({
 *     model: openai("gpt-4o"),
 *     prompt: "Summarize this contract...",
 *   });
 *
 *   const receipt = await mintTextReceipt(result, {
 *     sign,
 *     agentSlug: "contract-summarizer",
 *     runId: crypto.randomUUID(),
 *     providerHint: "openai/gpt-4o", // optional, surfaces in input projection
 *   });
 *
 * @packageDocumentation
 */

import {
  runGuardian,
  type GuardianAttestation,
  type GuardianRule,
} from "@sovereign-matrix/verifiable-receipts";

/**
 * Minimal shape of a Vercel AI SDK `generateText()` result.
 * Matches the v5 return value but accepts older versions loosely.
 *
 * We intentionally accept this loose shape rather than `import type`
 * from `ai` — keeps this package zero-runtime-dep + lets it work
 * across AI SDK major versions (v3 / v4 / v5).
 */
export interface AiSdkTextResult {
  text: string;
  finishReason?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    inputTokens?: number;
    outputTokens?: number;
  };
  response?: {
    id?: string;
    modelId?: string;
    timestamp?: Date;
  };
  warnings?: unknown[];
}

/**
 * Minimal shape of a Vercel AI SDK `generateObject()` result.
 * The object itself is generic; the wrapper commits to its JSON
 * stringification in the canonical projection.
 */
export interface AiSdkObjectResult<T = unknown> {
  object: T;
  finishReason?: string;
  usage?: AiSdkTextResult["usage"];
  response?: AiSdkTextResult["response"];
  warnings?: unknown[];
}

export interface MintAiSdkReceiptOptions {
  /**
   * Sign function. Caller supplies their own crypto primitive — Node
   * `crypto.sign`, `@noble/ed25519`, KMS HSM, whatever. Receives the
   * exact UTF-8 bytes that need to be signed and returns the wire
   * signature (typically `v2=<base64>` per VAOS 2.0).
   */
  sign: (canonical: string) => string;
  /** Stable slug for the agent making the call. */
  agentSlug: string;
  /** Stable id for this specific run. */
  runId: string;
  /** Optional idempotency key (defaults to result.response?.id). */
  tokenId?: string;
  /**
   * Optional Guardian rules to evaluate against the output. Pass
   * packs from `@sovereign-matrix/verifiable-receipts/packs` to get
   * jurisdiction-cited verdicts.
   */
  rules?: GuardianRule[];
  /**
   * Optional provider/model hint surfaced in the receipt's input
   * projection. AI SDK exposes `result.response?.modelId` for some
   * providers; pass `providerHint` to override or supplement.
   */
  providerHint?: string;
}

/**
 * Mint a VAOS Guardian attestation around a Vercel AI SDK
 * `generateText()` result.
 *
 * Returns a signed `GuardianAttestation` that any third party can
 * verify with the issuer's public key.
 *
 * Throws when:
 *   - The result is null/undefined or not an object
 *   - The result has no `text` field
 *   - The sign callback throws
 */
export async function mintTextReceipt(
  result: AiSdkTextResult,
  opts: MintAiSdkReceiptOptions,
): Promise<GuardianAttestation> {
  if (!result || typeof result !== "object") {
    throw new Error("mintTextReceipt: result must be an object");
  }
  if (typeof result.text !== "string") {
    throw new Error("mintTextReceipt: result has no text field");
  }

  // AI SDK v5 renamed `promptTokens` → `inputTokens` (and similarly
  // `completionTokens` → `outputTokens`). Accept both shapes so this
  // wrapper works across SDK major versions.
  const promptTokens =
    result.usage?.promptTokens ?? result.usage?.inputTokens ?? null;
  const completionTokens =
    result.usage?.completionTokens ?? result.usage?.outputTokens ?? null;

  const input = {
    provider: "ai-sdk",
    providerHint: opts.providerHint ?? null,
    model: result.response?.modelId ?? null,
    finishReason: result.finishReason ?? null,
    promptTokens,
    completionTokens,
    warningCount: Array.isArray(result.warnings) ? result.warnings.length : 0,
  };

  return runGuardian(
    opts.rules ?? [],
    {
      runId: opts.runId,
      agentSlug: opts.agentSlug,
      tokenId: opts.tokenId ?? result.response?.id ?? `ai-sdk:${opts.runId}`,
      input,
      output: result.text,
    },
    opts.sign,
  );
}

/**
 * Mint a VAOS Guardian attestation around a Vercel AI SDK
 * `generateObject()` result. The object is stringified to JSON for
 * the canonical output projection — bytes that survive verification.
 */
export async function mintObjectReceipt<T = unknown>(
  result: AiSdkObjectResult<T>,
  opts: MintAiSdkReceiptOptions,
): Promise<GuardianAttestation> {
  if (!result || typeof result !== "object") {
    throw new Error("mintObjectReceipt: result must be an object");
  }
  if (result.object === undefined || result.object === null) {
    throw new Error("mintObjectReceipt: result has no object field");
  }

  // Stringify deterministically — sort keys lexicographically so two
  // semantically-identical objects produce byte-identical canonical
  // projections. Pre-walks the value into a sorted-key clone, then
  // stringifies that — simpler than a replacer that has to avoid
  // double-sorting the root.
  const output = JSON.stringify(sortObjectKeys(result.object));

  const promptTokens =
    result.usage?.promptTokens ?? result.usage?.inputTokens ?? null;
  const completionTokens =
    result.usage?.completionTokens ?? result.usage?.outputTokens ?? null;

  const input = {
    provider: "ai-sdk",
    providerHint: opts.providerHint ?? null,
    model: result.response?.modelId ?? null,
    finishReason: result.finishReason ?? null,
    promptTokens,
    completionTokens,
    outputKind: "object",
  };

  return runGuardian(
    opts.rules ?? [],
    {
      runId: opts.runId,
      agentSlug: opts.agentSlug,
      tokenId: opts.tokenId ?? result.response?.id ?? `ai-sdk:${opts.runId}`,
      input,
      output,
    },
    opts.sign,
  );
}

/**
 * Convenience helper: awaits an in-flight AI SDK call + returns both
 * the original result and the minted receipt.
 *
 * Example:
 *
 *   const { result, receipt } = await withTextReceipt(
 *     generateText({ model: openai("gpt-4o"), prompt: "..." }),
 *     { sign, agentSlug: "x", runId: "y" }
 *   );
 */
export async function withTextReceipt<T extends AiSdkTextResult>(
  resultPromise: Promise<T>,
  opts: MintAiSdkReceiptOptions,
): Promise<{ result: T; receipt: GuardianAttestation }> {
  const result = await resultPromise;
  const receipt = await mintTextReceipt(result, opts);
  return { result, receipt };
}

export async function withObjectReceipt<T>(
  resultPromise: Promise<AiSdkObjectResult<T>>,
  opts: MintAiSdkReceiptOptions,
): Promise<{ result: AiSdkObjectResult<T>; receipt: GuardianAttestation }> {
  const result = await resultPromise;
  const receipt = await mintObjectReceipt(result, opts);
  return { result, receipt };
}

/**
 * Recursively returns a clone of the input with every plain-object's
 * keys lexicographically sorted. Arrays preserve order (semantic);
 * primitives + null + Date pass through. The result fed through
 * JSON.stringify produces a deterministic byte stream regardless of
 * input property-insertion order — critical for cross-implementation
 * verifier consistency.
 */
function sortObjectKeys(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (value instanceof Date) return value;
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(value as Record<string, unknown>).sort()) {
    sorted[k] = sortObjectKeys((value as Record<string, unknown>)[k]);
  }
  return sorted;
}

export type { GuardianAttestation, GuardianRule };
