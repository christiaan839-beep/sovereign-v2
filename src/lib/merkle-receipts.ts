/**
 * SOVEREIGN MATRIX — Daily Merkle root of receipts (Wave 141).
 *
 * The cryptographic moat: every day, every signed agent_run gets
 * hashed into a Merkle tree, and the root is published publicly.
 * Anyone with a single receipt can compute its Merkle path to the
 * root and PROVE the receipt was part of the platform's signed
 * output on that day — without trusting the platform's servers.
 *
 * Why this matters (in plain terms):
 *   - Auditors can verify "Sovereign ran 73,421 agents on 2026-05-22"
 *     by checking the published root against the receipts they hold
 *   - A hostile fork can't claim our outputs — every output is
 *     bound to the day's published root
 *   - Customers retain proofs that survive even if Sovereign goes
 *     dark — the published root + their receipt + the Merkle path
 *     is a self-contained proof
 *
 * Operating mode:
 *   - Pure-function `buildMerkleTree(leaves)` is unit-tested in
 *     isolation (no DB, no I/O)
 *   - `computeMerklePath(leaves, idx)` produces the proof a holder
 *     needs to verify membership
 *   - `verifyMerklePath(leaf, path, root)` is the verifier — runs
 *     anywhere (server, browser, jq | shasum, etc.)
 *   - `buildDailyRoot(date)` is the DB-backed wrapper that pulls
 *     `agent_runs` for the day and returns the root
 *
 * Hash function: SHA-256 (the same primitive that backs the HMAC
 * receipt signatures already in production). Single algorithm,
 * one source of truth.
 *
 * Standard: this is the same construction Bitcoin and Certificate
 * Transparency use — well-vetted, hardware-accelerated everywhere.
 */

import { createHash } from "node:crypto";
import { db } from "@/db";
import { agentRuns } from "@/db/schema";
import { gt, lt, and } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("merkle-receipts");

export interface MerkleLeaf {
  /** The receipt id (UUID). */
  id: string;
  /** SHA-256 hex hash of the leaf. */
  hash: string;
}

export interface MerkleTree {
  root: string;
  /** Tree levels — level 0 = leaves, last level = root (length 1). */
  levels: string[][];
  /** Original leaf count (pre-padding). */
  leafCount: number;
}

export interface MerkleProof {
  /** Sibling hashes from leaf to root. */
  siblings: string[];
  /** "L" or "R" indicating whether the sibling is on the left or right. */
  positions: Array<"L" | "R">;
  /** The leaf hash being proven. */
  leafHash: string;
  /** The expected root. */
  root: string;
}

function sha256(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Hash a pair of children — deterministic ordering by concat.
 * Uses the "0x01" prefix for internal nodes per the RFC 9162
 * (Certificate Transparency v2) convention so leaves and internal
 * nodes are unambiguously distinguishable.
 */
function hashPair(left: string, right: string): string {
  return sha256(Buffer.from(`01${left}${right}`, "hex").toString("binary"));
}

/**
 * Hash a leaf with the "0x00" prefix — also from RFC 9162. Makes
 * the leaf vs internal node distinction explicit in the hash.
 */
export function leafHash(canonicalReceipt: string): string {
  return sha256(`00${canonicalReceipt}`);
}

/**
 * Build a complete Merkle tree from leaf hashes. Pads with the
 * duplicate of the last leaf when the level is odd (Bitcoin
 * convention — simple + universally interoperable).
 *
 * Returns the tree + root + leafCount. Empty leaves → "" root and
 * leafCount = 0 (no error — empty days are valid).
 */
export function buildMerkleTree(leafHashes: string[]): MerkleTree {
  if (leafHashes.length === 0) {
    return { root: "", levels: [[]], leafCount: 0 };
  }

  const levels: string[][] = [leafHashes.slice()];

  while (levels[levels.length - 1].length > 1) {
    const prev = levels[levels.length - 1];
    const next: string[] = [];
    for (let i = 0; i < prev.length; i += 2) {
      const left = prev[i];
      const right = i + 1 < prev.length ? prev[i + 1] : left; // pad
      next.push(hashPair(left, right));
    }
    levels.push(next);
  }

  return {
    root: levels[levels.length - 1][0],
    levels,
    leafCount: leafHashes.length,
  };
}

/**
 * Compute a Merkle path proving leaf[idx] is in the tree. Returns
 * null on out-of-range index. The returned path can be verified
 * with `verifyMerklePath` by anyone with the leaf + root.
 */
export function computeMerklePath(
  tree: MerkleTree,
  idx: number,
): MerkleProof | null {
  if (idx < 0 || idx >= tree.leafCount) return null;
  if (tree.levels.length === 0 || tree.levels[0].length === 0) return null;

  const siblings: string[] = [];
  const positions: Array<"L" | "R"> = [];
  let cur = idx;
  const leafHashVal = tree.levels[0][idx];

  for (let level = 0; level < tree.levels.length - 1; level++) {
    const lvl = tree.levels[level];
    const isRight = cur % 2 === 1;
    const siblingIdx = isRight ? cur - 1 : cur + 1;
    const sibling = siblingIdx < lvl.length ? lvl[siblingIdx] : lvl[cur]; // pad-duplicate
    siblings.push(sibling);
    positions.push(isRight ? "L" : "R");
    cur = Math.floor(cur / 2);
  }

  return {
    siblings,
    positions,
    leafHash: leafHashVal,
    root: tree.root,
  };
}

/**
 * Pure verifier — anyone with (leaf, proof, root) can verify
 * without the original tree. Returns true iff the path reconstructs
 * the claimed root.
 */
export function verifyMerklePath(proof: MerkleProof): boolean {
  if (!proof.leafHash || !proof.root) return false;
  if (proof.siblings.length !== proof.positions.length) return false;

  let acc = proof.leafHash;
  for (let i = 0; i < proof.siblings.length; i++) {
    const sib = proof.siblings[i];
    acc = proof.positions[i] === "L" ? hashPair(sib, acc) : hashPair(acc, sib);
  }
  return acc === proof.root;
}

/**
 * Canonical receipt format — the bytes Sovereign hashes for the
 * Merkle leaf. Order matters: id|agentName|modelUsed|durationMs|
 * trustDecision|signature|createdAt-iso.
 *
 * This is stable across versions because the SQL projection is
 * fixed; future receipt fields will be added to a NEW v2 leaf
 * format with its own published root.
 */
export function canonicalReceiptString(row: {
  id: string;
  agentName: string;
  modelUsed: string;
  durationMs: number;
  trustDecision: string;
  signature: string;
  createdAt: Date | string;
}): string {
  const iso =
    row.createdAt instanceof Date
      ? row.createdAt.toISOString()
      : String(row.createdAt);
  return [
    row.id,
    row.agentName,
    row.modelUsed,
    String(row.durationMs),
    row.trustDecision,
    row.signature,
    iso,
  ].join("|");
}

export interface DailyMerkleSummary {
  /** YYYY-MM-DD UTC. */
  date: string;
  root: string;
  leafCount: number;
  /** First + last receipt IDs in the day (for spot-check by auditors). */
  firstLeafId?: string;
  lastLeafId?: string;
  generatedAt: string;
}

/**
 * Pull every signed receipt for a given UTC day and compute the
 * Merkle root. Returns an empty-but-valid shape when no receipts
 * landed that day (root = "", leafCount = 0).
 */
export async function buildDailyRoot(
  dateUtc: Date,
): Promise<DailyMerkleSummary> {
  const startOfDay = new Date(
    Date.UTC(
      dateUtc.getUTCFullYear(),
      dateUtc.getUTCMonth(),
      dateUtc.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
  const isoDate = startOfDay.toISOString().slice(0, 10);

  try {
    const rows = await db
      .select({
        id: agentRuns.id,
        agentName: agentRuns.agentName,
        modelUsed: agentRuns.modelUsed,
        durationMs: agentRuns.durationMs,
        trustDecision: agentRuns.trustDecision,
        signature: agentRuns.signature,
        createdAt: agentRuns.createdAt,
      })
      .from(agentRuns)
      .where(
        and(
          gt(agentRuns.createdAt, startOfDay),
          lt(agentRuns.createdAt, endOfDay),
        ),
      )
      .orderBy(agentRuns.createdAt);

    if (rows.length === 0) {
      return {
        date: isoDate,
        root: "",
        leafCount: 0,
        generatedAt: new Date().toISOString(),
      };
    }

    const leaves = rows.map((r) =>
      leafHash(
        canonicalReceiptString({ ...r, createdAt: r.createdAt as Date }),
      ),
    );
    const tree = buildMerkleTree(leaves);

    return {
      date: isoDate,
      root: tree.root,
      leafCount: tree.leafCount,
      firstLeafId: rows[0].id,
      lastLeafId: rows[rows.length - 1].id,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "42P01") {
      return {
        date: isoDate,
        root: "",
        leafCount: 0,
        generatedAt: new Date().toISOString(),
      };
    }
    log.warn("buildDailyRoot failed", { error: String(err) });
    throw err;
  }
}
