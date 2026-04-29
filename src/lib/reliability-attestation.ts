/**
 * SIGNED RELIABILITY ATTESTATIONS.
 *
 * Round 44 — the "most reliable, provably" round. The platform
 * publishes daily-signed commitments to its OWN reliability claims.
 * Customers verify the commitments offline with the inspector.
 * Sovereign cannot lie about its uptime while the inspector watches.
 *
 * See docs/adr/0009-signed-reliability-attestations.md.
 *
 * THE TRUST LOOP:
 *
 *   platform_health_snapshots (R27) ──┐
 *   audit_logs (R26)                  │  daily compute
 *                                     ▼
 *                          ┌─────────────────────────┐
 *                          │ buildReliability        │
 *                          │ Attestation(...)        │
 *                          │ (PURE FUNCTION)         │
 *                          └────────┬────────────────┘
 *                                   │
 *                                   ▼ Ed25519 sign with platform key
 *                          ┌─────────────────────────┐
 *                          │ reliability_            │
 *                          │ attestations row        │
 *                          └────────┬────────────────┘
 *                                   │
 *                                   ▼ public endpoint
 *                          GET /api/health/reliability/attestation
 *                                   │
 *                                   ▼
 *                          @sovereign/inspector
 *                          reliability-verify <url>
 *                                   │
 *                                   ▼
 *                          ✓ math.match  OR  ✗ FABRICATED
 *
 * Pure-function core. Same Ed25519 + canonical-message pattern as
 * R34 CADC, R37 ACTs, R38 KYA. The verifier code ports verbatim
 * to the inspector for offline verification.
 */

import { createHash } from "node:crypto";
import {
  signMessage,
  verifySignature,
  generateKeyPair,
  toBase64Url,
} from "@/lib/agent-delegation";

// ── Types ──────────────────────────────────────────────────────────

/**
 * Aggregate snapshot of a 24h window of platform health.
 *
 * The daily cron computes this from `platform_health_snapshots`
 * (R27 self-heal cron rows) + audit_logs (R26 chain integrity).
 *
 * The window is always 24h ending at the cron run time. Customers
 * can graph attestations over time to see continuous reliability.
 */
export interface ReliabilityWindow {
  /** UTC ISO 8601. */
  windowStart: string;
  /** UTC ISO 8601. */
  windowEnd: string;
  /** How many self-heal cron snapshots were taken in the window. */
  totalHealthSnapshots: number;
  /** How many of those reported `healthy: true`. */
  passingHealthSnapshots: number;
  /** How many of those reported `healthy: false`. */
  failingHealthSnapshots: number;
  /**
   * Audit chain integrity at the close of the window. `null` when
   * the verifier wasn't run (cron failure → honest unknown).
   */
  auditChainIntact: boolean | null;
  /** Total rows in audit_logs at window close (informational). */
  auditChainTotalRows: number | null;
  /**
   * If the audit chain was broken, the ID of the first broken row.
   * This becomes the "this is what's wrong" pointer for ops.
   */
  auditChainFirstBrokenId: string | null;
  /** Computed uptime percent over the window [0, 100]. */
  uptimePct: number;
  /**
   * Reliability commitment threshold. Default 99.90% — the published
   * SLA. Future round may make this per-tenant for enterprise SLAs.
   */
  commitmentThresholdPct: number;
  /**
   * True iff `uptimePct >= commitmentThresholdPct` AND
   * `auditChainIntact !== false`.
   */
  metCommitment: boolean;
}

export interface SignedAttestation extends ReliabilityWindow {
  /** Canonical message string the signer signed. */
  attestationMessage: string;
  /** Base64URL Ed25519 signature over attestationMessage. */
  attestationSignature: string;
  /** The platform's signing public key (for forward key rotation). */
  platformPublicKey: string;
  /** sha256(prev_chain_hash || message || signature), or null for first row. */
  previousChainHash: string | null;
  chainHash: string;
}

// ── Aggregate computation (pure) ───────────────────────────────────

/**
 * Pure computation of reliability metrics from raw health-snapshot rows.
 *
 * `passingHealthSnapshots / totalHealthSnapshots` is the basic uptime.
 * We tighten this by counting a snapshot as "failing" if it carries
 * any failing checks at all — the cron writes both the boolean and
 * the failing-checks array, so we trust whichever is stricter.
 */
export function computeReliabilityWindow(input: {
  windowStart: Date;
  windowEnd: Date;
  healthSnapshots: Array<{
    healthy: boolean;
    invariantsFailing: number;
  }>;
  auditChainIntact: boolean | null;
  auditChainTotalRows: number | null;
  auditChainFirstBrokenId: string | null;
  commitmentThresholdPct?: number;
}): ReliabilityWindow {
  const total = input.healthSnapshots.length;
  // Strict definition: a snapshot is "passing" iff healthy AND zero failing invariants.
  const passing = input.healthSnapshots.filter(
    (s) => s.healthy && s.invariantsFailing === 0,
  ).length;
  const failing = total - passing;
  const uptimePct = total === 0 ? 100 : (passing / total) * 100;
  const commitmentThresholdPct = input.commitmentThresholdPct ?? 99.9;
  // Chain integrity contributes a hard fail to commitment if it broke.
  const metCommitment =
    uptimePct >= commitmentThresholdPct && input.auditChainIntact !== false;

  return {
    windowStart: input.windowStart.toISOString(),
    windowEnd: input.windowEnd.toISOString(),
    totalHealthSnapshots: total,
    passingHealthSnapshots: passing,
    failingHealthSnapshots: failing,
    auditChainIntact: input.auditChainIntact,
    auditChainTotalRows: input.auditChainTotalRows,
    auditChainFirstBrokenId: input.auditChainFirstBrokenId,
    uptimePct: round2(uptimePct),
    commitmentThresholdPct: round2(commitmentThresholdPct),
    metCommitment,
  };
}

// ── Canonical message construction (pure) ───────────────────────────

/**
 * Build the canonical message string that gets signed.
 *
 * Format (line-separated, deterministic):
 *   v1
 *   reliability-attestation
 *   window:{windowStart}|{windowEnd}
 *   snapshots:{passing}/{total} (failing:{failing})
 *   uptimePct:{uptimePct}
 *   threshold:{commitmentThresholdPct}
 *   metCommitment:{true|false}
 *   auditChainIntact:{true|false|unknown}
 *   auditChainTotalRows:{n|unknown}
 *   auditChainFirstBrokenId:{id|none|unknown}
 *
 * Pure. Same window → same message → same signature.
 */
export function buildAttestationMessage(w: ReliabilityWindow): string {
  return [
    "v1",
    "reliability-attestation",
    `window:${w.windowStart}|${w.windowEnd}`,
    `snapshots:${w.passingHealthSnapshots}/${w.totalHealthSnapshots} (failing:${w.failingHealthSnapshots})`,
    `uptimePct:${w.uptimePct}`,
    `threshold:${w.commitmentThresholdPct}`,
    `metCommitment:${w.metCommitment}`,
    `auditChainIntact:${
      w.auditChainIntact === null ? "unknown" : w.auditChainIntact
    }`,
    `auditChainTotalRows:${w.auditChainTotalRows ?? "unknown"}`,
    `auditChainFirstBrokenId:${w.auditChainFirstBrokenId ?? "none"}`,
  ].join("\n");
}

/**
 * Pure: chain hash for tamper detection.
 * sha256(prev_chain_hash || message || signature).
 */
export function computeAttestationChainHash(input: {
  previousChainHash: string | null;
  attestationMessage: string;
  attestationSignature: string;
}): string {
  return createHash("sha256")
    .update(
      [
        input.previousChainHash ?? "GENESIS",
        input.attestationMessage,
        input.attestationSignature,
      ].join("|"),
    )
    .digest("hex");
}

// ── Sign (impure — needs the platform private key) ─────────────────

/**
 * Sign a reliability window with the platform's private key.
 *
 * Pure with respect to inputs (same window + same key → same signature).
 * Used by the daily cron; the private key never leaves the server.
 */
export function signAttestation(input: {
  window: ReliabilityWindow;
  platformPrivateKey: string;
  platformPublicKey: string;
  previousChainHash: string | null;
}): SignedAttestation {
  const message = buildAttestationMessage(input.window);
  const signature = signMessage(input.platformPrivateKey, message);
  const chainHash = computeAttestationChainHash({
    previousChainHash: input.previousChainHash,
    attestationMessage: message,
    attestationSignature: signature,
  });
  return {
    ...input.window,
    attestationMessage: message,
    attestationSignature: signature,
    platformPublicKey: input.platformPublicKey,
    previousChainHash: input.previousChainHash,
    chainHash,
  };
}

// ── Verify (the trustless-loop closure) ─────────────────────────────

/**
 * Verify a signed attestation. Pure function. Used both server-side
 * (sanity check after sign) and ported to @sovereign/inspector for
 * offline customer verification.
 *
 * Checks (in order):
 *   1. The reconstructed canonical message matches the signed message.
 *   2. The signature is valid against the platform public key.
 *   3. The chain hash matches recompute.
 *   4. (Caller-supplied) the platform public key matches the
 *      currently-published key.
 */
export function verifyAttestation(input: {
  attestation: SignedAttestation;
  expectedPlatformPublicKey?: string;
}):
  | { valid: true }
  | { valid: false; reason: string } {
  const a = input.attestation;

  // 1. Canonical message reconstruction.
  const expectedMessage = buildAttestationMessage({
    windowStart: a.windowStart,
    windowEnd: a.windowEnd,
    totalHealthSnapshots: a.totalHealthSnapshots,
    passingHealthSnapshots: a.passingHealthSnapshots,
    failingHealthSnapshots: a.failingHealthSnapshots,
    auditChainIntact: a.auditChainIntact,
    auditChainTotalRows: a.auditChainTotalRows,
    auditChainFirstBrokenId: a.auditChainFirstBrokenId,
    uptimePct: a.uptimePct,
    commitmentThresholdPct: a.commitmentThresholdPct,
    metCommitment: a.metCommitment,
  });
  if (a.attestationMessage !== expectedMessage) {
    return { valid: false, reason: "attestation_message_mismatch" };
  }

  // 2. Signature verification.
  if (
    !verifySignature(
      a.platformPublicKey,
      a.attestationMessage,
      a.attestationSignature,
    )
  ) {
    return { valid: false, reason: "signature_invalid" };
  }

  // 3. Chain hash recompute.
  const expectedChainHash = computeAttestationChainHash({
    previousChainHash: a.previousChainHash,
    attestationMessage: a.attestationMessage,
    attestationSignature: a.attestationSignature,
  });
  if (a.chainHash !== expectedChainHash) {
    return { valid: false, reason: "chain_hash_mismatch" };
  }

  // 4. Optional: caller asserts the expected public key.
  if (
    input.expectedPlatformPublicKey &&
    a.platformPublicKey !== input.expectedPlatformPublicKey
  ) {
    return { valid: false, reason: "platform_pubkey_mismatch" };
  }

  return { valid: true };
}

/**
 * Verify a chain of attestations. Each row's previousChainHash must
 * equal the previous row's chainHash. Tampering with any past row
 * breaks every subsequent chain hash.
 */
export function verifyAttestationChain(input: {
  attestations: SignedAttestation[];
  expectedPlatformPublicKey?: string;
}):
  | { valid: true; rowsVerified: number }
  | { valid: false; reason: string; index: number } {
  if (input.attestations.length === 0) {
    return { valid: true, rowsVerified: 0 };
  }
  let prev: string | null = null;
  for (let i = 0; i < input.attestations.length; i++) {
    const a = input.attestations[i];
    if (i === 0) {
      if (a.previousChainHash !== null) {
        return { valid: false, reason: "first_has_parent", index: 0 };
      }
    } else {
      if (a.previousChainHash !== prev) {
        return { valid: false, reason: "previous_hash_mismatch", index: i };
      }
    }
    const result = verifyAttestation({
      attestation: a,
      expectedPlatformPublicKey: input.expectedPlatformPublicKey,
    });
    if (!result.valid) {
      return { valid: false, reason: result.reason, index: i };
    }
    prev = a.chainHash;
  }
  return { valid: true, rowsVerified: input.attestations.length };
}

// ── Master signing key management ───────────────────────────────────

/**
 * Get (or generate) the platform's master Ed25519 signing key.
 *
 * Resolution order:
 *   1. SOVEREIGN_PLATFORM_PRIVATE_KEY env var (production)
 *   2. Cached pair (boot-time generated, dev only)
 *
 * In production, the operator MUST set
 * SOVEREIGN_PLATFORM_PRIVATE_KEY (Base64URL Ed25519 private key)
 * and SOVEREIGN_PLATFORM_PUBLIC_KEY (Base64URL Ed25519 public key)
 * for the attestation chain to be reproducible across deploys.
 *
 * Generate once with:
 *   openssl genpkey -algorithm Ed25519 -out platform-key.pem
 *   # …or use generateKeyPair() once and copy the strings.
 */
let cachedDevKeyPair: { privateKey: string; publicKey: string } | null = null;

export function getPlatformSigningKey(): {
  privateKey: string;
  publicKey: string;
  source: "env" | "cached_dev";
} {
  const envPriv = process.env.SOVEREIGN_PLATFORM_PRIVATE_KEY;
  const envPub = process.env.SOVEREIGN_PLATFORM_PUBLIC_KEY;
  if (envPriv && envPub) {
    return { privateKey: envPriv, publicKey: envPub, source: "env" };
  }
  if (!cachedDevKeyPair) {
    const kp = generateKeyPair();
    cachedDevKeyPair = {
      privateKey: kp.privateKey,
      publicKey: kp.publicKey,
    };
  }
  return { ...cachedDevKeyPair, source: "cached_dev" };
}

// ── Helpers ────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Reference helper for forward-compat tests; not part of public API.
export const _internal = { toBase64Url };
