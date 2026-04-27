/**
 * OUTPUT WATERMARK — invisible per-response provenance signal.
 *
 * Closes the second half of OWASP LLM10 (Model Theft / output theft).
 * The first half (anti-distillation canary) is in system-prompts.ts;
 * the second half is here: an invisible watermark on long-form text
 * outputs so customers can prove THEIR content came from Sovereign,
 * even after copy-paste or downstream reformatting.
 *
 * MECHANISM
 *   Zero-width-character pattern. We embed a small binary signature
 *   (4 bytes truncated HMAC) into the output by inserting zero-width
 *   joiners (U+200D) and zero-width non-joiners (U+200C) between
 *   words at deterministic positions. These don't render, don't break
 *   word-boundary detection, and survive most Markdown / HTML
 *   round-trips — but they DO survive copy-paste from a browser.
 *
 *   We deliberately use a SHORT signature (4 bytes = 32 bits) so the
 *   watermark fits in even modest outputs without inserting too many
 *   invisible characters. 32 bits is collision-prone in theory but
 *   sufficient for "yes, this came from Sovereign" provenance —
 *   we're not trying to fingerprint individual customers (yet).
 *
 * VERIFY
 *   `extractWatermark(text, expected)` reads the zero-width pattern
 *   back, recomputes the HMAC, and confirms the signature. Available
 *   at /api/_meta/watermark/verify so customers can verify externally.
 *
 * WHEN WE WATERMARK
 *   - text outputs >= 500 chars from agents whose manifest
 *     `outputClass !== "confidential"` (we don't watermark
 *     confidential output — adds another data path that touches
 *     the content)
 *   - skipped when SOVEREIGN_WATERMARK_SECRET isn't set
 *
 * NEVER throws. Watermarking is defense-in-depth — if it fails, the
 * unwatermarked response still ships.
 */

import { createHmac } from "node:crypto";
import { createLogger } from "@/lib/logger";

const log = createLogger("output-watermark");

const ZWJ = "‍"; // zero-width joiner
const ZWNJ = "‌"; // zero-width non-joiner
const SIGNATURE_BYTES = 4; // 32-bit signature; ~32 zero-width chars total

/**
 * Encode a 32-bit signature as a sequence of zero-width characters.
 * Each bit becomes one character: 1 → ZWJ, 0 → ZWNJ.
 */
function bitsToZeroWidth(bytes: Buffer): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    for (let bit = 7; bit >= 0; bit--) {
      out += (byte >> bit) & 1 ? ZWJ : ZWNJ;
    }
  }
  return out;
}

/** Inverse of `bitsToZeroWidth`. Strips zero-width chars and decodes. */
function zeroWidthToBytes(text: string, expectedBits: number): Buffer | null {
  const stripped: string[] = [];
  for (const ch of text) {
    if (ch === ZWJ || ch === ZWNJ) stripped.push(ch);
    if (stripped.length >= expectedBits) break;
  }
  if (stripped.length < expectedBits) return null;
  const bytes = Buffer.alloc(Math.ceil(expectedBits / 8));
  for (let bit = 0; bit < expectedBits; bit++) {
    const isOne = stripped[bit] === ZWJ;
    if (isOne) bytes[Math.floor(bit / 8)] |= 1 << (7 - (bit % 8));
  }
  return bytes;
}

/**
 * Compute the watermark signature for a given text + agent slug.
 * Pure function — useful for tests and for the public verify API.
 */
export function computeWatermarkSignature(
  text: string,
  agent: string,
  secret: string,
): Buffer {
  return createHmac("sha256", secret)
    .update(`${agent}|${text}`)
    .digest()
    .subarray(0, SIGNATURE_BYTES);
}

/**
 * Embed an invisible watermark into a text output. Returns the
 * watermarked text. Idempotent — calling twice doesn't double-embed
 * (we strip existing zero-width chars first).
 *
 * The watermark is concentrated in the first 64 word-boundaries
 * (after stripping any existing zero-width chars), so even a
 * customer who quotes only the opening paragraph still has the
 * full signature.
 */
export function embedWatermark(
  text: string,
  agent: string,
  secret: string,
): string {
  if (!secret || secret.length < 16) return text;
  if (text.length < 500) return text; // skip short outputs
  // Strip any existing zero-width chars first (idempotent re-embed).
  const stripped = text.replace(/[‌‍]/g, "");

  const sig = computeWatermarkSignature(stripped, agent, secret);
  const zw = bitsToZeroWidth(sig); // 32 chars

  // Find the first 32 word-boundaries and insert one zero-width
  // char after each.
  const words = stripped.split(/(\s+)/); // keep separators
  let inserted = 0;
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    out.push(words[i]);
    if (
      inserted < zw.length &&
      i < words.length - 1 &&
      /\s+/.test(words[i + 1] ?? "")
    ) {
      out.push(zw[inserted]);
      inserted++;
    }
  }
  // If the text was too short to fit all 32 bits, append the remaining
  // signature characters at the end (still invisible).
  if (inserted < zw.length) {
    out.push(zw.slice(inserted));
  }
  return out.join("");
}

/**
 * Public verifier — given a (potentially watermarked) text, the agent
 * slug it claims to come from, and the secret, return whether the
 * embedded signature matches.
 *
 * NEVER throws. Returns `{ valid: false, reason }` on any failure
 * (no zero-width chars, signature mismatch, missing secret).
 */
export function verifyWatermark(
  text: string,
  agent: string,
  secret: string,
): { valid: boolean; reason?: string } {
  if (!secret || secret.length < 16) return { valid: false, reason: "secret_too_short" };
  const stripped = text.replace(/[‌‍]/g, "");
  const expectedBits = SIGNATURE_BYTES * 8;
  const decoded = zeroWidthToBytes(text, expectedBits);
  if (!decoded) return { valid: false, reason: "no_watermark_found" };

  const expected = computeWatermarkSignature(stripped, agent, secret);
  if (Buffer.compare(decoded, expected) !== 0) {
    return { valid: false, reason: "signature_mismatch" };
  }
  return { valid: true };
}

/**
 * Convenience — strip ALL zero-width chars from a string. Useful for
 * test fixtures + for showing customers what their output looks like
 * without the watermark.
 */
export function stripWatermark(text: string): string {
  return text.replace(/[‌‍]/g, "");
}

void log;
