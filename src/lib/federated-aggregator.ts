/**
 * SOVEREIGN MATRIX — Federated learning aggregator (Wave 146).
 *
 * Privacy-preserving averaging primitive. Lets multiple Sovereign
 * deployments (or multiple tenants on the same deployment) contribute
 * to a shared adapter / prompt baseline / quality model WITHOUT any
 * individual deployment's raw data crossing the trust boundary.
 *
 * What's exchanged:
 *   - Per-deployment SCORES, not raw outputs
 *   - Per-deployment TENSOR DELTAS (e.g. embedding centroids), never
 *     full vectors
 *   - Differentially-private noise added optionally for HARD privacy
 *
 * What's computed centrally:
 *   - Weighted federated mean of scores
 *   - Element-wise mean of contributed tensor deltas
 *   - Outlier filtering via interquartile range (drops contributors
 *     that look like adversarial gradient-poisoning)
 *
 * Design rules:
 *   - Every function is pure — no I/O, no DB, no LLM
 *   - All inputs validated for shape; mismatched dimensions → error
 *   - DP noise is opt-in (default off) — caller picks the epsilon
 *   - "Byzantine-robust mean" via trimmed-mean (drop top/bottom k%)
 *
 * Use cases:
 *   - "Compute the federated quality bandit posterior" across N
 *     operators with shared agent registries
 *   - "Average the embedding centroids for the 'good output' cluster"
 *     across tenants for fine-tune adapter blending
 *   - "Vote on which prompt variant is winning" across deployments
 */

export interface Contribution {
  /** Pseudonymous contributor id — never the real userId. */
  contributorId: string;
  /** Scalar score (e.g. avg eval score). */
  scalar?: number;
  /** Optional weight — defaults to 1. Use sample count for weighted mean. */
  weight?: number;
  /** Optional tensor delta. All contributors must use the same length. */
  tensor?: number[];
}

export interface AggregateOptions {
  /** Drop top + bottom k% before averaging. Default 0 (no trimming). */
  trimFraction?: number;
  /**
   * If > 0, add Laplace noise with scale = sensitivity / epsilon to
   * the aggregate scalar. Differential privacy budget.
   */
  dpEpsilon?: number;
  /** Sensitivity of the scalar metric — used with dpEpsilon. Default 1. */
  dpSensitivity?: number;
  /** Reject contributors whose tensor norm is > k × median norm. Default 5. */
  outlierRejectK?: number;
  /** Optional seeded RNG for tests. */
  rng?: () => number;
}

export interface AggregateResult {
  /** Number of contributors that survived filtering. */
  contributorsUsed: number;
  /** Number of contributors that were rejected as outliers. */
  contributorsDropped: number;
  /** Weighted aggregate scalar (after optional DP noise). */
  scalar?: number;
  /** Element-wise aggregate tensor (after outlier filtering). */
  tensor?: number[];
}

/**
 * Pure aggregator — implements:
 *   1. Tensor outlier rejection (k × median norm)
 *   2. Optional trimmed mean for scalars
 *   3. Weighted mean of survivors
 *   4. Element-wise mean of survivor tensors
 *   5. Optional Laplace noise on the scalar
 */
export function aggregate(
  contributions: Contribution[],
  opts: AggregateOptions = {},
): AggregateResult {
  if (contributions.length === 0) {
    return { contributorsUsed: 0, contributorsDropped: 0 };
  }

  const rng = opts.rng ?? Math.random;
  const outlierK = opts.outlierRejectK ?? 5;
  const trim = clamp01(opts.trimFraction ?? 0);

  // ─── Tensor shape validation + outlier rejection ───
  let surviving = contributions.slice();
  let dropped = 0;
  const tensorLens = surviving
    .filter((c) => Array.isArray(c.tensor))
    .map((c) => c.tensor!.length);
  if (tensorLens.length > 0) {
    const expectedLen = tensorLens[0];
    for (const c of contributions) {
      if (c.tensor && c.tensor.length !== expectedLen) {
        throw new Error(
          `tensor length mismatch: ${c.contributorId} has ${c.tensor.length}, expected ${expectedLen}`,
        );
      }
    }

    const norms = surviving
      .filter((c) => c.tensor)
      .map((c) => l2norm(c.tensor!));
    if (norms.length > 0) {
      const median = quickMedian(norms);
      if (median > 0) {
        const limit = median * outlierK;
        const before = surviving.length;
        surviving = surviving.filter(
          (c) => !c.tensor || l2norm(c.tensor) <= limit,
        );
        dropped += before - surviving.length;
      }
    }
  }

  // ─── Trimmed-mean for scalars ───
  if (trim > 0 && surviving.length >= 4) {
    const sorted = surviving
      .filter((c) => typeof c.scalar === "number")
      .slice()
      .sort((a, b) => (a.scalar ?? 0) - (b.scalar ?? 0));
    const cut = Math.floor(sorted.length * trim);
    const keep = new Set(
      sorted.slice(cut, sorted.length - cut).map((c) => c.contributorId),
    );
    const before = surviving.length;
    surviving = surviving.filter(
      (c) => typeof c.scalar !== "number" || keep.has(c.contributorId),
    );
    dropped += before - surviving.length;
  }

  // ─── Weighted scalar mean ───
  let aggScalar: number | undefined;
  const withScalar = surviving.filter((c) => typeof c.scalar === "number");
  if (withScalar.length > 0) {
    const totalWeight = withScalar.reduce((s, c) => s + (c.weight ?? 1), 0);
    if (totalWeight > 0) {
      const weighted = withScalar.reduce(
        (s, c) => s + (c.scalar ?? 0) * (c.weight ?? 1),
        0,
      );
      aggScalar = weighted / totalWeight;
    }
    if (opts.dpEpsilon && opts.dpEpsilon > 0 && aggScalar != null) {
      const sensitivity = opts.dpSensitivity ?? 1;
      aggScalar = aggScalar + laplaceNoise(sensitivity / opts.dpEpsilon, rng);
    }
  }

  // ─── Element-wise tensor mean ───
  let aggTensor: number[] | undefined;
  const withTensor = surviving.filter((c) => c.tensor);
  if (withTensor.length > 0) {
    const len = withTensor[0].tensor!.length;
    const sums = new Array<number>(len).fill(0);
    const totalWeight = withTensor.reduce((s, c) => s + (c.weight ?? 1), 0);
    if (totalWeight > 0) {
      for (const c of withTensor) {
        const w = c.weight ?? 1;
        for (let i = 0; i < len; i++) {
          sums[i] += (c.tensor![i] ?? 0) * w;
        }
      }
      aggTensor = sums.map((s) => s / totalWeight);
    }
  }

  return {
    contributorsUsed: surviving.length,
    contributorsDropped: dropped,
    scalar: aggScalar,
    tensor: aggTensor,
  };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  // Cap at 0.49 so for any N ≥ 3, at least one contributor survives
  // the trim (e.g. N=4 → cut=1, keep 2 middle values).
  if (n > 0.49) return 0.49;
  return n;
}

function l2norm(v: number[]): number {
  let s = 0;
  for (const x of v) s += x * x;
  return Math.sqrt(s);
}

function quickMedian(arr: number[]): number {
  const sorted = arr.slice().sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return 0;
  if (n % 2 === 1) return sorted[(n - 1) / 2];
  return (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}

/**
 * Laplace(0, b) noise sample using the inverse-CDF transform.
 * Pure — RNG injectable for reproducibility in tests.
 */
export function laplaceNoise(
  scale: number,
  rng: () => number = Math.random,
): number {
  const u = rng() - 0.5;
  return -Math.sign(u) * scale * Math.log(1 - 2 * Math.abs(u));
}
