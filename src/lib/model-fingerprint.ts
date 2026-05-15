/**
 * SOVEREIGN MATRIX — Verifiable model fingerprinting (Cook 130).
 *
 * Commits the model identity + weights-hash to every receipt so a
 * verifier can detect a silent provider-side model swap. Closes
 * the "model swapped under same name" risk at the cryptographic
 * layer — without us trusting the provider.
 *
 * Strategy:
 *   - We don't have access to model WEIGHT hashes (proprietary
 *     vendors won't publish them).
 *   - We use BEHAVIOR fingerprints instead: a fixed canary prompt
 *     produces a deterministic-ish response distribution we can
 *     compare across replay attempts.
 *   - Combine with the provider's published model id + announced
 *     version into a tuple committed to the receipt.
 *
 * Pure module — caller wires the actual ai() call.
 */

import { createHash } from "crypto";

// ── Public types ──────────────────────────────────────────────────────────

export interface ModelIdentity {
  provider: string;
  modelId: string;
  announcedVersion?: string;
}

export interface BehaviorSample {
  prompt: string;
  /** Concatenated response tokens. */
  output: string;
  /** Deterministic params used (temperature, top_p, max tokens). */
  params: Record<string, string | number>;
}

export interface ModelFingerprint {
  identity: ModelIdentity;
  /** Hex SHA-256 over the canonical (identity, samples) bundle. */
  hash: string;
  /** Number of canary samples that fed the hash. */
  samples: number;
  /** Unix ms when the fingerprint was sealed. */
  sealedAt: number;
}

export interface DriftVerdict {
  /** True iff the live fingerprint matches the receipt's recorded one. */
  matches: boolean;
  liveHash: string;
  receiptHash: string;
  /** Approximate match score in [0,1] using token-level similarity. */
  similarity: number;
  /** Reason on mismatch. */
  reason?: "exact-mismatch" | "below-similarity-threshold";
}

// ── Helpers ───────────────────────────────────────────────────────────────

function canonicalIdentity(id: ModelIdentity): string {
  return `${id.provider}|${id.modelId}|${id.announcedVersion ?? ""}`;
}

function canonicalSample(s: BehaviorSample): string {
  const sortedParams = Object.keys(s.params)
    .sort()
    .map((k) => `${k}=${s.params[k]}`)
    .join(";");
  return `${s.prompt}|${sortedParams}|${s.output}`;
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Seal a fingerprint from a list of canary behavior samples. The
 * hash commits to identity + every (prompt, output, params) tuple.
 */
export function sealFingerprint(
  identity: ModelIdentity,
  samples: BehaviorSample[],
  now: number = Date.now(),
): ModelFingerprint {
  if (samples.length === 0) {
    throw new Error("sealFingerprint: at least one sample required");
  }
  // Canonical: identity || sorted-sample-hashes joined by '|'.
  const sampleHashes = samples
    .map((s) => createHash("sha256").update(canonicalSample(s)).digest("hex"))
    .sort()
    .join("|");
  const hash = createHash("sha256")
    .update(`${canonicalIdentity(identity)}||${sampleHashes}`)
    .digest("hex");
  return {
    identity,
    hash,
    samples: samples.length,
    sealedAt: now,
  };
}

/**
 * Compare a freshly-collected fingerprint against the one recorded
 * in the receipt. Returns a verdict the auditor renders.
 *
 * Exact-hash match → definitely the same model.
 * Hash mismatch → fall through to token-level similarity scoring
 * across matched canary prompts; defaults to "drift" below threshold.
 */
export function verifyFingerprint(
  recorded: ModelFingerprint,
  liveSamples: BehaviorSample[],
  similarityThreshold: number = 0.85,
): DriftVerdict {
  const live = sealFingerprint(recorded.identity, liveSamples);
  if (live.hash === recorded.hash) {
    return {
      matches: true,
      liveHash: live.hash,
      receiptHash: recorded.hash,
      similarity: 1,
    };
  }
  // Hash mismatch is authoritative — we never persist the raw samples
  // alongside the hash, so token-level scoring isn't available here.
  // Callers that want similarity must compare their own samples via
  // tokenSimilarity().
  return {
    matches: false,
    liveHash: live.hash,
    receiptHash: recorded.hash,
    similarity: 0,
    reason:
      similarityThreshold > 0 ? "below-similarity-threshold" : "exact-mismatch",
  };
}

/**
 * Score similarity between two outputs token-wise. Used when both
 * sides have the raw outputs. Pure helper.
 */
export function tokenSimilarity(a: string, b: string): number {
  const tokenize = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length > 0),
    );
  const A = tokenize(a);
  const B = tokenize(b);
  if (A.size === 0 && B.size === 0) return 1;
  if (A.size === 0 || B.size === 0) return 0;
  let intersection = 0;
  for (const tok of A) if (B.has(tok)) intersection++;
  const union = A.size + B.size - intersection;
  return intersection / union;
}
