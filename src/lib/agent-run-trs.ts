/**
 * SOVEREIGN MATRIX — Wire threshold signatures onto persisted agent runs.
 *
 * Additive layer over `recordRun` in src/lib/agent-runs.ts. The single-
 * signer v2 receipt is unchanged — every existing verifier continues
 * to work exactly as before. When the operator configures
 * THRESHOLD_ISSUERS, this module ALSO signs the canonical bytes under
 * the m-of-n threshold scheme and persists the attestation as an
 * `audit_logs` row with action `trs.attestation`.
 *
 * Why additive instead of replacing the existing signature:
 *   - Backwards compatibility: single-signer verifiers continue to
 *     accept receipts they could verify yesterday. No fleet-wide
 *     upgrade required.
 *   - Honesty: if the threshold attestation fails (key missing,
 *     external witness offline), the receipt itself is still
 *     persisted + verifiable. Threshold is a strengthening of the
 *     trust model, not a precondition for receipt creation.
 *   - Risk minimisation: this hot path is the audit-evidence write
 *     for every agent run on the platform. A bug here corrupts
 *     compliance evidence; additive design lets us roll out + roll
 *     back the threshold layer without touching the receipt path.
 *
 * Threshold-aware verifiers fetch:
 *   1. The v2 receipt from /api/agent-runs/[id]   (single-signer)
 *   2. The TRS attestation from
 *      /api/transparency/trs/[receiptId]          (m-of-n)
 * and verify both bind to the same canonical bytes.
 */

import { auditLog } from "@/lib/audit-log";
import { signThreshold, isThresholdEnabled } from "@/lib/threshold-signer";
import { createLogger } from "@/lib/logger";

const log = createLogger("agent-run-trs");

export interface PersistTrsResult {
  /** True iff TRS was enabled AND an attestation was produced. */
  persisted: boolean;
  /** True iff the m-of-n quorum was met at persist time. */
  quorumMet: boolean;
  /** Issuer ids whose signatures came from local keys on this server. */
  localContributions: string[];
}

/**
 * Sign + persist a TRS attestation for the given canonical bytes,
 * binding it to the receipt id. Fire-and-forget contract:
 *   - Never throws (errors are logged + swallowed).
 *   - Never blocks the caller (caller decides whether to await).
 *   - Returns a structured result so observability surfaces can
 *     report "this run was threshold-signed" / "quorum not yet met".
 *
 * The `details` row stored in audit_logs contains:
 *   - schema: "trs1"
 *   - receiptId (foreign key into agent_runs)
 *   - canonicalHash (sha256 — proves binding to the same canonical
 *     bytes the v2 receipt covers)
 *   - attestation (the full envelope: m/n, authorisedIssuers,
 *     cosigners[], assembledAt)
 *   - quorumMet (boolean — verifier hint)
 *   - localContributions (issuer ids this server signed for)
 */
export async function persistRunTrsAttestation(args: {
  receiptId: string;
  canonical: string;
  tenantId?: string | null;
}): Promise<PersistTrsResult> {
  if (!isThresholdEnabled()) {
    return { persisted: false, quorumMet: false, localContributions: [] };
  }

  let signResult: ReturnType<typeof signThreshold>;
  try {
    signResult = signThreshold(args.canonical);
  } catch (err) {
    log.error("threshold sign failed for agent run", {
      receiptId: args.receiptId,
      error: String(err),
    });
    return { persisted: false, quorumMet: false, localContributions: [] };
  }

  if (!signResult) {
    // isThresholdEnabled passed but signThreshold returned null —
    // most likely a race where env was unset between the two calls.
    return { persisted: false, quorumMet: false, localContributions: [] };
  }

  try {
    await auditLog({
      // Audit rows are keyed by userId; for threshold attestations the
      // emitter is the platform, not a specific user.
      userId: "system",
      action: "trs.attestation",
      resource: `agent_run:${args.receiptId}`,
      details: {
        schema: "trs1",
        receiptId: args.receiptId,
        canonicalHash: signResult.attestation.contentHash,
        attestation: signResult.attestation,
        quorumMet: signResult.quorumMet,
        localContributions: signResult.localContributions,
        tenantId: args.tenantId ?? null,
      },
    });
  } catch (err) {
    log.error("TRS attestation audit write failed", {
      receiptId: args.receiptId,
      error: String(err),
    });
    return {
      persisted: false,
      quorumMet: signResult.quorumMet,
      localContributions: signResult.localContributions,
    };
  }

  return {
    persisted: true,
    quorumMet: signResult.quorumMet,
    localContributions: signResult.localContributions,
  };
}
