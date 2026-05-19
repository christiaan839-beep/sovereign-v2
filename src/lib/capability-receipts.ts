/**
 * SOVEREIGN MATRIX — Capability-invocation receipts.
 *
 * Every agent tool call — file read, outbound HTTP, DB query, shell
 * exec — emits a signed receipt that records WHICH capability was
 * invoked, under WHICH policy, with WHAT outcome. The point: agents
 * become *provably bounded*. A regulator can prove that an agent
 * stayed inside its sandbox without having to trust our word.
 *
 * Pairs with `defense-receipts.ts` (which records what we BLOCKED).
 * Together: every defensive action AND every permitted action leaves
 * a cryptographic trail.
 *
 * Wire schema id: `vaos-capability-event-v1`.
 *
 * What this module does:
 *   1. Canonicalise the invocation into deterministic JSON bytes.
 *   2. Commit sensitive identifiers (URL, file path, query string)
 *      to sha256 — receipts never store raw paths or args.
 *   3. Sign canonical bytes with ML-DSA-65 when keys are configured
 *      (post-quantum forward-secure).
 *   4. Write an `audit_logs` row with action `capability.invoke`.
 *
 * What this module deliberately does NOT do:
 *   - Store raw tool arguments. Commitments only.
 *   - Block. This is observability, not enforcement. The egress
 *     allowlist, SSRF guard, etc. enforce; this records what they
 *     allowed.
 *   - Throw on signing-key absence. Receipts are best-effort signed;
 *     unsigned receipts still carry the schema id, ts, capability,
 *     and outcome.
 */

import { createHash } from "node:crypto";
import { auditLog } from "@/lib/audit-log";
import { signMlDsa65, isPqDualSignEnabled } from "@/lib/pq-sign";
import { createLogger } from "@/lib/logger";

const log = createLogger("capability-receipts");

export const CAPABILITY_RECEIPT_SCHEMA = "vaos-capability-event-v1";

/**
 * Capability class. New classes are added at the bottom — never
 * renamed — because downstream auditors join on these values.
 */
export type CapabilityKind =
  | "fetch"
  | "file-read"
  | "file-write"
  | "shell-exec"
  | "db-read"
  | "db-write"
  | "llm-call"
  | "secret-access"
  | "external-api"
  | "tool-call";

/**
 * Outcome of the capability invocation. `allowed-truncated` means the
 * call was permitted but the response was capped (e.g. response body
 * larger than maxResponseBytes). `policy-denied` means a policy gate
 * blocked it (egress allowlist, RBAC, paywall). `error` means the
 * underlying call threw or returned a non-2xx unexpected status.
 */
export type CapabilityOutcome =
  | "allowed"
  | "allowed-truncated"
  | "policy-denied"
  | "error";

export interface CapabilityReceiptInput {
  /** Identifier of the calling agent / route (e.g. "agent.research-fetch"). */
  ruleId: string;
  /** What kind of capability this invocation represents. */
  kind: CapabilityKind;
  /** Outcome of the invocation. */
  outcome: CapabilityOutcome;
  /** Free-form human-readable summary (e.g. "fetched 4.2KB from wikipedia"). */
  summary: string;
  /**
   * Sensitive identifiers — URL, file path, query, secret name. The
   * receipt commits sha256(value) for each. Callers should pre-hash
   * anything they want named separately and pass it via `commitments`
   * instead; this map is a convenience for the common case.
   */
  sensitive?: Record<string, string>;
  /** Already-hashed commitments to merge in (escape hatch). */
  commitments?: Record<string, string>;
  /** Duration of the underlying call in ms. */
  durationMs?: number;
  /** Response size in bytes (for fetch, file-read, db-read). */
  responseBytes?: number;
  /** Policy mode that was active (e.g. "allowlist", "open", "off"). */
  policyMode?: string;
  /** Tenant scope. */
  tenantId?: string;
  /** User scope. */
  userId?: string;
}

export interface CapabilityReceipt {
  schema: typeof CAPABILITY_RECEIPT_SCHEMA;
  ts: string;
  ruleId: string;
  kind: CapabilityKind;
  outcome: CapabilityOutcome;
  summary: string;
  commitments: Record<string, string>;
  durationMs: number | null;
  responseBytes: number | null;
  policyMode: string | null;
  tenantId: string | null;
  userId: string | null;
  /** Base64 ML-DSA-65 signature; null when keys aren't configured. */
  mldsa65Sig: string | null;
  /** True iff post-quantum dual-signing was enabled at emission. */
  pqEnabled: boolean;
}

function sortObject(o: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(o).sort()) {
    out[k] = o[k];
  }
  return out;
}

/** SHA-256 hex of a string. Used for sensitive-identifier commitments. */
export function commit(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Canonicalise a capability receipt for signing. Field order is fixed —
 * any signer producing different ordering produces a different
 * signature, breaking cross-implementation verification.
 */
export function canonicalizeCapabilityReceipt(
  r: Omit<CapabilityReceipt, "mldsa65Sig" | "pqEnabled">,
): string {
  return JSON.stringify({
    schema: r.schema,
    ts: r.ts,
    ruleId: r.ruleId,
    kind: r.kind,
    outcome: r.outcome,
    summary: r.summary,
    commitments: sortObject(r.commitments),
    durationMs: r.durationMs,
    responseBytes: r.responseBytes,
    policyMode: r.policyMode,
    tenantId: r.tenantId,
    userId: r.userId,
  });
}

/**
 * Emit a capability receipt. Best-effort — never throws, never blocks
 * the calling tool. The tool's response to the caller is unchanged;
 * this is the audit trail.
 */
export async function emitCapabilityReceipt(
  input: CapabilityReceiptInput,
): Promise<CapabilityReceipt> {
  // Merge sensitive identifiers into commitments after hashing. Keep
  // the keys the caller provided so audit dashboards can group by
  // semantic identifier name (url, path, query, etc.).
  const merged: Record<string, string> = { ...(input.commitments ?? {}) };
  for (const [k, v] of Object.entries(input.sensitive ?? {})) {
    if (typeof v === "string" && v.length > 0) {
      merged[k] = commit(v);
    }
  }

  const unsigned: Omit<CapabilityReceipt, "mldsa65Sig" | "pqEnabled"> = {
    schema: CAPABILITY_RECEIPT_SCHEMA,
    ts: new Date().toISOString(),
    ruleId: input.ruleId,
    kind: input.kind,
    outcome: input.outcome,
    summary: input.summary,
    commitments: merged,
    durationMs:
      typeof input.durationMs === "number" && Number.isFinite(input.durationMs)
        ? Math.max(0, Math.round(input.durationMs))
        : null,
    responseBytes:
      typeof input.responseBytes === "number" &&
      Number.isFinite(input.responseBytes)
        ? Math.max(0, Math.round(input.responseBytes))
        : null,
    policyMode: input.policyMode ?? null,
    tenantId: input.tenantId ?? null,
    userId: input.userId ?? null,
  };

  const canonical = canonicalizeCapabilityReceipt(unsigned);
  let mldsa65Sig: string | null = null;
  try {
    mldsa65Sig = signMlDsa65(canonical);
  } catch (err) {
    log.warn("capability receipt ML-DSA-65 signing failed", {
      error: String(err),
    });
  }

  const receipt: CapabilityReceipt = {
    ...unsigned,
    mldsa65Sig,
    pqEnabled: isPqDualSignEnabled(),
  };

  try {
    await auditLog({
      userId: receipt.userId ?? "system",
      action: "capability.invoke",
      resource: `${receipt.kind}:${receipt.ruleId}`,
      details: {
        schema: receipt.schema,
        ts: receipt.ts,
        kind: receipt.kind,
        outcome: receipt.outcome,
        summary: receipt.summary,
        commitments: receipt.commitments,
        durationMs: receipt.durationMs,
        responseBytes: receipt.responseBytes,
        policyMode: receipt.policyMode,
        mldsa65Sig: receipt.mldsa65Sig,
        pqEnabled: receipt.pqEnabled,
      },
    });
  } catch (err) {
    log.error("capability receipt audit write failed", { error: String(err) });
  }

  return receipt;
}
