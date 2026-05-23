/**
 * SOVEREIGN MATRIX — Replay diff (Wave 157).
 *
 * Pure deep-object differ for comparing a replayed agent_run output
 * against its original. Surfaces what changed at field-path
 * granularity + an overall divergence score (0 = identical, 1 = totally
 * different).
 *
 * Why this exists:
 *   - Existing /api/agent-runs/[id]/replay just re-runs the agent
 *   - Operators want to SEE what's different vs the original receipt
 *   - Regression detection: did a fine-tune or prompt change worsen
 *     this agent's output for a known input?
 *   - Reproducibility proof for investors: same input + same code →
 *     similar output. Drift past a threshold flags real change.
 *
 * Algorithm:
 *   - Recursive walk of both trees in lockstep
 *   - Primitive comparison: strict equality
 *   - String comparison: token-Jaccard similarity (handles "minor
 *     wording changes" without flagging them as identical mismatches)
 *   - Number comparison: relative tolerance (default 1%) — agents
 *     return slightly different durationMs etc. on every run
 *   - Arrays: element-wise + length-difference penalty
 *   - Internal `_receipt`, `_model`, `_verifier` keys ignored (volatile
 *     by design)
 *
 * Pure-function design — no I/O, fully testable.
 */

const VOLATILE_KEYS = new Set([
  "_receipt",
  "_model",
  "_verifier",
  "_replayedFrom",
  "duration_ms",
  "durationMs",
  "total_duration_ms",
  "totalDuration_ms",
  "totalDurationMs",
  "generatedAt",
  "timestamp",
  "at",
  "createdAt",
  "id",
]);

const NUMBER_REL_TOLERANCE = 0.01;
const STRING_SIMILARITY_THRESHOLD = 0.85;
const MAX_NESTING = 32;

export type DiffKind = "added" | "removed" | "changed" | "value-mismatch";

export interface FieldDiff {
  /** Dot-separated path (e.g. "intelligence.analysis"). */
  path: string;
  kind: DiffKind;
  /** Original value (truncated to 200 chars). */
  before?: unknown;
  /** Replayed value (truncated to 200 chars). */
  after?: unknown;
  /** For strings: token-Jaccard similarity 0..1. */
  similarity?: number;
}

export interface ReplayDiff {
  /** All field-level differences. Capped at 200 entries. */
  fields: FieldDiff[];
  /**
   * 0..1 divergence score:
   *   0   = identical (ignoring volatile keys)
   *   0.5 = roughly half the fields differ
   *   1   = completely different shapes / values
   */
  divergence: number;
  /** Total comparable nodes walked. */
  nodesCompared: number;
  /** Volatile/ignored keys hit. */
  volatileIgnored: number;
  /** Hash of the canonical projection of `original` for traceability. */
  originalHash: string;
  /** Hash of the canonical projection of `replayed`. */
  replayedHash: string;
  /** True iff the canonical hashes match exactly. */
  hashesMatch: boolean;
}

function truncate(v: unknown): unknown {
  if (typeof v === "string") {
    return v.length > 200 ? `${v.slice(0, 200)}…` : v;
  }
  return v;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Pure: canonical projection that drops volatile keys. Used for the
 * "are the hashes identical" check.
 */
export function canonicalProjection(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalProjection);
  if (isObject(value)) {
    const out: Record<string, unknown> = {};
    const keys = Object.keys(value).sort();
    for (const k of keys) {
      if (VOLATILE_KEYS.has(k)) continue;
      out[k] = canonicalProjection(value[k]);
    }
    return out;
  }
  return value;
}

/**
 * Stable SHA-256 hex over the canonical projection. Hex chosen so
 * the surface looks the same as the receipt fabric's other hashes.
 */
export function canonicalHash(value: unknown): string {
  // Lazy import to keep this module browser-safe if ever consumed there
  const json = JSON.stringify(canonicalProjection(value));
  // Web-platform digest — we don't need cryptographic uniqueness here,
  // just stable identity. Use a simple FNV-1a-ish fold so the function
  // stays pure + sync + testable without Node's crypto.
  return fnv1aHex(json);
}

function fnv1aHex(s: string): string {
  // 64-bit FNV-1a — chosen for deterministic stable IDs, NOT cryptographic
  // protection. The actual receipt signatures use SHA-256 + Ed25519 +
  // ML-DSA-65 elsewhere; this hash is for diff-shape identity only.
  let high = 0xcbf2_9ce4;
  let low = 0x8422_2325;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    low ^= c;
    // 64-bit multiply by FNV prime 0x100000001b3 via 32-bit halves
    const prime_low = 0x1b3;
    const prime_high = 0x1_00_00_00_01;
    const al = low & 0xffff;
    const ah = (low >>> 16) & 0xffff;
    const bl = high & 0xffff;
    const bh = (high >>> 16) & 0xffff;
    const t_low = al * prime_low;
    const t_mid =
      (ah * prime_low + bl * prime_low + al * (prime_high & 0xffff)) >>> 0;
    const carry = Math.floor(
      (al * prime_low + ((ah * prime_low) << 16)) / 0x1_0000_0000,
    );
    const newLow = (t_low + ((t_mid & 0xffff) << 16)) >>> 0;
    const newHigh = ((bh + carry + (t_mid >>> 16)) >>> 0) ^ 0;
    low = newLow;
    high = newHigh;
  }
  return high.toString(16).padStart(8, "0") + low.toString(16).padStart(8, "0");
}

/** Pure: token-Jaccard similarity 0..1 over 4+-char words. */
export function tokenSimilarity(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  if (a === b) return 1;
  const ta = new Set(a.toLowerCase().match(/\b\w{4,}\b/g) ?? []);
  const tb = new Set(b.toLowerCase().match(/\b\w{4,}\b/g) ?? []);
  if (ta.size === 0 && tb.size === 0) return a === b ? 1 : 0;
  let intersect = 0;
  for (const t of ta) if (tb.has(t)) intersect++;
  const union = ta.size + tb.size - intersect;
  return union === 0 ? 0 : intersect / union;
}

function numbersWithinTolerance(a: number, b: number): boolean {
  if (a === b) return true;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  const denom = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) / denom <= NUMBER_REL_TOLERANCE;
}

interface WalkState {
  fields: FieldDiff[];
  comparable: number;
  mismatches: number;
  volatileIgnored: number;
  depth: number;
}

function walk(
  before: unknown,
  after: unknown,
  path: string,
  state: WalkState,
): void {
  if (state.depth > MAX_NESTING) return;
  if (state.fields.length >= 200) return;

  // Both undefined / null → match
  if (before === null && after === null) {
    state.comparable++;
    return;
  }

  // One side absent
  if (before === undefined && after !== undefined) {
    state.fields.push({ path, kind: "added", after: truncate(after) });
    state.comparable++;
    state.mismatches++;
    return;
  }
  if (after === undefined && before !== undefined) {
    state.fields.push({ path, kind: "removed", before: truncate(before) });
    state.comparable++;
    state.mismatches++;
    return;
  }

  // Array
  if (Array.isArray(before) && Array.isArray(after)) {
    const max = Math.max(before.length, after.length);
    const lengthMismatch = before.length !== after.length;
    if (lengthMismatch) {
      state.fields.push({
        path: `${path}.length`,
        kind: "changed",
        before: before.length,
        after: after.length,
      });
      state.mismatches++;
    }
    for (let i = 0; i < max; i++) {
      const sub = path ? `${path}[${i}]` : `[${i}]`;
      state.depth++;
      walk(before[i], after[i], sub, state);
      state.depth--;
    }
    state.comparable++;
    return;
  }

  // Object
  if (isObject(before) && isObject(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const k of keys) {
      if (VOLATILE_KEYS.has(k)) {
        state.volatileIgnored++;
        continue;
      }
      const sub = path ? `${path}.${k}` : k;
      state.depth++;
      walk(before[k], after[k], sub, state);
      state.depth--;
    }
    return;
  }

  // Both numbers — relative-tolerance compare
  if (typeof before === "number" && typeof after === "number") {
    state.comparable++;
    if (!numbersWithinTolerance(before, after)) {
      state.fields.push({
        path,
        kind: "value-mismatch",
        before,
        after,
      });
      state.mismatches++;
    }
    return;
  }

  // Both strings — token-Jaccard fuzzy compare
  if (typeof before === "string" && typeof after === "string") {
    state.comparable++;
    if (before === after) return;
    const sim = tokenSimilarity(before, after);
    if (sim < STRING_SIMILARITY_THRESHOLD) {
      state.fields.push({
        path,
        kind: "value-mismatch",
        before: truncate(before),
        after: truncate(after),
        similarity: Number(sim.toFixed(3)),
      });
      state.mismatches++;
    }
    return;
  }

  // Type mismatch or other primitives
  state.comparable++;
  if (before !== after) {
    state.fields.push({
      path,
      kind: "value-mismatch",
      before: truncate(before),
      after: truncate(after),
    });
    state.mismatches++;
  }
}

/**
 * Pure entry — compute a structured diff + divergence score between
 * two outputs. Inputs can be anything JSON-serialisable.
 */
export function computeReplayDiff(
  original: unknown,
  replayed: unknown,
): ReplayDiff {
  const state: WalkState = {
    fields: [],
    comparable: 0,
    mismatches: 0,
    volatileIgnored: 0,
    depth: 0,
  };
  walk(original, replayed, "", state);

  const divergence =
    state.comparable === 0
      ? 0
      : Math.min(1, state.mismatches / state.comparable);

  const originalHash = canonicalHash(original);
  const replayedHash = canonicalHash(replayed);

  return {
    fields: state.fields,
    divergence: Number(divergence.toFixed(4)),
    nodesCompared: state.comparable,
    volatileIgnored: state.volatileIgnored,
    originalHash,
    replayedHash,
    hashesMatch: originalHash === replayedHash,
  };
}

/** Convenience: human-readable one-line summary. */
export function summariseDiff(d: ReplayDiff): string {
  if (d.hashesMatch) return "Identical (canonical hash matches).";
  if (d.fields.length === 0)
    return `Hashes differ but no field-level changes detected (volatile-only).`;
  return `${d.fields.length} field${d.fields.length === 1 ? "" : "s"} differ — divergence ${(d.divergence * 100).toFixed(1)}%`;
}
