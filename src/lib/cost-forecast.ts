/**
 * SOVEREIGN MATRIX — Cost forecast (Cook 124).
 *
 * Predicts month-end spend per tenant from N days of history using a
 * Holt linear-trend exponential smoother. Powers the CFO dashboard's
 * "you're on track to hit $X this month" panel + auto-prompts the
 * upgrade modal when a tenant is projected to blow their plan's
 * monthly cap.
 *
 * Pure module — caller supplies the daily samples. Composes with
 * Cook 45 cost telemetry (descriptive) + Cook 117 anomaly detector
 * (point-in-time spikes) — this module adds FORWARD-LOOKING signal.
 */

// ── Public types ──────────────────────────────────────────────────────────

export interface DailyCost {
  /** UTC midnight unix ms. */
  dayStartMs: number;
  /** Cents consumed that day. */
  cents: number;
}

export interface ForecastConfig {
  /** Level smoothing factor (0..1). Default 0.5. */
  alpha: number;
  /** Trend smoothing factor (0..1). Default 0.3. */
  beta: number;
}

export interface ForecastResult {
  /** Smoothed daily-cents level after the last sample. */
  level: number;
  /** Smoothed daily-cents trend after the last sample. */
  trend: number;
  /** Forecasted month-end total cents (so far + remaining days × (level+trend·n)). */
  monthEndCents: number;
  /** Whether we have enough data to forecast (≥ 3 samples). */
  sufficient: boolean;
  /** Days remaining in the current UTC month. */
  daysRemaining: number;
}

const DEFAULTS: ForecastConfig = { alpha: 0.5, beta: 0.3 };

// ── Helpers ───────────────────────────────────────────────────────────────

function daysInUtcMonth(ms: number): number {
  const d = new Date(ms);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
}

function dayOfUtcMonth(ms: number): number {
  return new Date(ms).getUTCDate();
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Holt linear-trend exponential smoothing. Pure: same input → same
 * level + trend → same forecast.
 *
 *   level_t = α × x_t + (1-α) × (level_{t-1} + trend_{t-1})
 *   trend_t = β × (level_t - level_{t-1}) + (1-β) × trend_{t-1}
 */
export function forecast(
  daily: DailyCost[],
  options: Partial<ForecastConfig> = {},
  now: number = Date.now(),
): ForecastResult {
  const cfg = { ...DEFAULTS, ...options };
  if (daily.length === 0) {
    return {
      level: 0,
      trend: 0,
      monthEndCents: 0,
      sufficient: false,
      daysRemaining: daysInUtcMonth(now) - dayOfUtcMonth(now) + 1,
    };
  }

  if (daily.length < 3) {
    // Insufficient: fall back to "mean of available × remaining days".
    const mean = daily.reduce((s, d) => s + d.cents, 0) / daily.length;
    const remaining = daysInUtcMonth(now) - dayOfUtcMonth(now);
    return {
      level: mean,
      trend: 0,
      monthEndCents: Math.round(
        daily.reduce((s, d) => s + d.cents, 0) + remaining * mean,
      ),
      sufficient: false,
      daysRemaining: remaining + 1,
    };
  }

  // Initialize level + trend from the first two points.
  let level = daily[1].cents;
  let trend = daily[1].cents - daily[0].cents;

  for (let i = 2; i < daily.length; i++) {
    const x = daily[i].cents;
    const newLevel = cfg.alpha * x + (1 - cfg.alpha) * (level + trend);
    const newTrend = cfg.beta * (newLevel - level) + (1 - cfg.beta) * trend;
    level = newLevel;
    trend = newTrend;
  }

  const daysInMonth = daysInUtcMonth(now);
  const dayOfMonth = dayOfUtcMonth(now);
  const remaining = Math.max(0, daysInMonth - dayOfMonth);
  // Sum of (level + n·trend) for n in [1, remaining].
  const remainingSum =
    remaining * level + (trend * remaining * (remaining + 1)) / 2;
  const soFar = daily.reduce((s, d) => s + d.cents, 0);

  return {
    level: Math.max(0, level),
    trend,
    monthEndCents: Math.max(0, Math.round(soFar + remainingSum)),
    sufficient: true,
    daysRemaining: remaining + 1,
  };
}

/**
 * Decide whether to surface the upgrade modal. Pure: caller passes
 * the forecast + the plan's monthly cap; returns a structured
 * verdict the dashboard renders directly.
 */
export interface UpgradeRecommendation {
  recommend: boolean;
  projectedOverageCents: number;
  /** "low" < 1.1x cap, "high" 1.1-1.5x, "critical" > 1.5x. */
  severity: "none" | "low" | "high" | "critical";
}

export function recommendUpgrade(
  forecast: ForecastResult,
  monthlyCapCents: number,
): UpgradeRecommendation {
  if (monthlyCapCents <= 0) {
    return {
      recommend: false,
      projectedOverageCents: 0,
      severity: "none",
    };
  }
  const overage = Math.max(0, forecast.monthEndCents - monthlyCapCents);
  if (overage === 0) {
    return { recommend: false, projectedOverageCents: 0, severity: "none" };
  }
  const ratio = forecast.monthEndCents / monthlyCapCents;
  const severity = ratio > 1.5 ? "critical" : ratio > 1.1 ? "high" : "low";
  return {
    recommend: true,
    projectedOverageCents: overage,
    severity,
  };
}
