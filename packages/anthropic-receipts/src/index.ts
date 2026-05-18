/**
 * @sovereign-matrix/anthropic-receipts
 *
 * Drop-in wrapper that mints VAOS receipts around Anthropic SDK calls.
 * Three lines of integration; post-quantum-signed, regulator-defensible
 * audit envelope around every Claude message.
 *
 * Why this exists:
 *   Every regulated buyer using Claude asks the same question — "if
 *   Claude makes a decision the regulator later challenges, what
 *   evidence do we hand the court that it was defensible at the
 *   moment it was made?" Anthropic's answer is some variant of "we
 *   logged it somewhere." This package is the OSS answer that travels
 *   with the call.
 *
 * Usage:
 *
 *   import Anthropic from "@anthropic-ai/sdk";
 *   import { mintMessageReceipt } from "@sovereign-matrix/anthropic-receipts";
 *
 *   const client = new Anthropic();
 *   const message = await client.messages.create({
 *     model: "claude-sonnet-4-6",
 *     max_tokens: 1024,
 *     messages: [{ role: "user", content: "Summarize this contract..." }],
 *   });
 *
 *   const receipt = await mintMessageReceipt(message, {
 *     sign: (canonical) => Ed25519.sign(privateKey, canonical),
 *     agentSlug: "contract-summarizer",
 *     runId: "run_01HXX...",
 *     rules: [hipaaPack.rules, ...].flat(),
 *   });
 *
 *   // receipt.signature → "v2=<base64>"
 *   // receipt.overall   → "pass" | "warn" | "block"
 *
 * Compose with `@sovereign-matrix/verifiable-receipts` for verification.
 *
 * @packageDocumentation
 */

import {
  runGuardian,
  type GuardianAttestation,
  type GuardianRule,
} from "@sovereign-matrix/verifiable-receipts";

/**
 * Minimal shape of an Anthropic Message that this wrapper needs.
 * Matches `client.messages.create()` return value (non-stream).
 *
 * We intentionally accept this loose shape rather than `import type`
 * from `@anthropic-ai/sdk` — keeps this package zero-runtime-dep +
 * lets it work across Anthropic SDK major versions (v0.30+).
 */
export interface AnthropicMessage {
  id: string;
  type?: "message";
  role?: "assistant";
  model: string;
  content: Array<{
    type: string;
    text?: string;
  }>;
  stop_reason?: string | null;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

export interface MintMessageReceiptOptions {
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
  /** Optional idempotency key (defaults to message.id). */
  tokenId?: string;
  /**
   * Optional Guardian rules to evaluate against the message's output.
   * Pass packs from `@sovereign-matrix/verifiable-receipts/packs` to
   * get jurisdiction-cited verdicts in the receipt.
   */
  rules?: GuardianRule[];
}

/**
 * Concatenate every text-typed content block in an Anthropic message
 * into a single string. Tool-use and other non-text blocks are
 * skipped (the receipt commits to the model's natural-language
 * output only; tool-call commitments require the VAOS-RSA streaming
 * primitive).
 */
function extractText(message: AnthropicMessage): string {
  if (!Array.isArray(message.content)) return "";
  const parts: string[] = [];
  for (const block of message.content) {
    if (block?.type === "text" && typeof block.text === "string") {
      parts.push(block.text);
    }
  }
  return parts.join("");
}

/**
 * Mint a VAOS Guardian attestation around an Anthropic message.
 *
 * Returns a signed `GuardianAttestation` that any third party can
 * verify with the issuer's public key.
 *
 * Throws when:
 *   - The message is null/undefined or not an object
 *   - The message has no content array
 *   - The sign callback throws
 *
 * Never mutates the input message.
 */
export async function mintMessageReceipt(
  message: AnthropicMessage,
  opts: MintMessageReceiptOptions,
): Promise<GuardianAttestation> {
  if (!message || typeof message !== "object") {
    throw new Error("mintMessageReceipt: message must be an object");
  }
  if (!Array.isArray(message.content)) {
    throw new Error(
      "mintMessageReceipt: message has no content array to attest over",
    );
  }
  const output = extractText(message);

  const input = {
    provider: "anthropic",
    model: message.model,
    stopReason: message.stop_reason ?? null,
    inputTokens: message.usage?.input_tokens ?? null,
    outputTokens: message.usage?.output_tokens ?? null,
    cacheReadTokens: message.usage?.cache_read_input_tokens ?? null,
    cacheCreationTokens: message.usage?.cache_creation_input_tokens ?? null,
  };

  return runGuardian(
    opts.rules ?? [],
    {
      runId: opts.runId,
      agentSlug: opts.agentSlug,
      tokenId: opts.tokenId ?? message.id,
      input,
      output,
    },
    opts.sign,
  );
}

/**
 * Convenience helper: takes an in-flight promise to an Anthropic
 * message and returns both the original message + the minted receipt.
 *
 * Example:
 *
 *   const { message, receipt } = await withReceipt(
 *     client.messages.create({ ... }),
 *     { sign, agentSlug: "x", runId: "y" }
 *   );
 */
export async function withReceipt<T extends AnthropicMessage>(
  messagePromise: Promise<T>,
  opts: MintMessageReceiptOptions,
): Promise<{ message: T; receipt: GuardianAttestation }> {
  const message = await messagePromise;
  const receipt = await mintMessageReceipt(message, opts);
  return { message, receipt };
}

export type { GuardianAttestation, GuardianRule };
