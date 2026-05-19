/**
 * SOVEREIGN MATRIX — Defense-event receipts.
 *
 * Every time a guard blocks something (jailbreak, egress, rate-limit,
 * PII leak, output-policy, budget) we emit a canonicalised, optionally
 * dual-signed receipt. The point: the defenses themselves become
 * auditable. A regulator can prove that X attacks were blocked last
 * quarter without trusting our word — they verify the receipts.
 *
 * Wire schema id: `vaos-defense-event-v1`.
 *
 * What this module does, in order:
 *   1. Canonicalise the event into a deterministic JSON string (key
 *      ordering matters — receipts have to hash identically across
 *      verifier implementations).
 *   2. Compute a SHA-256 commitment over the input signal (so we can
 *      prove the signal existed without storing the signal itself).
 *   3. Sign canonical bytes with ML-DSA-65 (post-quantum) when keys
 *      are configured; Ed25519 is added by the caller when a key is
 *      provided (the platform key lives in agent-runs.ts, kept here
 *      decoupled to avoid a cycle).
 *   4. Write an `audit_logs` row with action `defense.block` so the
 *      receipt is recoverable from the existing audit substrate.
 *
 * What this module deliberately does NOT do:
 *   - Store the raw signal text. Signal commitments (sha256(signal))
 *     let us prove existence without becoming a content store.
 *   - Throw on signing-key absence. Receipts are best-effort signed;
 *     unsigned receipts still carry the schema id, ts, category, and
 *     commitment — useful for audit even without keys.
 */

import { createHash } from "node:crypto";
import { auditLog } from "@/lib/audit-log";
import { signMlDsa65, isPqDualSignEnabled } from "@/lib/pq-sign";
import { createLogger } from "@/lib/logger";

const log = createLogger("defense-receipts");

export const DEFENSE_RECEIPT_SCHEMA = "vaos-defense-event-v1";

export type DefenseCategory =
  | "jailbreak"
  | "egress-blocked"
  | "rate-limit"
  | "auth"
  | "pii-leak"
  | "output-policy"
  | "budget"
  | "ssrf"
  | "input-policy";

/** Severity: 0 = informational, 100 = critical. */
export type DefenseSeverity = number;

export interface DefenseReceiptInput {
  /** The defensive subsystem reporting the block (e.g. "jailbreak-detect"). */
  ruleId: string;
  /** What category of attack/violation this block represents. */
  category: DefenseCategory;
  /** 0–100 — higher = more confident this was malicious. */
  severity: DefenseSeverity;
  /** Free-form, regulator-readable reason. */
  reason: string;
  /**
   * The raw input that triggered the block. We hash this — we never
   * store it. Pass undefined when no input is implicated (e.g. an
   * outbound-fetch policy block triggered by URL alone).
   */
  signal?: string;
  /** Optional structured commitment fields (URL hash, etc.) — already hashed by caller. */
  commitments?: Record<string, string>;
  /** Tenant scope. Optional in unauth flows (rate-limit on public surface). */
  tenantId?: string;
  /** User scope. Optional in unauth flows. */
  userId?: string;
}

export interface DefenseReceipt {
  schema: typeof DEFENSE_RECEIPT_SCHEMA;
  ts: string;
  ruleId: string;
  category: DefenseCategory;
  severity: DefenseSeverity;
  reason: string;
  /** SHA-256 hex over the signal, or null when no signal was implicated. */
  signalCommitment: string | null;
  commitments: Record<string, string>;
  tenantId: string | null;
  userId: string | null;
  /** Base64 ML-DSA-65 signature over canonical bytes; null when keys not configured. */
  mldsa65Sig: string | null;
  /** True iff post-quantum dual-signing was enabled at emission. */
  pqEnabled: boolean;
}

/**
 * Canonicalise a defense receipt for signing. Field order is fixed —
 * any signer producing a different ordering will produce a different
 * signature, breaking cross-implementation verification.
 */
export function canonicalizeDefenseReceipt(
  r: Omit<DefenseReceipt, "mldsa65Sig" | "pqEnabled">,
): string {
  // Stringify with a fixed key order. We do NOT use JSON.stringify with
  // a replacer because Object.keys order isn't a stable contract across
  // every JS engine — explicit ordering is the only forward-safe option.
  return JSON.stringify({
    schema: r.schema,
    ts: r.ts,
    ruleId: r.ruleId,
    category: r.category,
    severity: r.severity,
    reason: r.reason,
    signalCommitment: r.signalCommitment,
    commitments: sortObject(r.commitments),
    tenantId: r.tenantId,
    userId: r.userId,
  });
}

function sortObject(o: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(o).sort()) {
    out[k] = o[k];
  }
  return out;
}

/** SHA-256 hex of an input string. Used for signal commitments. */
export function commit(signal: string): string {
  return createHash("sha256").update(signal, "utf8").digest("hex");
}

/**
 * Emit a defense receipt. Best-effort — never throws, never blocks
 * the calling guard. The guard's response to the caller is unchanged;
 * this is the audit trail.
 *
 * Returns the emitted receipt (caller may want to attach the
 * commitment to a response header for client-side proof).
 */
export async function emitDefenseReceipt(
  input: DefenseReceiptInput,
): Promise<DefenseReceipt> {
  // Clamp severity into [0, 100] — defends downstream dashboards from
  // misuse where a guard passes a raw model confidence in [0, 1].
  const severity = Math.max(0, Math.min(100, Math.round(input.severity)));

  const unsigned: Omit<DefenseReceipt, "mldsa65Sig" | "pqEnabled"> = {
    schema: DEFENSE_RECEIPT_SCHEMA,
    ts: new Date().toISOString(),
    ruleId: input.ruleId,
    category: input.category,
    severity,
    reason: input.reason,
    signalCommitment: input.signal ? commit(input.signal) : null,
    commitments: input.commitments ?? {},
    tenantId: input.tenantId ?? null,
    userId: input.userId ?? null,
  };

  const canonical = canonicalizeDefenseReceipt(unsigned);
  let mldsa65Sig: string | null = null;
  try {
    mldsa65Sig = signMlDsa65(canonical);
  } catch (err) {
    log.warn("defense receipt ML-DSA-65 signing failed", {
      error: String(err),
    });
  }

  const receipt: DefenseReceipt = {
    ...unsigned,
    mldsa65Sig,
    pqEnabled: isPqDualSignEnabled(),
  };

  // Audit-log write is fire-and-forget — auditLog already swallows
  // errors and never throws, but we still wrap in try/catch in case
  // the underlying contract changes.
  try {
    await auditLog({
      userId: receipt.userId ?? "system",
      action: "defense.block",
      resource: `${receipt.category}:${receipt.ruleId}`,
      details: {
        schema: receipt.schema,
        ts: receipt.ts,
        category: receipt.category,
        severity: receipt.severity,
        reason: receipt.reason,
        signalCommitment: receipt.signalCommitment,
        commitments: receipt.commitments,
        mldsa65Sig: receipt.mldsa65Sig,
        pqEnabled: receipt.pqEnabled,
      },
    });
  } catch (err) {
    log.error("defense receipt audit write failed", { error: String(err) });
  }

  return receipt;
}
