/**
 * SOVEREIGN MATRIX — Cost anomaly detector (Cook 117).
 *
 * Extends Cook 45 cost-telemetry from descriptive ("here's the
 * spend") to predictive ("this tenant is burning $X faster than
 * baseline — page on-call before they hit the credit limit").
 *
 * Pure module — caller supplies the recent + historical samples.
 * Detection uses a simple EWMA (exponentially weighted moving avg)
 * + standard-deviation band; flags anomalies when the latest sample
 * is more than N sigmas above the trailing band.
 */

// ── Public types ──────────────────────────────────────────────────────────

export interface CostSample {
  /** Unix ms of the sample window start. */
  windowStartMs: number;
  /** Cents the tenant consumed in the window. */
  cents: number;
}

export interface AnomalyDetection {
  flagged: boolean;
  /** Z-score of the latest sample against the EWMA + stddev band. */
  zScore: number;
  /** EWMA mean used as the baseline. */
  baseline: number;
  /** EWMA stddev. */
  stddev: number;
  /** Latest sample being evaluated. */
  latest: number;
  /** Human-readable reason. */
  message: string;
}

export interface AnomalyConfig {
  /** EWMA decay (0..1). Higher = faster forget. Default 0.3. */
  alpha: number;
  /** Z-score threshold to flag. Default 3. */
  sigmas: number;
  /** Minimum baseline samples before flagging. Default 5. */
  minSamples: number;
}

const DEFAULTS: AnomalyConfig = {
  alpha: 0.3,
  sigmas: 3,
  minSamples: 5,
};

// ── Detector ──────────────────────────────────────────────────────────────

/**
 * Detect a cost anomaly. Pure: caller passes the full sample
 * history (most recent last). Returns the verdict + EWMA stats.
 */
export function detectAnomaly(
  samples: CostSample[],
  options: Partial<AnomalyConfig> = {},
): AnomalyDetection {
  const cfg = { ...DEFAULTS, ...options };
  if (samples.length === 0) {
    return {
      flagged: false,
      zScore: 0,
      baseline: 0,
      stddev: 0,
      latest: 0,
      message: "no samples",
    };
  }
  const latest = samples[samples.length - 1].cents;

  if (samples.length < cfg.minSamples) {
    return {
      flagged: false,
      zScore: 0,
      baseline: latest,
      stddev: 0,
      latest,
      message: `insufficient baseline (${samples.length} < ${cfg.minSamples})`,
    };
  }

  // Compute EWMA over everything except the last sample, so the
  // sample under test isn't included in its own baseline.
  const baselineSamples = samples.slice(0, -1).map((s) => s.cents);
  let mean = baselineSamples[0];
  let variance = 0;
  for (let i = 1; i < baselineSamples.length; i++) {
    const x = baselineSamples[i];
    const newMean = cfg.alpha * x + (1 - cfg.alpha) * mean;
    variance =
      cfg.alpha * (x - mean) * (x - newMean) + (1 - cfg.alpha) * variance;
    mean = newMean;
  }
  const stddev = Math.sqrt(Math.max(0, variance));
  // Stddev=0 means a perfectly stable baseline. Any deviation is
  // therefore infinitely surprising. We compare against the baseline
  // magnitude as a "relative spike" detector: a 5× jump from a
  // perfectly stable line gets flagged even with zero variance.
  let zScore: number;
  if (stddev === 0) {
    zScore =
      latest === mean ? 0 : (Math.abs(latest - mean) / Math.max(1, mean)) * 10;
  } else {
    zScore = (latest - mean) / stddev;
  }
  const flagged = zScore > cfg.sigmas;

  return {
    flagged,
    zScore,
    baseline: mean,
    stddev,
    latest,
    message: flagged
      ? `latest ${latest} is ${zScore.toFixed(2)}σ above baseline ${mean.toFixed(1)} ± ${stddev.toFixed(1)}`
      : `latest ${latest} within ${cfg.sigmas}σ of baseline`,
  };
}

/**
 * Helper for the CFO dashboard: classify a series of tenants by
 * anomaly status. Caller passes a per-tenant sample list.
 */
export function detectFleetAnomalies(
  fleet: Array<{ tenantId: string; samples: CostSample[] }>,
  options: Partial<AnomalyConfig> = {},
): Array<{ tenantId: string; detection: AnomalyDetection }> {
  return fleet.map((t) => ({
    tenantId: t.tenantId,
    detection: detectAnomaly(t.samples, options),
  }));
}
