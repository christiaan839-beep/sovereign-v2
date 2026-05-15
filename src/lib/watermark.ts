/**
 * SOVEREIGN MATRIX — Output watermarking (Cook 95).
 *
 * Invisible token-pattern fingerprint embedded into AI text output
 * so Sovereign can detect its own outputs in the wild without the
 * adversary being able to remove the mark by retyping or paraphrasing
 * a single word.
 *
 * Construction:
 *
 *   1. Build a 64-bit fingerprint = HMAC-SHA256(secret,
 *      tenantId|agentSlug|receiptId)[:8].
 *   2. Pick N positions in the text (deterministic from
 *      HMAC(fingerprint, "positions")) and insert a zero-width-joiner
 *      (U+200D) at each boundary.
 *   3. To detect: re-derive the candidate fingerprints + verify the
 *      ZWJ pattern matches.
 *
 * Robustness:
 *   - Plain copy-paste keeps the ZWJ characters → detectable.
 *   - Bulk paraphrase via another LLM may strip ZWJ → undetectable;
 *     this is the known limit of every text watermark today.
 *   - Adversarial regex `replaceAll(/‍/g, "")` removes the mark
 *     → undetectable; this is intentional — we're not encrypting,
 *     we're attributing.
 *
 * Use cases:
 *   - Catch Sovereign output republished by partners without
 *     attribution (Cook 11 attestation requires it).
 *   - Detect Sovereign-laundered outputs in customer logs.
 *   - Forensic attribution after a content dispute.
 */

import { createHmac } from "crypto";

const ZWJ = "‍"; // zero-width joiner
const FINGERPRINT_BYTES = 8; // 64-bit
const MIN_POSITIONS = 4;
const MAX_POSITIONS = 32;

// ── Public types ──────────────────────────────────────────────────────────

export interface WatermarkArgs {
  text: string;
  tenantId: string;
  agentSlug: string;
  receiptId: string;
  /** Signing secret (typically AGENT_RUN_SIGNING_SECRET). */
  secret: string;
  /** How many positions to mark. Default 12. */
  positions?: number;
}

export interface WatermarkResult {
  /** Marked text (visually identical to the input). */
  marked: string;
  /** Hex fingerprint that was embedded. */
  fingerprint: string;
  /** Number of marker characters inserted. */
  positionsMarked: number;
}

// ── Embedding ─────────────────────────────────────────────────────────────

function computeFingerprint(args: WatermarkArgs): Buffer {
  return createHmac("sha256", args.secret)
    .update(`${args.tenantId}|${args.agentSlug}|${args.receiptId}`)
    .digest()
    .subarray(0, FINGERPRINT_BYTES);
}

function pickPositions(
  fingerprint: Buffer,
  textLength: number,
  count: number,
): number[] {
  const positions = new Set<number>();
  // Use the fingerprint as the seed for a stretch-pseudorandom sequence.
  const stream = createHmac("sha256", fingerprint).update("positions").digest();
  let i = 0;
  while (
    positions.size < count &&
    i < stream.length * 4 &&
    positions.size < textLength
  ) {
    const byte = stream[i % stream.length];
    const offset = (byte * (i + 1)) % Math.max(1, textLength - 1);
    if (offset > 0) positions.add(offset);
    i++;
  }
  return [...positions].sort((a, b) => a - b);
}

/**
 * Embed the watermark and return the marked text + the embedded
 * fingerprint. NEVER throws — when the text is too short to carry
 * `positions` marks, the result simply embeds fewer positions.
 */
export function embed(args: WatermarkArgs): WatermarkResult {
  if (!args.secret) {
    throw new Error("embed: secret is required");
  }
  const desired = Math.min(
    Math.max(args.positions ?? 12, MIN_POSITIONS),
    MAX_POSITIONS,
  );
  const fingerprint = computeFingerprint(args);
  const positions = pickPositions(fingerprint, args.text.length, desired);
  let marked = args.text;
  // Insert from back to front so earlier indices stay valid.
  for (const pos of [...positions].reverse()) {
    if (pos < 0 || pos > marked.length) continue;
    marked = marked.slice(0, pos) + ZWJ + marked.slice(pos);
  }
  return {
    marked,
    fingerprint: fingerprint.toString("hex"),
    positionsMarked: positions.length,
  };
}

// ── Detection ─────────────────────────────────────────────────────────────

/** Count the ZWJ markers in the text — quick first-pass test. */
export function countMarkers(text: string): number {
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 0x200d) n++;
  }
  return n;
}

/**
 * Verify a candidate watermark against the text. Returns true iff
 * the ZWJ positions match what we would have inserted under the same
 * tenant + agent + receipt + secret.
 */
export function verify(
  markedText: string,
  args: Omit<WatermarkArgs, "text">,
): boolean {
  // Strip ZWJ to recover the original text.
  const original = markedText.replace(/‍/g, "");
  const expected = embed({ ...args, text: original }).marked;
  return expected === markedText;
}
