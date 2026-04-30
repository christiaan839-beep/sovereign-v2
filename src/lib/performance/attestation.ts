/**
 * BENCHMARK ATTESTATION — composes with R44 reliability-attestation.
 *
 * Pure-function builder for the canonical signing message that wraps
 * a `BenchmarkResult` into a procurement-grade signed artifact. The
 * runtime adapter signs with R44's `getPlatformSigningKey()` and
 * appends the result to the R26 audit chain.
 *
 * Why this matters: the dashboard refuses to claim a score without
 * a measurement. Signed attestations go further — they let a third
 * party RE-VERIFY the claim offline, with no Sovereign network call
 * required. Same trust loop as R44 reliability-attestation:
 *
 *   BenchmarkResult ──► buildBenchmarkAttestationMessage(...)
 *                              │
 *                              ▼ Ed25519 sign with platform key (R44)
 *                       SignedBenchmarkAttestation
 *                              │
 *                              ▼ public endpoint
 *                       GET /api/health/benchmark/<targetId>
 *                              │
 *                              ▼
 *                       @sovereign/inspector
 *                       benchmark-verify <url> <targetId>
 */

import { createHash } from "node:crypto";
import type { BenchmarkResult } from "./benchmark-results";
import type { PerformanceTarget } from "./targets";

// ── Canonical message builder ────────────────────────────────────

export interface BenchmarkAttestationInputs {
  target: PerformanceTarget;
  result: BenchmarkResult;
  /** ISO 8601 — when the attestation is being built. */
  attestedAt: string;
}

/**
 * Pure: build the canonical signing message. Same line-separated
 * format as R34 CADC, R37 ACT, R38 KYA, R44 reliability — verifiers
 * reconstruct from the same fields to compare.
 */
export function buildBenchmarkAttestationMessage(
  input: BenchmarkAttestationInputs,
): string {
  const { target, result, attestedAt } = input;
  const sourceHash = createHash("sha256")
    .update(
      [
        result.source.harnessCommit,
        result.source.datasetVersion,
        result.source.modelId,
        result.source.envNotes ?? "",
      ].join("|"),
    )
    .digest("hex");
  return [
    "v1",
    "benchmark-attestation",
    `targetId:${target.id}`,
    `targetValue:${target.targetValue}`,
    `targetDirection:${target.direction}`,
    `verificationKind:${target.verificationKind}`,
    `measuredValue:${result.measuredValue}`,
    `measuredAt:${result.measuredAt}`,
    `runHash:${result.runHash}`,
    `sourceHash:${sourceHash}`,
    `attestedAt:${attestedAt}`,
  ].join("\n");
}

// ── Chain hash for the audit trail ──────────────────────────────

/**
 * Pure: produce sha256(prevChainHash || message || signature) so
 * tampering with any past benchmark attestation breaks every
 * subsequent chain hash. Same pattern as R26 / R37 / R44.
 */
export function computeAttestationChainHash(input: {
  parentChainHash: string | null;
  message: string;
  signature: string;
}): string {
  return createHash("sha256")
    .update(
      [
        input.parentChainHash ?? "GENESIS",
        input.message,
        input.signature,
      ].join("|"),
    )
    .digest("hex");
}

// ── Signed attestation shape ───────────────────────────────────

/**
 * The on-the-wire shape of a signed benchmark attestation. Same
 * structural pattern as R44 SignedAttestation.
 */
export interface SignedBenchmarkAttestation {
  /** v1 — bumps on protocol changes. */
  version: "v1";
  /** Echo of inputs for self-contained verification. */
  targetId: string;
  targetValue: number;
  targetDirection: PerformanceTarget["direction"];
  verificationKind: PerformanceTarget["verificationKind"];
  measuredValue: number;
  measuredAt: string;
  runHash: string;
  /** sha256 of (commit || dataset || modelId || envNotes). */
  sourceHash: string;
  attestedAt: string;
  /** The canonical message that was signed. */
  message: string;
  /** base64url Ed25519 signature over `message`. */
  signature: string;
  /** sha256 chain hash binding to parent (or GENESIS). */
  parentChainHash: string | null;
  chainHash: string;
  /** base64url Ed25519 platform public key (so verifiers don't need
   *  a separate fetch). */
  platformPublicKey: string;
}

/**
 * Pure: assemble a SignedBenchmarkAttestation from the inputs +
 * caller-supplied signature + chain link. The runtime adapter
 * (impure — calls R44's signMessage) provides the signature.
 */
export function buildSignedAttestation(input: {
  target: PerformanceTarget;
  result: BenchmarkResult;
  attestedAt: string;
  message: string;
  signature: string;
  parentChainHash: string | null;
  platformPublicKey: string;
}): SignedBenchmarkAttestation {
  const { target, result } = input;
  const sourceHash = createHash("sha256")
    .update(
      [
        result.source.harnessCommit,
        result.source.datasetVersion,
        result.source.modelId,
        result.source.envNotes ?? "",
      ].join("|"),
    )
    .digest("hex");
  const chainHash = computeAttestationChainHash({
    parentChainHash: input.parentChainHash,
    message: input.message,
    signature: input.signature,
  });
  return {
    version: "v1",
    targetId: target.id,
    targetValue: target.targetValue,
    targetDirection: target.direction,
    verificationKind: target.verificationKind,
    measuredValue: result.measuredValue,
    measuredAt: result.measuredAt,
    runHash: result.runHash,
    sourceHash,
    attestedAt: input.attestedAt,
    message: input.message,
    signature: input.signature,
    parentChainHash: input.parentChainHash,
    chainHash,
    platformPublicKey: input.platformPublicKey,
  };
}

// ── Pure: receipt summary for R26 audit chain ───────────────────

/**
 * Pure: produce a procurement-readable receipt line that gets
 * appended to the R26 audit chain alongside the signed attestation.
 */
export function summarizeAttestationForReceipt(
  att: SignedBenchmarkAttestation,
): string {
  return [
    `BENCHMARK ATTESTATION v1 — target ${att.targetId}`,
    `  measured ${att.measuredValue} ${att.targetDirection === "higher-is-better" ? "≥" : "≤"} ${att.targetValue} (target)`,
    `  verification: ${att.verificationKind}`,
    `  measured at: ${att.measuredAt}`,
    `  run hash: ${att.runHash.slice(0, 16)}...`,
    `  source hash: ${att.sourceHash.slice(0, 16)}...`,
    `  chain hash: ${att.chainHash.slice(0, 16)}...`,
  ].join("\n");
}
