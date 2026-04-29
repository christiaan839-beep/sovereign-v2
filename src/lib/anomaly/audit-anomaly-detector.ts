/**
 * REAL-TIME AUDIT-CHAIN ANOMALY DETECTOR (R57).
 *
 * The closure for R44's `auditChainIntact: null` honest-unknown.
 * Provides pure-function statistical detection of anomalies in
 * the audit chain so signed reliability attestations carry a
 * real boolean instead of a placeholder.
 *
 * THE SIGNALS WE DETECT (ML-free, all standard statistics):
 *
 *   1. RATE SPIKE — sudden jump in actions for an (agent, action)
 *      tuple beyond N standard deviations from the trailing mean.
 *      Catches runaway loops + abuse patterns.
 *
 *   2. RATE DROP — sudden cessation of expected activity
 *      (e.g., a daily HITL approval cron stops writing rows).
 *      Catches silent failures.
 *
 *   3. DENIAL RATE SPIKE — HITL denial rate jumps. Catches
 *      systemic agent quality degradation BEFORE customers notice.
 *
 *   4. CHAIN INTEGRITY BREAK — at least one row's prev_hash !=
 *      prior row's row_hash. Catches DB tampering immediately.
 *
 *   5. SIGNATURE FAILURE SPIKE — Ed25519 verifications failing
 *      at higher than baseline rate. Catches key compromise +
 *      replay attempts.
 *
 *   6. NOVEL ACTOR — a new (agent, action) tuple appearing for
 *      the first time. Not always anomalous; surfaced as info,
 *      not as an alert.
 *
 * Pure functions throughout. The detector takes a SNAPSHOT (recent
 * audit events + rolling baselines) and returns an array of
 * AnomalyFinding. The composition with R44 is:
 *
 *   1. Cron computes the snapshot from audit_logs.
 *   2. detectAnomalies() returns findings.
 *   3. R44 attestation includes findings.length and
 *      auditChainIntact = (no chain_integrity_break in findings).
 *   4. /reliability page surfaces findings to operators.
 *
 * Ports verbatim to @sovereign/inspector: customers can pull their
 * own audit_logs, run the detector locally, and verify Sovereign
 * isn't suppressing findings.
 *
 * NO ML. NO TRAINED MODEL. NO BLACK BOX. Standard z-score, rate
 * comparisons, hash chain walks. Auditable + reproducible.
 */

// ── Types ──────────────────────────────────────────────────────────

export type AnomalyKind =
  | "rate_spike"
  | "rate_drop"
  | "denial_rate_spike"
  | "chain_integrity_break"
  | "signature_failure_spike"
  | "novel_actor";

export type AnomalySeverity = "info" | "warning" | "critical";

export interface AuditEventCount {
  /** Composite key: action + agent + tenant. */
  agent: string;
  action: string;
  tenant: string;
  /** Count of events in the recent window. */
  recentCount: number;
  /** Mean count over the trailing baseline windows. */
  baselineMean: number;
  /** Std dev of the baseline (use 1 if undefined to avoid /0). */
  baselineStdDev: number;
  /** How many baseline windows were sampled (>= 1 to avoid /0). */
  baselineWindowCount: number;
}

export interface DenialRateSnapshot {
  agent: string;
  tenant: string;
  recentDenialRate: number; // 0..1
  baselineDenialRate: number; // 0..1
  recentSampleSize: number;
}

export interface ChainIntegritySnapshot {
  /** True iff the most recent verifyAuditChain() pass succeeded. */
  intact: boolean;
  /** First-broken row id (when not intact). */
  firstBrokenId: string | null;
  /** Total rows checked. */
  totalRows: number;
}

export interface SignatureFailureSnapshot {
  /** Recent signature verification failures (count). */
  recentFailures: number;
  /** Recent total verifications (denominator). */
  recentTotal: number;
  /** Baseline failure rate (0..1). */
  baselineFailureRate: number;
}

export interface NovelActorSnapshot {
  agent: string;
  action: string;
  tenant: string;
  /** True iff this (agent, action, tenant) triple has no prior history. */
  isNovel: boolean;
}

export interface DetectionInput {
  events: AuditEventCount[];
  denialRates: DenialRateSnapshot[];
  chainIntegrity: ChainIntegritySnapshot | null;
  signatureFailures: SignatureFailureSnapshot | null;
  novelActors: NovelActorSnapshot[];
  /** Z-score threshold for rate-spike detection. Default 3. */
  zScoreThreshold?: number;
  /** Min baseline samples before we'll flag a rate spike. */
  minBaselineSamples?: number;
}

export interface AnomalyFinding {
  kind: AnomalyKind;
  severity: AnomalySeverity;
  /** Procurement-readable one-liner. */
  message: string;
  /** Structured details for ops dashboards / inspector verification. */
  details: Record<string, string | number | boolean>;
}

// ── Pure detector ──────────────────────────────────────────────────

const DEFAULT_Z_SCORE_THRESHOLD = 3;
const DEFAULT_MIN_BASELINE_SAMPLES = 3;
/** Significant denial-rate jump threshold (absolute, e.g. +0.20 = +20pp).
 *  Tiny epsilon below the round number to absorb FP precision losses
 *  (0.30 - 0.10 = 0.19999... in JS). */
const DENIAL_RATE_JUMP_THRESHOLD = 0.20 - 1e-9;
/** Significant signature-failure-rate jump (absolute). Same epsilon
 *  treatment for FP safety. */
const SIGNATURE_FAILURE_RATE_JUMP_THRESHOLD = 0.05 - 1e-9;

/**
 * THE PURE DETECTOR. Takes the snapshot, returns findings sorted
 * by severity (critical → warning → info).
 *
 * Same input → same output, every time. No I/O. No clock unless
 * the caller passes it. Easy to test in isolation; ports verbatim
 * to the inspector for customer-side verification.
 */
export function detectAnomalies(input: DetectionInput): AnomalyFinding[] {
  const findings: AnomalyFinding[] = [];
  const zThreshold = input.zScoreThreshold ?? DEFAULT_Z_SCORE_THRESHOLD;
  const minSamples = input.minBaselineSamples ?? DEFAULT_MIN_BASELINE_SAMPLES;

  // 1 + 2. Rate spikes / drops via z-score.
  for (const ev of input.events) {
    if (ev.baselineWindowCount < minSamples) continue;
    if (ev.baselineStdDev === 0) {
      // Constant baseline. A spike is any nonzero deviation; a drop
      // is the recent count being zero when baseline > 0.
      if (ev.recentCount > ev.baselineMean) {
        findings.push({
          kind: "rate_spike",
          severity: ev.recentCount > 10 * ev.baselineMean ? "critical" : "warning",
          message:
            `${ev.action} for ${ev.agent} on ${ev.tenant} jumped from ` +
            `~${ev.baselineMean.toFixed(1)} to ${ev.recentCount} (constant baseline)`,
          details: {
            agent: ev.agent,
            action: ev.action,
            tenant: ev.tenant,
            recentCount: ev.recentCount,
            baselineMean: ev.baselineMean,
            zScore: Infinity,
          },
        });
      } else if (ev.baselineMean > 0 && ev.recentCount === 0) {
        findings.push({
          kind: "rate_drop",
          severity: "warning",
          message:
            `${ev.action} for ${ev.agent} on ${ev.tenant} stopped completely ` +
            `(baseline ~${ev.baselineMean.toFixed(1)})`,
          details: {
            agent: ev.agent,
            action: ev.action,
            tenant: ev.tenant,
            recentCount: 0,
            baselineMean: ev.baselineMean,
          },
        });
      }
      continue;
    }
    const z = (ev.recentCount - ev.baselineMean) / ev.baselineStdDev;
    if (z >= zThreshold) {
      findings.push({
        kind: "rate_spike",
        severity: z >= zThreshold * 2 ? "critical" : "warning",
        message:
          `${ev.action} for ${ev.agent} spiked to ${ev.recentCount} ` +
          `(z=${z.toFixed(2)}, baseline=${ev.baselineMean.toFixed(1)}±${ev.baselineStdDev.toFixed(1)})`,
        details: {
          agent: ev.agent,
          action: ev.action,
          tenant: ev.tenant,
          recentCount: ev.recentCount,
          baselineMean: ev.baselineMean,
          zScore: round2(z),
        },
      });
    } else if (z <= -zThreshold) {
      findings.push({
        kind: "rate_drop",
        severity: z <= -zThreshold * 2 ? "critical" : "warning",
        message:
          `${ev.action} for ${ev.agent} dropped to ${ev.recentCount} ` +
          `(z=${z.toFixed(2)}, baseline=${ev.baselineMean.toFixed(1)}±${ev.baselineStdDev.toFixed(1)})`,
        details: {
          agent: ev.agent,
          action: ev.action,
          tenant: ev.tenant,
          recentCount: ev.recentCount,
          baselineMean: ev.baselineMean,
          zScore: round2(z),
        },
      });
    }
  }

  // 3. Denial-rate spikes.
  for (const dr of input.denialRates) {
    if (dr.recentSampleSize < 5) continue; // need a meaningful sample
    const jump = dr.recentDenialRate - dr.baselineDenialRate;
    if (jump >= DENIAL_RATE_JUMP_THRESHOLD) {
      findings.push({
        kind: "denial_rate_spike",
        severity: jump >= 0.40 ? "critical" : "warning",
        message:
          `HITL denial rate for ${dr.agent} on ${dr.tenant} jumped from ` +
          `${(dr.baselineDenialRate * 100).toFixed(0)}% to ` +
          `${(dr.recentDenialRate * 100).toFixed(0)}% (n=${dr.recentSampleSize})`,
        details: {
          agent: dr.agent,
          tenant: dr.tenant,
          baselineDenialRate: round2(dr.baselineDenialRate),
          recentDenialRate: round2(dr.recentDenialRate),
          jumpPp: round2(jump),
          recentSampleSize: dr.recentSampleSize,
        },
      });
    }
  }

  // 4. Chain integrity break — always critical.
  if (input.chainIntegrity && !input.chainIntegrity.intact) {
    findings.push({
      kind: "chain_integrity_break",
      severity: "critical",
      message:
        `AUDIT CHAIN BROKEN — first broken row: ${input.chainIntegrity.firstBrokenId ?? "(none reported)"} ` +
        `out of ${input.chainIntegrity.totalRows} rows. Tampering or corruption suspected.`,
      details: {
        firstBrokenId: input.chainIntegrity.firstBrokenId ?? "unknown",
        totalRows: input.chainIntegrity.totalRows,
      },
    });
  }

  // 5. Signature-failure-rate spike.
  if (input.signatureFailures && input.signatureFailures.recentTotal > 0) {
    const recentRate =
      input.signatureFailures.recentFailures /
      input.signatureFailures.recentTotal;
    const jump = recentRate - input.signatureFailures.baselineFailureRate;
    if (jump >= SIGNATURE_FAILURE_RATE_JUMP_THRESHOLD) {
      findings.push({
        kind: "signature_failure_spike",
        severity: jump >= 0.20 ? "critical" : "warning",
        message:
          `Ed25519 signature-failure rate jumped from ` +
          `${(input.signatureFailures.baselineFailureRate * 100).toFixed(2)}% to ` +
          `${(recentRate * 100).toFixed(2)}%. Possible key compromise or replay attack.`,
        details: {
          baselineFailureRate: round2(input.signatureFailures.baselineFailureRate),
          recentFailureRate: round2(recentRate),
          jumpPp: round2(jump),
          recentTotal: input.signatureFailures.recentTotal,
        },
      });
    }
  }

  // 6. Novel actors — info severity (not noise).
  for (const na of input.novelActors) {
    if (na.isNovel) {
      findings.push({
        kind: "novel_actor",
        severity: "info",
        message:
          `New (agent, action) seen for the first time: ` +
          `${na.agent} → ${na.action} on tenant ${na.tenant}`,
        details: {
          agent: na.agent,
          action: na.action,
          tenant: na.tenant,
        },
      });
    }
  }

  // Sort: critical → warning → info, then alphabetical by message
  // for stable output.
  const severityRank: Record<AnomalySeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };
  return findings.sort((a, b) => {
    const sd = severityRank[a.severity] - severityRank[b.severity];
    if (sd !== 0) return sd;
    return a.message.localeCompare(b.message);
  });
}

/**
 * Pure: derive R44's `auditChainIntact` boolean from anomaly findings.
 *
 * Rules:
 *   - chainIntegrity snapshot present AND intact=true → return true.
 *   - chainIntegrity snapshot present AND intact=false → return false.
 *   - chainIntegrity snapshot null → return null (honest unknown).
 *
 * Used by the cron-sign-reliability-attestation route to wire R57
 * into R44.
 */
export function deriveAuditChainIntactFromFindings(
  chainIntegrity: ChainIntegritySnapshot | null,
): boolean | null {
  if (chainIntegrity === null) return null;
  return chainIntegrity.intact;
}

/**
 * Pure: classify the OVERALL anomaly state for a given findings array.
 *
 * - "critical" if any critical finding (do not bury this).
 * - "warning" if any warning but no critical.
 * - "info" otherwise.
 * - "clean" if findings array is empty.
 */
export type OverallAnomalyState = "clean" | "info" | "warning" | "critical";

export function classifyOverallAnomalyState(
  findings: AnomalyFinding[],
): OverallAnomalyState {
  if (findings.length === 0) return "clean";
  if (findings.some((f) => f.severity === "critical")) return "critical";
  if (findings.some((f) => f.severity === "warning")) return "warning";
  return "info";
}

// ── Helper ─────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
