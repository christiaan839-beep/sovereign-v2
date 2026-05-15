/**
 * SOVEREIGN MATRIX — Cross-tenant ZK-lite pass-rate proofs (Cook 106).
 *
 * "Tenant A's pass rate ≥ 99%" — provable to an auditor without
 * revealing WHICH agents ran or WHICH inputs were used. We achieve
 * this via:
 *
 *   1. Tenant publishes a Merkle ROOT over their per-run pass/fail
 *      outcomes for the period.
 *   2. To prove pass-rate ≥ τ, tenant reveals only:
 *        - total run count N
 *        - pass count P
 *        - the Merkle root committing to the per-run outcomes
 *      The verifier checks P/N ≥ τ and that P + (N − P) = N. This
 *      is technically a SUM PROOF, not full ZK — it leaks the
 *      AGGREGATES but not the individuals.
 *   3. For random spot-check, verifier asks for an inclusion proof
 *      on K random indices; the tenant supplies them and the
 *      verifier recomputes the root.
 *
 * This is "ZK-lite": pass-rate is provable without revealing
 * per-run details (which agent, which input, which output). True
 * zero-knowledge requires bulletproofs / SNARKs which are out of
 * scope here. The trade-off: tenant must publish the root + reveal
 * the aggregates. In practice this is enough for procurement
 * teams ("we passed 99.4 % of runs last quarter") without exposing
 * customer data.
 */

import { createHash } from "crypto";

// ── Public types ──────────────────────────────────────────────────────────

export type RunOutcome = "pass" | "fail";

export interface PassRateCommit {
  /** Hex Merkle root over the per-run outcomes. */
  root: string;
  /** Total number of runs in the period. */
  totalRuns: number;
  /** Number that passed. */
  passCount: number;
  /** Tenant id — not secret. */
  tenantId: string;
  /** Period start (ISO date). */
  periodStart: string;
  /** Period end (ISO date). */
  periodEnd: string;
}

export interface InclusionProof {
  /** Index in the leaf list. */
  index: number;
  /** Outcome at this index. */
  outcome: RunOutcome;
  /** Sibling hashes from leaf up to root. */
  siblings: string[];
}

// ── Hashing helpers (same domain separation as Cook 51) ──────────────────

function hashOutcomeLeaf(index: number, outcome: RunOutcome): string {
  return createHash("sha256")
    .update(
      Buffer.concat([Buffer.from([0x00]), Buffer.from(`${index}|${outcome}`)]),
    )
    .digest("hex");
}

function hashInternal(left: string, right: string): string {
  return createHash("sha256")
    .update(
      Buffer.concat([
        Buffer.from([0x01]),
        Buffer.from(left, "hex"),
        Buffer.from(right, "hex"),
      ]),
    )
    .digest("hex");
}

// ── Tree construction ────────────────────────────────────────────────────

function buildLayers(outcomes: RunOutcome[]): string[][] {
  if (outcomes.length === 0) {
    throw new Error("commit: at least one outcome required");
  }
  const leaves = outcomes.map((o, i) => hashOutcomeLeaf(i, o));
  while ((leaves.length & (leaves.length - 1)) !== 0) {
    leaves.push(leaves[leaves.length - 1]);
  }
  const layers: string[][] = [leaves];
  while (layers[layers.length - 1].length > 1) {
    const prev = layers[layers.length - 1];
    const next: string[] = [];
    for (let i = 0; i < prev.length; i += 2) {
      next.push(hashInternal(prev[i], prev[i + 1]));
    }
    layers.push(next);
  }
  return layers;
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Commit a list of pass/fail outcomes to a Merkle root + publish
 * the aggregate pass-rate.
 */
export function commitPassRate(args: {
  outcomes: RunOutcome[];
  tenantId: string;
  periodStart: string;
  periodEnd: string;
}): PassRateCommit {
  const layers = buildLayers(args.outcomes);
  const root = layers[layers.length - 1][0];
  const passCount = args.outcomes.filter((o) => o === "pass").length;
  return {
    root,
    totalRuns: args.outcomes.length,
    passCount,
    tenantId: args.tenantId,
    periodStart: args.periodStart,
    periodEnd: args.periodEnd,
  };
}

/**
 * Build an inclusion proof for one outcome — used during random
 * spot-check by the auditor.
 */
export function discloseOutcome(
  outcomes: RunOutcome[],
  index: number,
): InclusionProof {
  if (index < 0 || index >= outcomes.length) {
    throw new Error("discloseOutcome: index out of range");
  }
  const layers = buildLayers(outcomes);
  const siblings: string[] = [];
  let i = index;
  for (let lvl = 0; lvl < layers.length - 1; lvl++) {
    const layer = layers[lvl];
    siblings.push(layer[i ^ 1]);
    i = Math.floor(i / 2);
  }
  return {
    index,
    outcome: outcomes[index],
    siblings,
  };
}

/** Verify a single inclusion proof reconstructs the published root. */
export function verifyInclusion(proof: InclusionProof, root: string): boolean {
  let node = hashOutcomeLeaf(proof.index, proof.outcome);
  let i = proof.index;
  for (const sibling of proof.siblings) {
    if ((i & 1) === 0) {
      node = hashInternal(node, sibling);
    } else {
      node = hashInternal(sibling, node);
    }
    i = Math.floor(i / 2);
  }
  return node === root;
}

/**
 * Verify the pass-rate claim. The auditor checks:
 *   - passCount ≤ totalRuns (no overflow)
 *   - actualRate = passCount / totalRuns ≥ claimedThreshold
 *   - Returns whether the claim holds and the actual rate.
 *
 * For a tampered commit (e.g. tenant inflated passCount), random
 * spot-check via `discloseOutcome` + `verifyInclusion` catches it.
 */
export function verifyClaim(
  commit: PassRateCommit,
  claimedThreshold: number,
): { holds: boolean; actualRate: number; message?: string } {
  if (claimedThreshold < 0 || claimedThreshold > 1) {
    return {
      holds: false,
      actualRate: 0,
      message: "claimedThreshold must be in [0, 1]",
    };
  }
  if (commit.passCount > commit.totalRuns) {
    return {
      holds: false,
      actualRate: 0,
      message: "passCount exceeds totalRuns",
    };
  }
  if (commit.totalRuns === 0) {
    return {
      holds: false,
      actualRate: 0,
      message: "totalRuns is 0",
    };
  }
  const actualRate = commit.passCount / commit.totalRuns;
  return {
    holds: actualRate >= claimedThreshold,
    actualRate,
  };
}
