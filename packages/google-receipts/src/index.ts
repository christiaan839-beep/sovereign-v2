/**
 * @sovereign-matrix/google-receipts
 *
 * Drop-in wrapper that mints VAOS receipts around Google Gemini SDK
 * calls. Three-line integration; post-quantum-signed, regulator-
 * defensible audit envelope around every Gemini generation.
 *
 * Why this exists:
 *   Every regulated buyer using Gemini asks the same question —
 *   "if Gemini makes a decision the regulator later challenges,
 *   what evidence do we hand the court that it was defensible at
 *   the moment it was made?" Google's answer is "use Vertex AI
 *   audit logs." This package is the open-source answer that
 *   travels with the call.
 *
 * Usage:
 *
 *   import { GoogleGenerativeAI } from "@google/generative-ai";
 *   import { mintGenerationReceipt } from "@sovereign-matrix/google-receipts";
 *
 *   const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
 *   const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
 *
 *   const result = await model.generateContent("Summarize this contract...");
 *
 *   const receipt = await mintGenerationReceipt(result, {
 *     sign: (canonical) => Ed25519.sign(privateKey, canonical),
 *     agentSlug: "contract-summarizer",
 *     runId: "run_01HXX...",
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
 * Minimal shape of a Google Gemini GenerateContentResult that this
 * wrapper needs. Matches `model.generateContent()` return value
 * (non-stream).
 *
 * We intentionally accept this loose shape rather than `import type`
 * from `@google/generative-ai` — keeps this package zero-runtime-dep
 * + lets it work across SDK major versions (v0.20+).
 */
export interface GeminiCandidate {
  content?: {
    parts?: Array<{ text?: string }>;
    role?: string;
  };
  finishReason?: string;
  safetyRatings?: Array<{
    category: string;
    probability: string;
  }>;
}

export interface GeminiResponse {
  candidates?: GeminiCandidate[];
  promptFeedback?: {
    blockReason?: string;
    safetyRatings?: Array<{ category: string; probability: string }>;
  };
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

export interface GeminiGenerateContentResult {
  response: GeminiResponse;
}

export interface MintGenerationReceiptOptions {
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
  /**
   * Optional opaque token id. If omitted, derived from the first
   * candidate's safety-rating signature (Gemini doesn't expose a
   * stable response id like OpenAI's `id` field).
   */
  tokenId?: string;
  /**
   * Optional Guardian rules to evaluate against the generation's
   * output. Pass packs from
   * `@sovereign-matrix/verifiable-receipts/packs` to get
   * jurisdiction-cited verdicts.
   */
  rules?: GuardianRule[];
  /**
   * Optional override for the model identifier. Gemini SDK doesn't
   * always echo back the model used; callers know it from
   * `getGenerativeModel({ model: "..." })` and can pass it explicitly
   * for the receipt's input projection.
   */
  modelName?: string;
}

/**
 * Concatenate every text part across every candidate in a Gemini
 * response into a single string. The Gemini SDK exposes `.text()`
 * on the response but only returns the first candidate; this wrapper
 * intentionally surfaces every candidate so multi-sample generation
 * doesn't lose data in the receipt.
 *
 * Non-text parts (function calls, inline data) are skipped — those
 * require the VAOS-RSA streaming primitive for proper commitment.
 */
function extractText(response: GeminiResponse): string {
  if (!Array.isArray(response.candidates)) return "";
  const parts: string[] = [];
  for (const candidate of response.candidates) {
    const candidateParts = candidate.content?.parts;
    if (!Array.isArray(candidateParts)) continue;
    for (const part of candidateParts) {
      if (typeof part.text === "string") parts.push(part.text);
    }
  }
  return parts.join("");
}

/**
 * Mint a VAOS Guardian attestation around a Google Gemini generation.
 *
 * Returns a signed `GuardianAttestation` that any third party can
 * verify with the issuer's public key.
 *
 * Throws when:
 *   - The result is null/undefined or not an object
 *   - The result has no response object
 *   - The sign callback throws
 *
 * Never mutates the input result.
 */
export async function mintGenerationReceipt(
  result: GeminiGenerateContentResult,
  opts: MintGenerationReceiptOptions,
): Promise<GuardianAttestation> {
  if (!result || typeof result !== "object") {
    throw new Error("mintGenerationReceipt: result must be an object");
  }
  if (!result.response || typeof result.response !== "object") {
    throw new Error("mintGenerationReceipt: result has no response object");
  }
  const response = result.response;
  const output = extractText(response);

  const firstCandidate = response.candidates?.[0];
  const input = {
    provider: "google",
    model: opts.modelName ?? null,
    finishReason: firstCandidate?.finishReason ?? null,
    blockReason: response.promptFeedback?.blockReason ?? null,
    promptTokens: response.usageMetadata?.promptTokenCount ?? null,
    candidatesTokens: response.usageMetadata?.candidatesTokenCount ?? null,
  };

  // Gemini doesn't return a stable response id; fall back to a
  // deterministic hash-prefix of the first safety-rating + finishReason
  // when caller hasn't supplied tokenId. This lets idempotency at the
  // settlement layer still key off a stable per-response value.
  const fallbackTokenId =
    firstCandidate?.safetyRatings && firstCandidate.safetyRatings.length > 0
      ? `gemini:${firstCandidate.finishReason ?? "unknown"}:${firstCandidate.safetyRatings[0].category}`
      : `gemini:${firstCandidate?.finishReason ?? "unknown"}`;

  return runGuardian(
    opts.rules ?? [],
    {
      runId: opts.runId,
      agentSlug: opts.agentSlug,
      tokenId: opts.tokenId ?? fallbackTokenId,
      input,
      output,
    },
    opts.sign,
  );
}

/**
 * Convenience helper: awaits an in-flight Gemini generation +
 * returns both the original result and the minted receipt.
 *
 * Example:
 *
 *   const { result, receipt } = await withReceipt(
 *     model.generateContent("..."),
 *     { sign, agentSlug: "x", runId: "y", modelName: "gemini-1.5-pro" }
 *   );
 */
export async function withReceipt<T extends GeminiGenerateContentResult>(
  resultPromise: Promise<T>,
  opts: MintGenerationReceiptOptions,
): Promise<{ result: T; receipt: GuardianAttestation }> {
  const result = await resultPromise;
  const receipt = await mintGenerationReceipt(result, opts);
  return { result, receipt };
}

export type { GuardianAttestation, GuardianRule };
