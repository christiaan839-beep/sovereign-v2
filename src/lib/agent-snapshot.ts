import { getReplay, type ReplayTrace } from "@/lib/agent-replay";

/**
 * AGENT SNAPSHOT — a deterministic, portable record of a single agent
 * invocation. The "black box recorder" that regulated industries
 * (legal, healthcare, financial services) need to answer:
 *
 *   - "Show me exactly what the AI saw and output for this decision."
 *   - "Re-run the same inputs through a different model and show me
 *      the difference." (reproducibility for incident review)
 *   - "Export this to a different tenant for a regulator's offline
 *      audit." (no vendor lock-in on the audit trail)
 *
 * Format version: snapshot-v1
 *
 * The snapshot is a PURE DATA document — no runtime references, no
 * database IDs that only make sense in our tenant. It can be:
 *   - Stored in Glacier for 7+ year retention
 *   - Emailed to the customer's auditor
 *   - Diffed against another snapshot for a regression investigation
 *   - Re-run via POST /api/_replay/import to reproduce behavior
 *
 * What's in it:
 *   - Request context (requestId, agentName, timestamp)
 *   - Input as submitted (sanitized — PII caller's call)
 *   - Every ReplayTrace step with phase + data
 *   - Models consulted + providers (from model-attribution.ts)
 *   - Token + cost ledger entry (from cost-ledger.ts)
 *   - Output (full)
 *   - Checksum of the whole snapshot (SHA-256) so tampering is detectable
 *
 * What's NOT in it:
 *   - Other tenants' data (by construction — scoped to requestId)
 *   - Our environment secrets / API keys (never logged in replay)
 *   - Customer's OTHER runs (only this one)
 *
 * The snapshot format is intentionally verbose (JSON with full keys)
 * rather than compressed — human-readability is a feature for auditors.
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// Format discriminator — always the LATEST version we emit.
// Legacy v1 snapshots continue to verify (integrity only); new exports
// are v2 (integrity + provenance via HMAC).
export const SNAPSHOT_VERSION = "snapshot-v2";
export const SNAPSHOT_VERSION_V1 = "snapshot-v1";

/**
 * v1 interface preserved so legacy consumers + tests continue to work.
 * New exports use AgentSnapshotV2 below, which adds a `signature` field.
 */
export interface AgentSnapshotV1 {
  /** Format discriminator — legacy v1 uses "snapshot-v1". */
  version: typeof SNAPSHOT_VERSION | typeof SNAPSHOT_VERSION_V1;
  /** UUID-like identifier stable across exports/imports. */
  id: string;
  /** When the agent run started (ISO 8601 UTC). */
  runStartedAt: string;
  /** How long the run took, wall-clock ms. */
  runDurationMs: number;

  /** Which agent + request this snapshot represents. */
  request: {
    requestId: string;
    agentName: string;
    path?: string;
    /** Clerk user ID hashed (not raw — for GDPR pseudonymization
     *  requirement under Art. 4(5)). Auditors never need the real ID. */
    userIdHash?: string;
  };

  /** The input as the agent received it (post-sanitization). */
  input: Record<string, unknown>;

  /** Replay trace steps (safety → handler → quality → final). */
  trace: Array<{
    phase: string;
    timestamp: string;
    durationMs?: number;
    data: Record<string, unknown>;
  }>;

  /** Every model identifier consulted during the run. */
  modelsConsulted: string[];

  /** Provider buckets (anthropic / nvidia-nim / google / ...). */
  providersConsulted: string[];

  /** Token + cost data from the ledger (partial — pre-0012 rows omit). */
  economics?: {
    rateCardVersion: string;
    inputTokens?: number;
    outputTokens?: number;
    costCents?: number;
  };

  /** Final output payload returned to the caller. */
  output: Record<string, unknown>;

  /** Verification result from the consensus engine, if engaged. */
  verification?: {
    status: "passed" | "failed" | "skipped";
    qualityScore?: number;
    piiDetected?: boolean;
    safetyChecks?: Record<string, boolean>;
  };

  /** SHA-256 hex of the canonical JSON of the snapshot minus this
   *  field — tampering is detectable by recomputing. */
  checksum?: string;

  /**
   * HMAC-SHA256 of the canonical JSON of the snapshot minus both the
   * `signature` and `signatureKeyId` fields. Only present on v2 snapshots.
   * Proves the snapshot was produced by a party holding the signing key
   * (i.e., Sovereign Matrix's production environment).
   *
   * Verification requires the same key — customers can request the
   * current public key identifier from `/.well-known/snapshot-signing`
   * and verify via our `/api/_replay/verify` endpoint without needing
   * the raw key.
   */
  signature?: string;

  /**
   * Identifier for the key used to sign this snapshot. We rotate keys
   * quarterly; historical snapshots reference the key ID they were
   * signed with so they continue to verify after rotation.
   * Format: "smx-sig-YYYY-QN" (e.g., "smx-sig-2026-q2").
   */
  signatureKeyId?: string;
}

/**
 * Build a snapshot from an in-memory replay trace. The caller (typically
 * the agent-factory) has all the pieces already; this just assembles
 * them into the portable format.
 *
 * We hash the userId (SHA-256 first 16 hex chars = 64 bits, enough
 * collision resistance for audit correlation, not enough to re-identify).
 */
export function buildSnapshot(params: {
  trace: ReplayTrace;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  modelsConsulted: string[];
  providersConsulted: string[];
  economics?: AgentSnapshotV1["economics"];
  verification?: AgentSnapshotV1["verification"];
  path?: string;
}): AgentSnapshotV1 {
  const userIdHash = params.trace.userId
    ? createHash("sha256")
        .update(params.trace.userId)
        .digest("hex")
        .slice(0, 16)
    : undefined;

  const snapshot: AgentSnapshotV1 = {
    version: SNAPSHOT_VERSION,
    id: params.trace.id,
    runStartedAt: new Date(params.trace.startedAt).toISOString(),
    runDurationMs: (params.trace.completedAt ?? Date.now()) - params.trace.startedAt,
    request: {
      requestId: params.trace.id,
      agentName: params.trace.agentName,
      path: params.path,
      userIdHash,
    },
    input: params.input,
    trace: params.trace.steps.map((s) => ({
      phase: s.phase,
      timestamp: new Date(s.timestamp).toISOString(),
      durationMs: s.durationMs,
      data: s.data,
    })),
    modelsConsulted: params.modelsConsulted,
    providersConsulted: params.providersConsulted,
    economics: params.economics,
    output: params.output,
    verification: params.verification,
  };

  // Compute + embed checksum last (so it can verify the rest).
  snapshot.checksum = computeChecksum(snapshot);

  // v2 — sign with the current HMAC key if one is configured. Snapshots
  // without a key simply stay as v1-equivalent (integrity only; checksum
  // field present, signature absent). We DON'T downgrade the version
  // discriminator — v2 with a missing signature still says v2 so the
  // verifier can differentiate "unsigned" from "legacy v1".
  const key = getSnapshotSigningKey();
  if (key) {
    snapshot.signatureKeyId = getSnapshotKeyId();
    snapshot.signature = computeSignature(snapshot, key);
  }

  return snapshot;
}

/**
 * Read the HMAC signing key from the environment. `SNAPSHOT_SIGNING_KEY`
 * should be a base64-encoded 32-byte secret generated via:
 *
 *   node -e 'console.log(require("crypto").randomBytes(32).toString("base64"))'
 *
 * and stored in Vercel env. We rotate quarterly; the key ID format
 * encodes the rotation cycle so historical snapshots continue to verify.
 *
 * Missing key → signatures are skipped (graceful degrade to v1-equivalent).
 * Dev environments without the key still produce valid snapshots; only
 * production-signed snapshots carry provenance.
 */
function getSnapshotSigningKey(): Buffer | null {
  const raw = process.env.SNAPSHOT_SIGNING_KEY;
  if (!raw) return null;
  try {
    const buf = Buffer.from(raw, "base64");
    // Reject obviously-weak keys. 16 bytes is the floor for HMAC-SHA256.
    if (buf.length < 16) return null;
    return buf;
  } catch {
    return null;
  }
}

function getSnapshotKeyId(): string {
  // Allow explicit override for rotation tracking; fall back to a
  // quarter-stamp so operators don't need to bump the env var unless
  // they rotate keys.
  const override = process.env.SNAPSHOT_SIGNING_KEY_ID;
  if (override) return override;
  const d = new Date();
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return `smx-sig-${d.getUTCFullYear()}-q${q}`;
}

/**
 * HMAC-SHA256 over the canonical JSON of the snapshot with BOTH the
 * `signature` AND `signatureKeyId` fields stripped (since those are
 * the output of this computation).
 */
function computeSignature(snapshot: AgentSnapshotV1, key: Buffer): string {
  // Strip-both variant — different from computeChecksum which only
  // strips `checksum`. This ensures the signature covers the checksum
  // (so tampering the checksum field is also detected).
  const { signature: _s, signatureKeyId: _k, ...rest } = snapshot;
  void _s;
  void _k;
  return createHmac("sha256", key).update(canonicalJSON(rest)).digest("hex");
}

/**
 * Canonicalize a snapshot for checksumming or equality comparison.
 * Sorts keys so JSON.stringify is deterministic across JS engines.
 */
function canonicalJSON(obj: unknown): string {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return `[${obj.map(canonicalJSON).join(",")}]`;
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${canonicalJSON((obj as Record<string, unknown>)[k])}`)
    .join(",")}}`;
}

/**
 * Compute the SHA-256 checksum of a snapshot, excluding the checksum,
 * signature, and signatureKeyId fields. We strip all three because:
 *   - `checksum` is what we're computing (can't include itself)
 *   - `signature` + `signatureKeyId` are computed AFTER the checksum
 *     in buildSnapshot, so they weren't present when checksum was
 *     produced. Including them here would make round-trip verification
 *     fail for every v2 snapshot.
 *
 * Running this on a verified snapshot should produce the value stored
 * in `snapshot.checksum`.
 */
export function computeChecksum(snapshot: AgentSnapshotV1): string {
  const {
    checksum: _drop,
    signature: _sig,
    signatureKeyId: _kid,
    ...rest
  } = snapshot;
  void _drop;
  void _sig;
  void _kid;
  return createHash("sha256").update(canonicalJSON(rest)).digest("hex");
}

/**
 * Verify the integrity + (optionally) authenticity of a snapshot.
 *
 * Returns:
 *   { valid: true, integrity: "verified", provenance: "verified" | "unsigned" | "skipped" }
 *   { valid: false, reason: <see list> }
 *
 * Failure reasons:
 *   - wrong_version          — format version we don't recognize
 *   - missing_checksum       — v1/v2 MUST include a checksum
 *   - checksum_mismatch      — tampering; integrity failed
 *   - signature_mismatch     — v2 signature doesn't match; provenance failed
 *   - missing_signature_key  — snapshot claims to be signed but we have
 *                              no key configured to verify it
 *   - unknown_key_id         — snapshot was signed by a key we don't have
 *                              (historical rotation; see ops runbook)
 *
 * Note: a v2 snapshot without a signature is NOT invalid — it just has
 * "integrity: verified, provenance: unsigned" which is what you'd get
 * in a dev environment or if the key wasn't configured at export time.
 */
export function verifySnapshot(snapshot: AgentSnapshotV1): {
  valid: boolean;
  reason?: string;
  integrity?: "verified";
  provenance?: "verified" | "unsigned" | "skipped";
  keyId?: string;
} {
  if (
    snapshot.version !== SNAPSHOT_VERSION &&
    snapshot.version !== SNAPSHOT_VERSION_V1
  ) {
    return { valid: false, reason: "wrong_version" };
  }
  if (!snapshot.checksum) {
    return { valid: false, reason: "missing_checksum" };
  }
  const expected = computeChecksum(snapshot);
  if (expected !== snapshot.checksum) {
    return { valid: false, reason: "checksum_mismatch" };
  }

  // Integrity passed. Check signature if present (v2 only).
  if (!snapshot.signature) {
    return { valid: true, integrity: "verified", provenance: "unsigned" };
  }

  const key = getSnapshotSigningKey();
  if (!key) {
    // Snapshot claims to be signed but we can't verify — don't lie.
    return {
      valid: false,
      reason: "missing_signature_key",
      integrity: "verified",
    };
  }

  // Check key ID matches our current key — otherwise the operator
  // needs to look up the historical key from rotation records.
  if (snapshot.signatureKeyId && snapshot.signatureKeyId !== getSnapshotKeyId()) {
    return {
      valid: false,
      reason: "unknown_key_id",
      integrity: "verified",
      keyId: snapshot.signatureKeyId,
    };
  }

  const expectedSig = computeSignature(snapshot, key);
  // Constant-time comparison — prevents signature-guessing via timing.
  const a = Buffer.from(expectedSig, "hex");
  const b = Buffer.from(snapshot.signature, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { valid: false, reason: "signature_mismatch", integrity: "verified" };
  }

  return {
    valid: true,
    integrity: "verified",
    provenance: "verified",
    keyId: snapshot.signatureKeyId,
  };
}

/**
 * Fetch a snapshot by replay ID. Convenience wrapper around getReplay
 * that assembles the snapshot from current in-memory state. In
 * production, this would also pull from the DB-backed replay store.
 */
export function getSnapshotById(
  replayId: string,
  extras: {
    input: Record<string, unknown>;
    output: Record<string, unknown>;
    modelsConsulted: string[];
    providersConsulted: string[];
    economics?: AgentSnapshotV1["economics"];
    verification?: AgentSnapshotV1["verification"];
    path?: string;
  },
): AgentSnapshotV1 | null {
  const trace = getReplay(replayId);
  if (!trace) return null;
  return buildSnapshot({ trace, ...extras });
}
