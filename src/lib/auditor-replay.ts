/**
 * SOVEREIGN MATRIX — Auditor Replay (audit-2026-05 elite-tier feature).
 *
 * Given a receipt id, reconstruct the byte-identical canonical projection
 * the original run was signed over, verify both signatures match, and
 * issue a "replay attestation" — a fresh signature over the canonical
 * that proves an auditor independently re-derived the same bytes from
 * the stored row.
 *
 * Threat model addressed:
 *   - Operator silently swaps stored input/output after the fact.
 *     The replay re-computes the canonical from the row and compares
 *     its signature to the stored one. Any mutation → mismatch.
 *   - Receipt is a forgery (signed by someone with the secret but the
 *     row doesn't actually exist). Replay attempts to fetch by id, so
 *     no row → no replay, no replay attestation.
 *
 * NOT addressed (separate primitives):
 *   - Operator deletes the row entirely (covered by hash-chained audit
 *     logs in src/lib/audit-log-integrity.ts).
 *   - Pre-quantum signing-key compromise on long-retention receipts
 *     (covered by ML-DSA-65 dual-signing in src/lib/pq-sign.ts).
 *
 * This module is read-only on agent_runs — it never writes. The replay
 * attestation is computed in-memory and returned to the caller, who can
 * forward it to their auditor workpaper system.
 */

import { createHash } from "crypto";
import {
  canonicalizeRun,
  signRun,
  verifySignature,
  type AgentRunRecord,
} from "@/lib/agent-runs";
import { getRun } from "@/lib/agent-runs";

export type ReplayStatus =
  /** Stored signature reproduces under re-derived canonical. */
  | "ok"
  /** Receipt id resolved but the stored signature doesn't verify
   *  against the recomputed canonical — STORAGE TAMPERED. */
  | "tampered"
  /** Receipt id has no row in agent_runs — never existed or pruned. */
  | "not-found"
  /** Stored row exists but the signature column is empty — historical
   *  unsigned run, replay is informational only. */
  | "unsigned"
  /** Configured signing scheme is the disabled "no key set" path — we
   *  can rebuild canonical bytes but can't issue a replay attestation. */
  | "no-key";

export interface ReplayResult {
  status: ReplayStatus;
  /** The original signature stored on the row (when one existed). */
  storedSignature: string | null;
  /** Canonical projection re-derived from the row at replay time. */
  canonical: string | null;
  /** SHA-256 of the recomputed canonical, for hand-comparison. */
  canonicalHash: string | null;
  /** Original signature verifies under recomputed canonical? */
  signatureVerified: boolean;
  /** Fresh signature an auditor can include in their workpaper.
   *  Empty string when status is `not-found` or `no-key`. */
  replayAttestation: string;
  /** Timestamp the replay was performed. */
  replayedAt: string;
  /** The actual run row — only included when status is "ok" / "tampered"
   *  / "unsigned" so the auditor can see what was reconstructed. */
  run: AgentRunRecord | null;
}

/**
 * Reconstruct an agent run by receipt id and verify it cryptographically.
 *
 * Returns a `ReplayResult` the caller can present to an auditor or pipe
 * into a workpaper system. Best-effort across every failure mode — never
 * throws (the absence of a row is a status, not an exception).
 */
export async function replayReceipt(receiptId: string): Promise<ReplayResult> {
  const replayedAt = new Date().toISOString();

  const run = await getRun(receiptId).catch(() => null);
  if (!run) {
    return {
      status: "not-found",
      storedSignature: null,
      canonical: null,
      canonicalHash: null,
      signatureVerified: false,
      replayAttestation: "",
      replayedAt,
      run: null,
    };
  }

  // Re-derive the canonical from the row. canonicalizeRun walks every
  // field deterministically — same inputs → same bytes, byte-for-byte.
  const canonical = canonicalizeRun({
    id: run.id,
    agentName: run.agentName,
    modelUsed: run.modelUsed,
    input: run.input,
    output: run.output,
    safetyResult: run.safetyResult,
    durationMs: run.durationMs,
    createdAt: run.createdAt,
  });
  const canonicalHash = createHash("sha256").update(canonical).digest("hex");

  // No signature stored: historical / migrated row before signing was wired.
  const storedSignature = run.signature ?? null;
  if (!storedSignature || storedSignature === "unsigned") {
    const attestation = signRun(canonical);
    return {
      status: "unsigned",
      storedSignature,
      canonical,
      canonicalHash,
      signatureVerified: false,
      replayAttestation: attestation === "unsigned" ? "" : attestation,
      replayedAt,
      run,
    };
  }

  // The verifier accepts both v1 (HMAC) and v2 (Ed25519) wire formats.
  const verified = verifySignature(canonical, storedSignature);

  // Always issue an attestation when we have keys, even on tamper — the
  // attestation proves WE saw these bytes at replay time, regardless of
  // whether the stored sig matches.
  const attestation = signRun(canonical);
  if (attestation === "unsigned") {
    return {
      status: "no-key",
      storedSignature,
      canonical,
      canonicalHash,
      signatureVerified: verified,
      replayAttestation: "",
      replayedAt,
      run,
    };
  }

  return {
    status: verified ? "ok" : "tampered",
    storedSignature,
    canonical,
    canonicalHash,
    signatureVerified: verified,
    replayAttestation: attestation,
    replayedAt,
    run,
  };
}

/**
 * Compact summary suitable for embedding in an auditor's workpaper PDF.
 * Pure formatter — no I/O. Returns multi-line plain text.
 */
export function formatReplayWorkpaper(r: ReplayResult): string {
  const lines = [
    `SOVEREIGN MATRIX — Replay Attestation`,
    `Replayed at: ${r.replayedAt}`,
    ``,
    `Status: ${r.status.toUpperCase()}`,
  ];

  if (r.run) {
    lines.push(
      ``,
      `Receipt id:    ${r.run.id}`,
      `Agent:         ${r.run.agentName}`,
      `Model:         ${r.run.modelUsed}`,
      `Issued at:     ${
        r.run.createdAt instanceof Date
          ? r.run.createdAt.toISOString()
          : r.run.createdAt
      }`,
      `Duration (ms): ${r.run.durationMs}`,
    );
  }

  if (r.canonicalHash) {
    lines.push(``, `SHA-256 of recomputed canonical:`, `  ${r.canonicalHash}`);
  }

  if (r.storedSignature) {
    lines.push(``, `Stored signature:`, `  ${r.storedSignature}`);
  }

  if (r.replayAttestation) {
    lines.push(``, `Replay attestation:`, `  ${r.replayAttestation}`);
  }

  lines.push(
    ``,
    `Signature verifies under recomputed canonical: ${r.signatureVerified ? "YES" : "NO"}`,
  );

  if (r.status === "tampered") {
    lines.push(
      ``,
      `WARNING: the stored signature does not validate over the canonical`,
      `projection re-derived from the row. This indicates the input,`,
      `output, model, duration, or createdAt field has been mutated since`,
      `the receipt was issued. The row should be treated as untrusted.`,
    );
  }

  return lines.join("\n");
}
