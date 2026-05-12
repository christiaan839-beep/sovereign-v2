/**
 * Drift Detector — compares two agent outputs for semantic + structural
 * divergence.
 *
 * Use cases:
 *   1. Receipt replay (Cook 35): compare original vs. replay output.
 *      A divergence > tolerance flags a model regression.
 *   2. Canary set runs (Cook 36 planned): compare an agent's current
 *      output against a baseline ground-truth.
 *   3. Shadow-mode A/B: compare prod model vs. challenger model.
 *
 * Why not just hash-compare:
 *   - LLM outputs are non-deterministic. Two valid runs of the same
 *     agent on the same input will rarely byte-match. We need
 *     graduated similarity, not equality.
 *   - But hash-equality IS still meaningful (it implies determinism +
 *     temperature 0 + identical model + identical prompt), so we
 *     report it as a separate signal, not the only one.
 *
 * Pure module: no I/O, no AI calls. Embedding-based semantic similarity
 * is delegated to the caller — pass an embed function in or use the
 * `withEmbedding` wrapper. Pure makes the module trivially testable
 * and lets the receipt-replay handler reuse the same logic without
 * spinning up the embedding model on every comparison.
 */

import { createHash } from "crypto";

/**
 * Per-dimension score, all in [0, 1] where 1 = identical, 0 = wholly
 * different. The `overall` field is a weighted aggregate the caller
 * can use as a single number for thresholding.
 */
export interface DriftScore {
  /** Byte-equal? Boolean reported as 1 or 0. */
  hash: number;
  /** JSON-shape similarity: how many keys/types match. */
  structural: number;
  /**
   * Embedding cosine similarity, 0..1. Null when the caller didn't
   * provide an embedFn — only hash + structural are reliable then.
   */
  semantic: number | null;
  /**
   * Weighted aggregate: 0.5 * semantic + 0.4 * structural + 0.1 * hash.
   * When semantic is null, weights collapse to: 0.8 * structural +
   * 0.2 * hash so the overall stays comparable.
   */
  overall: number;
}

export interface DriftReport {
  score: DriftScore;
  /** Whether the drift exceeded the caller-supplied tolerance. */
  drifted: boolean;
  /** Human-readable summary of the largest discrepancy. */
  summary: string;
  /** Up to N concrete differences for human review. */
  diffs: DriftDiff[];
}

export interface DriftDiff {
  /** JSON path of the differing field (e.g. "answer.tonnesCO2e"). */
  path: string;
  kind: "missing" | "added" | "type-mismatch" | "value-changed";
  before: unknown;
  after: unknown;
}

/** Stable SHA-256 hex of a JSON-serialized value. Pure. */
export function hashOf(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value) ?? "")
    .digest("hex");
}

/**
 * Walk two JSON values in parallel; return up to `limit` differences
 * (so a wildly divergent pair doesn't produce 10k entries).
 *
 * Pure function — exported for unit testing.
 */
export function diffJson(
  before: unknown,
  after: unknown,
  limit = 50,
  path = "$",
): DriftDiff[] {
  const out: DriftDiff[] = [];
  walk(before, after, path, out, limit);
  return out.slice(0, limit);
}

function walk(
  before: unknown,
  after: unknown,
  path: string,
  out: DriftDiff[],
  limit: number,
): void {
  if (out.length >= limit) return;
  // Type mismatch (one is object/array, the other isn't)
  const tb = describeType(before);
  const ta = describeType(after);
  if (tb !== ta) {
    out.push({ path, kind: "type-mismatch", before, after });
    return;
  }
  // Primitives: compare directly
  if (tb !== "object" && tb !== "array") {
    if (before !== after) {
      out.push({ path, kind: "value-changed", before, after });
    }
    return;
  }
  // Arrays: by-index walk
  if (tb === "array") {
    const a = before as unknown[];
    const b = after as unknown[];
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) {
      if (out.length >= limit) return;
      if (i >= a.length) {
        out.push({
          path: `${path}[${i}]`,
          kind: "added",
          before: undefined,
          after: b[i],
        });
      } else if (i >= b.length) {
        out.push({
          path: `${path}[${i}]`,
          kind: "missing",
          before: a[i],
          after: undefined,
        });
      } else {
        walk(a[i], b[i], `${path}[${i}]`, out, limit);
      }
    }
    return;
  }
  // Objects: by-key walk over the union of keys
  const ao = before as Record<string, unknown>;
  const bo = after as Record<string, unknown>;
  const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
  for (const k of keys) {
    if (out.length >= limit) return;
    const ak = k in ao;
    const bk = k in bo;
    if (!ak) {
      out.push({
        path: `${path}.${k}`,
        kind: "added",
        before: undefined,
        after: bo[k],
      });
    } else if (!bk) {
      out.push({
        path: `${path}.${k}`,
        kind: "missing",
        before: ao[k],
        after: undefined,
      });
    } else {
      walk(ao[k], bo[k], `${path}.${k}`, out, limit);
    }
  }
}

function describeType(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

/**
 * Structural similarity in [0, 1]. Higher = more similar.
 *
 * Defined as 1 - (count of structural differences / max(node count
 * either side, 1)). Counts only `missing`, `added`, and
 * `type-mismatch` differences — value-changed alone is captured by
 * semantic similarity, not structural.
 *
 * Pure function — exported for unit testing.
 */
export function structuralSimilarity(before: unknown, after: unknown): number {
  const diffs = diffJson(before, after, 1000);
  const structuralOnly = diffs.filter((d) => d.kind !== "value-changed").length;
  const nodeCount = Math.max(countNodes(before), countNodes(after), 1);
  const ratio = Math.min(1, structuralOnly / nodeCount);
  return 1 - ratio;
}

function countNodes(v: unknown): number {
  if (v === null || typeof v !== "object") return 1;
  if (Array.isArray(v)) {
    return 1 + v.reduce<number>((acc, x) => acc + countNodes(x), 0);
  }
  return (
    1 +
    Object.values(v as Record<string, unknown>).reduce<number>(
      (acc, x) => acc + countNodes(x),
      0,
    )
  );
}

/**
 * Cosine similarity between two vectors. Pure. Returns 0 when either
 * vector has zero magnitude (avoids division by zero).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const mag = Math.sqrt(normA) * Math.sqrt(normB);
  if (mag === 0) return 0;
  // Cosine is in [-1, 1]; clamp to [0, 1] for similarity-as-score
  return Math.max(0, Math.min(1, dot / mag));
}

interface DetectOptions {
  /** Drift tolerance (0..1). overall < (1 - tolerance) → drifted. Default 0.15 (15% drift allowed). */
  tolerance?: number;
  /**
   * Optional pre-computed embeddings. When supplied, semantic
   * similarity is included in the score. When omitted, semantic is
   * null and weights collapse to structural + hash.
   */
  embeddings?: { before: number[]; after: number[] } | null;
  /** Cap on the diffs[] array. Default 25. */
  diffLimit?: number;
}

/**
 * Compare two agent outputs and report whether they have drifted
 * beyond `tolerance`.
 *
 * Pure: all I/O (e.g. embedding generation) is the caller's
 * responsibility. Pass embeddings via opts when you want semantic
 * scoring; omit when structural+hash is enough.
 */
export function detectDrift(
  before: unknown,
  after: unknown,
  opts: DetectOptions = {},
): DriftReport {
  const { tolerance = 0.15, embeddings = null, diffLimit = 25 } = opts;

  const hashScore = hashOf(before) === hashOf(after) ? 1 : 0;
  const structural = structuralSimilarity(before, after);
  const semantic = embeddings
    ? cosineSimilarity(embeddings.before, embeddings.after)
    : null;

  const overall =
    semantic !== null
      ? 0.5 * semantic + 0.4 * structural + 0.1 * hashScore
      : 0.8 * structural + 0.2 * hashScore;

  const diffs = diffJson(before, after, diffLimit);
  const drifted = overall < 1 - tolerance;

  let summary: string;
  if (hashScore === 1) {
    summary = "Outputs are byte-identical (deterministic match).";
  } else if (overall >= 1 - tolerance) {
    const pct = (overall * 100).toFixed(1);
    summary = `No drift detected (overall ${pct}%, within ${(tolerance * 100).toFixed(0)}% tolerance).`;
  } else {
    const pct = (overall * 100).toFixed(1);
    const worst = diffs[0];
    const worstPath = worst ? worst.path : "$";
    summary = `Drift detected (overall ${pct}%, threshold ${(100 - tolerance * 100).toFixed(0)}%). Largest divergence at ${worstPath}.`;
  }

  return {
    score: { hash: hashScore, structural, semantic, overall },
    drifted,
    summary,
    diffs,
  };
}
