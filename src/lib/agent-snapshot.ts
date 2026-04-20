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

import { createHash } from "node:crypto";

export const SNAPSHOT_VERSION = "snapshot-v1";

export interface AgentSnapshotV1 {
  /** Format discriminator; bump when the schema changes. */
  version: typeof SNAPSHOT_VERSION;
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
  return snapshot;
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
 * Compute the SHA-256 checksum of a snapshot, excluding the checksum
 * field itself. Running this on a verified snapshot should produce
 * the value stored in `snapshot.checksum`.
 */
export function computeChecksum(snapshot: AgentSnapshotV1): string {
  const { checksum: _drop, ...rest } = snapshot;
  void _drop;
  return createHash("sha256").update(canonicalJSON(rest)).digest("hex");
}

/**
 * Verify the integrity of a snapshot. Returns:
 *   - { valid: true }
 *   - { valid: false, reason: "checksum_mismatch" | "wrong_version" | "missing_checksum" }
 */
export function verifySnapshot(snapshot: AgentSnapshotV1): {
  valid: boolean;
  reason?: string;
} {
  if (snapshot.version !== SNAPSHOT_VERSION) {
    return { valid: false, reason: "wrong_version" };
  }
  if (!snapshot.checksum) {
    return { valid: false, reason: "missing_checksum" };
  }
  const expected = computeChecksum(snapshot);
  if (expected !== snapshot.checksum) {
    return { valid: false, reason: "checksum_mismatch" };
  }
  return { valid: true };
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
