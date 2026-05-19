/**
 * SOVEREIGN MATRIX — Honeypot signal emitter + bulletin flusher (wave 100).
 *
 * The bridge between the existing defense substrate (waves 92/94/98)
 * and the federation broadcast layer (wave 99). Every high-severity
 * defensive block becomes a CANDIDATE federation contribution; the
 * flusher dedupes, thresholds, and assembles them into bulletins.
 *
 * Two-stage design — required by serverless (each request runs in its
 * own isolate, no in-process buffer survives across requests):
 *
 *   Stage 1 — recordHoneypotSignal()
 *     Per-request. Writes a `honeypot.signal` audit_logs row when a
 *     guard blocks a HIGH-severity attack AND the operator has opted
 *     into federation contribution (HONEYPOT_AUTO_EMIT=true).
 *
 *   Stage 2 — flushHoneypotBulletin() (cron-driven)
 *     Reads recent signals, dedupes by fingerprintId, requires N
 *     distinct sources before federating (false-positive defence),
 *     groups by attack class, assembles + signs + publishes a bulletin
 *     via persistBulletin(). Each flush also pre-trims signals older
 *     than MAX_TTL_HOURS (no permanent retention of attack data).
 *
 * Safeguards baked into the code:
 *   - Default OFF (HONEYPOT_AUTO_EMIT=true required) — federating is
 *     a deliberate operator decision with reciprocal obligation.
 *   - Severity threshold ≥ 80 — only high-confidence blocks federate.
 *   - Distinct-source threshold (MIN_DISTINCT_SOURCES=3) — one
 *     misconfigured detector cannot poison the federation alone.
 *   - Dedup by fingerprintId — repeated attacks from the same source
 *     don't multiply the signal count.
 *   - MAX_SIGNALS_PER_FLUSH cap — bounds cron memory + audit-row size.
 */

import { createHash } from "node:crypto";
import { auditLog } from "@/lib/audit-log";
import {
  type AttackFingerprint,
  fingerprintId,
} from "@/lib/attack-fingerprint";
import {
  buildBulletin,
  persistBulletin,
  MAX_FINGERPRINTS_PER_BULLETIN,
  type FederationBulletin,
} from "@/lib/federation-bulletin";
import { createLogger } from "@/lib/logger";

const log = createLogger("honeypot-emitter");

/** Minimum severity for federation contribution (0-100). */
export const FEDERATION_SEVERITY_THRESHOLD = 80;

/** Minimum number of distinct upstream sources before federating. */
export const MIN_DISTINCT_SOURCES = 3;

/** Hard cap on signals read per flush — bounds cron runtime + memory. */
export const MAX_SIGNALS_PER_FLUSH = 1000;

/** Stale signals dropped at flush time — never permanent retention. */
export const SIGNAL_RETENTION_HOURS = 24;

/**
 * True iff the operator has explicitly opted into auto-federation.
 * Default off. Federating is a reciprocal obligation (consume + publish)
 * with ethics weight — operators must opt in deliberately.
 */
export function isAutoEmitEnabled(): boolean {
  return process.env.HONEYPOT_AUTO_EMIT === "true";
}

/**
 * SERVER-TRUSTED source kinds. Wave-100 security review H1: the API
 * deliberately rejects raw string sourceIds so callers cannot
 * accidentally pass request input (header, body, query param) as the
 * distinct-source counter. An attacker rotating a request-controlled
 * value 3 times would otherwise clear MIN_DISTINCT_SOURCES and poison
 * the federation. By forcing callers to select from this discriminated
 * union, the type system itself enforces that the "source" comes from
 * a server-observed identifier (tenant lookup, route registry,
 * server-derived IP hash) — not user input.
 *
 * If you find yourself wanting to add a `{ kind: "string", value: X }`
 * variant: don't. Add a named server-trusted variant for your specific
 * source kind instead.
 */
export type TrustedSourceKind =
  | { kind: "tenant"; tenantId: string }
  | { kind: "route"; routeId: string }
  | {
      kind: "ip";
      /**
       * sha256 hex (or truncated) of an IP the caller obtained from a
       * SERVER-observed source (e.g. Vercel's `x-real-ip` validated
       * against the proxy chain). Raw IPs MUST NOT be passed — the
       * type accepts only the pre-hashed form so a misuse is obvious.
       */
      ipHash: string;
    };

/** Hash a TrustedSourceKind into a 16-hex digest binding the kind. */
function hashTrustedSource(s: TrustedSourceKind): string {
  let input: string;
  switch (s.kind) {
    case "tenant":
      input = `tenant:${s.tenantId}`;
      break;
    case "route":
      input = `route:${s.routeId}`;
      break;
    case "ip":
      input = `ip:${s.ipHash}`;
      break;
  }
  return createHash("sha256").update(input, "utf8").digest("hex").slice(0, 16);
}

/**
 * Per-request hook: record a defensive block as a federation-candidate
 * signal. Fire-and-forget; never throws.
 *
 * The `source` parameter is a discriminated union — see
 * `TrustedSourceKind` above for the rationale. Callers cannot pass
 * raw user input; only server-trusted source identifiers.
 */
export async function recordHoneypotSignal(args: {
  fingerprint: AttackFingerprint;
  /**
   * The source that observed this attack. MUST be a server-trusted
   * identifier (tenant, route, or pre-hashed IP) — never request input.
   * See `TrustedSourceKind` for the type-level guard.
   */
  source: TrustedSourceKind;
}): Promise<void> {
  if (!isAutoEmitEnabled()) return;
  if (args.fingerprint.severity < FEDERATION_SEVERITY_THRESHOLD) return;

  try {
    const fpId = fingerprintId(args.fingerprint);
    const sourceHash = hashTrustedSource(args.source);

    await auditLog({
      userId: "system",
      action: "honeypot.signal",
      resource: `signal:${fpId.slice(0, 16)}`,
      details: {
        fingerprint: args.fingerprint,
        fingerprintId: fpId,
        sourceHash,
        ts: new Date().toISOString(),
      },
    });
  } catch (err) {
    log.error("recordHoneypotSignal failed", { error: String(err) });
  }
}

/**
 * Aggregate signals into a bulletin candidate. PURE helper — given a
 * list of signal records, returns the fingerprints that meet the
 * MIN_DISTINCT_SOURCES threshold, ordered by aggregate severity.
 *
 * Caller (flushHoneypotBulletin) supplies the raw signal records from
 * audit_logs. This function does the deduplication + threshold math;
 * it does NOT touch I/O.
 */
export interface SignalRecord {
  fingerprint: AttackFingerprint;
  fingerprintId: string;
  sourceHash: string;
}

export function aggregateSignals(records: SignalRecord[]): AttackFingerprint[] {
  // Group by fingerprintId, count distinct sourceHash per group.
  const groups = new Map<
    string,
    { fingerprint: AttackFingerprint; sources: Set<string> }
  >();
  for (const r of records) {
    const existing = groups.get(r.fingerprintId);
    if (existing) {
      existing.sources.add(r.sourceHash);
    } else {
      groups.set(r.fingerprintId, {
        fingerprint: r.fingerprint,
        sources: new Set([r.sourceHash]),
      });
    }
  }

  // Keep only those that meet the distinct-source threshold.
  const qualifying = [...groups.values()].filter(
    (g) => g.sources.size >= MIN_DISTINCT_SOURCES,
  );

  // Cap + sort by severity descending so the highest-confidence
  // fingerprints make it into the bulletin first.
  return qualifying
    .map((g) => g.fingerprint)
    .sort((a, b) => b.severity - a.severity)
    .slice(0, MAX_FINGERPRINTS_PER_BULLETIN);
}

/**
 * Filter signal records to those still within retention.
 * SIGNAL_RETENTION_HOURS (24h default) — drop everything older.
 * Stale signal data is not retained.
 */
export function filterFreshSignals(
  records: Array<SignalRecord & { ts: string }>,
  now: Date = new Date(),
): SignalRecord[] {
  const cutoffMs = now.getTime() - SIGNAL_RETENTION_HOURS * 3600 * 1000;
  return records
    .filter((r) => {
      const tsMs = new Date(r.ts).getTime();
      return tsMs > cutoffMs;
    })
    .map((r) => ({
      fingerprint: r.fingerprint,
      fingerprintId: r.fingerprintId,
      sourceHash: r.sourceHash,
    }));
}

export interface FlushResult {
  signalsRead: number;
  fingerprintsAfterAggregate: number;
  bulletinPublished: boolean;
  bulletinId?: string;
}

/**
 * End-to-end flush: aggregate the provided signal records, build a
 * bulletin if any fingerprints qualify, persist it. Returns
 * observability metrics. Pure of I/O for reading signals — caller
 * (the cron route) handles the audit_logs read so this module stays
 * testable without DB stubs.
 */
export async function flushHoneypotBulletin(
  records: Array<SignalRecord & { ts: string }>,
  issuerId: string,
): Promise<FlushResult> {
  const fresh = filterFreshSignals(records);
  const fingerprints = aggregateSignals(fresh);

  const result: FlushResult = {
    signalsRead: records.length,
    fingerprintsAfterAggregate: fingerprints.length,
    bulletinPublished: false,
  };

  if (fingerprints.length === 0) {
    return result;
  }

  let bulletin: FederationBulletin;
  try {
    bulletin = buildBulletin({
      issuerId,
      fingerprints,
    });
  } catch (err) {
    log.error("buildBulletin failed during flush", { error: String(err) });
    return result;
  }

  const persistResult = await persistBulletin(bulletin);
  result.bulletinPublished = persistResult.persisted;
  result.bulletinId = persistResult.bulletinId;
  return result;
}
