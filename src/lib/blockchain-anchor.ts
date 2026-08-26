/**
 * SOVEREIGN MATRIX — Cross-chain anchor primitive (Cook 169).
 *
 * Periodically anchor Sovereign Merkle-batch roots into public
 * blockchains (Bitcoin OP_RETURN, Ethereum calldata, Cosmos).
 * Once anchored, the operator can no longer rewrite history:
 * the public chain is the ultimate immutable witness.
 *
 * Pure module: produces the canonical anchor payload + verification
 * helpers. Caller wires the actual chain-submission cron (typically
 * once-per-batch or once-per-hour). The chain reference (txid /
 * block height) is persisted by the caller and surfaced in the
 * audit-bundle delivered to the auditor.
 *
 * Why this matters:
 *   - Tomorrow you could in principle rewrite your own database.
 *   - The Merkle batch (Cook 167) shows you committed to a root.
 *   - The retention tombstone (Cook 168) shows you deleted on time.
 *   - The blockchain anchor proves WHEN you committed the root —
 *     mathematically impossible to backdate.
 *
 * The three compose: the ratchet shows nothing was removed, the
 * tombstone shows deletion happened on time, and the anchor pins when
 * the root existed. Each is checkable independently by someone who
 * does not trust the operator, which is the only property that matters
 * when the operator is the party being audited.
 */

import { createHash } from "crypto";

// ── Public types ──────────────────────────────────────────────────────────

export type AnchorChain =
  | "bitcoin-mainnet"
  | "bitcoin-testnet"
  | "ethereum-mainnet"
  | "ethereum-sepolia"
  | "cosmos-mainnet"
  | "polygon-mainnet";

export interface AnchorPayload {
  /** Domain-separated magic prefix — chain-side filter for Sovereign anchors. */
  magic: "SVRGN1";
  /** The Merkle root being anchored (from Cook 167). */
  root: string;
  /** Tenant cohort being anchored (group commitment id). */
  cohortId: string;
  /** Unix ms when the root was sealed. */
  sealedAt: number;
  /** Count of receipts in the batch. */
  leafCount: number;
  /** Optional reference to the previous anchor (forms an off-chain chain). */
  prevAnchor?: string;
}

export interface AnchorRecord {
  payload: AnchorPayload;
  chain: AnchorChain;
  /** Transaction id on the target chain. */
  txid: string;
  /** Block height the txid was confirmed in (null until confirmed). */
  blockHeight: number | null;
  /** Unix ms when the operator submitted to the chain. */
  submittedAt: number;
  /** Unix ms when the chain confirmed (null until confirmed). */
  confirmedAt: number | null;
}

export interface VerifyOutcome {
  ok: boolean;
  reason?:
    | "bad-magic"
    | "bad-payload-hash"
    | "no-confirmation"
    | "stale-anchor"
    | "wrong-chain";
}

// ── Serialization (op-code-safe for OP_RETURN / Ethereum calldata) ────────

/**
 * Encode an anchor payload to a fixed-size byte stream. Bitcoin
 * OP_RETURN allows 80 bytes by standard relay policy; this encoding
 * fits 78 bytes when prevAnchor is null, 110 when present (split
 * across two outputs).
 *
 * Wire format:
 *   bytes  0- 5: magic "SVRGN1"
 *   bytes  6-37: 32-byte root (binary)
 *   bytes 38-45: 8-byte cohort-id hash (sha256 first 8 bytes)
 *   bytes 46-53: 8-byte sealedAt (big-endian uint64)
 *   bytes 54-57: 4-byte leafCount (big-endian uint32)
 *   bytes 58-89: (optional) 32-byte prevAnchor hash
 */
export function encodePayload(p: AnchorPayload): Buffer {
  if (p.magic !== "SVRGN1") {
    throw new Error("encodePayload: magic must be 'SVRGN1'");
  }
  if (!/^[0-9a-f]{64}$/i.test(p.root)) {
    throw new Error("encodePayload: root must be 64 hex chars");
  }
  const magic = Buffer.from("SVRGN1", "utf8");
  const rootBytes = Buffer.from(p.root, "hex");
  const cohortBytes = createHash("sha256")
    .update(p.cohortId)
    .digest()
    .subarray(0, 8);
  const tsBuf = Buffer.alloc(8);
  tsBuf.writeBigUInt64BE(BigInt(p.sealedAt));
  const countBuf = Buffer.alloc(4);
  countBuf.writeUInt32BE(p.leafCount >>> 0);
  const parts = [magic, rootBytes, cohortBytes, tsBuf, countBuf];
  if (p.prevAnchor) {
    if (!/^[0-9a-f]{64}$/i.test(p.prevAnchor)) {
      throw new Error("encodePayload: prevAnchor must be 64 hex chars");
    }
    parts.push(Buffer.from(p.prevAnchor, "hex"));
  }
  return Buffer.concat(parts);
}

/**
 * Hash the encoded payload — this is the digest the operator
 * commits to the public chain (via OP_RETURN, calldata, or memo).
 */
export function digestOf(p: AnchorPayload): string {
  return createHash("sha256").update(encodePayload(p)).digest("hex");
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Build a fresh anchor payload from a Merkle-batch root.
 * Caller submits the resulting digestOf(payload) to the chosen chain.
 */
export function buildAnchor(args: {
  root: string;
  cohortId: string;
  sealedAt: number;
  leafCount: number;
  prevAnchor?: string;
}): AnchorPayload {
  return {
    magic: "SVRGN1",
    root: args.root,
    cohortId: args.cohortId,
    sealedAt: args.sealedAt,
    leafCount: args.leafCount,
    prevAnchor: args.prevAnchor,
  };
}

/**
 * Verify an anchor record. Returns ok:true iff the record:
 *   - has a confirmed block height + confirmedAt
 *   - was submitted before any tolerated drift window
 *   - the payload encodes to the same digest the caller-provided
 *     expected digest claims
 */
export function verifyAnchor(args: {
  record: AnchorRecord;
  expectedChain: AnchorChain;
  expectedDigest: string;
  /** Tolerated max gap (ms) between sealedAt and submittedAt. Default 24h. */
  maxSubmissionLagMs?: number;
}): VerifyOutcome {
  if (args.record.chain !== args.expectedChain) {
    return { ok: false, reason: "wrong-chain" };
  }
  if (args.record.payload.magic !== "SVRGN1") {
    return { ok: false, reason: "bad-magic" };
  }
  if (args.record.blockHeight === null || args.record.confirmedAt === null) {
    return { ok: false, reason: "no-confirmation" };
  }
  const lag = args.record.submittedAt - args.record.payload.sealedAt;
  const maxLag = args.maxSubmissionLagMs ?? 24 * 60 * 60 * 1000;
  if (lag < 0 || lag > maxLag) {
    return { ok: false, reason: "stale-anchor" };
  }
  if (digestOf(args.record.payload) !== args.expectedDigest) {
    return { ok: false, reason: "bad-payload-hash" };
  }
  return { ok: true };
}

/**
 * Compose a human-readable explorer URL for the chain reference.
 * The auditor clicks this and sees the on-chain transaction directly.
 */
export function explorerUrl(record: AnchorRecord): string | null {
  if (!record.txid) return null;
  switch (record.chain) {
    case "bitcoin-mainnet":
      return `https://mempool.space/tx/${record.txid}`;
    case "bitcoin-testnet":
      return `https://mempool.space/testnet/tx/${record.txid}`;
    case "ethereum-mainnet":
      return `https://etherscan.io/tx/${record.txid}`;
    case "ethereum-sepolia":
      return `https://sepolia.etherscan.io/tx/${record.txid}`;
    case "cosmos-mainnet":
      return `https://www.mintscan.io/cosmos/transactions/${record.txid}`;
    case "polygon-mainnet":
      return `https://polygonscan.com/tx/${record.txid}`;
    default:
      return null;
  }
}

/**
 * Recommended chain for a given regulatory pack. Different
 * regulators have different preferences for which public chain
 * counts as "authoritative" — Bitcoin is the default for highest
 * settlement assurance; Ethereum is preferred where smart-contract
 * recovery hooks are needed.
 */
export function recommendChainFor(
  vertical:
    | "csrd"
    | "banking"
    | "clinical-trials"
    | "pharmacovigilance"
    | "insurance-claims"
    | "utilities"
    | "defense"
    | "tax-audit"
    | "general",
): AnchorChain {
  switch (vertical) {
    case "defense":
      return "bitcoin-mainnet";
    case "csrd":
    case "tax-audit":
      return "ethereum-mainnet";
    case "banking":
    case "insurance-claims":
      return "bitcoin-mainnet";
    case "clinical-trials":
    case "pharmacovigilance":
      return "ethereum-mainnet";
    case "utilities":
      return "bitcoin-mainnet";
    case "general":
    default:
      return "bitcoin-mainnet";
  }
}
