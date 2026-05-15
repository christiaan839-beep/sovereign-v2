/**
 * SOVEREIGN MATRIX — Per-tenant quota enforcement (Cook 118).
 *
 * Composes Cook 57 white-label rate-limiter with monthly + per-day
 * + per-minute caps, plan-aware. Returns structured decisions so
 * the caller can surface "you've used 92% of your monthly quota"
 * UX before the user hits the wall.
 */

// ── Public types ──────────────────────────────────────────────────────────

export interface QuotaPlan {
  planId: string;
  runsPerMinute: number;
  runsPerDay: number;
  runsPerMonth: number;
}

export interface QuotaUsage {
  /** Runs in the trailing 60s window. */
  minuteCount: number;
  /** Runs since midnight UTC today. */
  dayCount: number;
  /** Runs since midnight UTC the 1st of the current month. */
  monthCount: number;
}

export interface QuotaDecision {
  allowed: boolean;
  reason?: "minute-limit" | "day-limit" | "month-limit";
  /** Percent (0..1) of the most-constrained bucket consumed AFTER this run. */
  pressure: number;
  /** Which bucket is closest to saturation. */
  hotBucket: "minute" | "day" | "month" | "none";
  /** ms until the most-constrained bucket resets. */
  resetInMs: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function nextMidnightUtc(now: number): number {
  const d = new Date(now);
  return Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() + 1,
    0,
    0,
    0,
  );
}

function nextMonthStartUtc(now: number): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0);
}

function nextMinuteUtc(now: number): number {
  return Math.ceil((now + 1) / 60_000) * 60_000;
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Check whether one more run would clear every bucket. Pure: caller
 * persists usage and replays under same plan to reach same verdict.
 */
export function checkQuota(
  plan: QuotaPlan,
  usage: QuotaUsage,
  now: number = Date.now(),
): QuotaDecision {
  const minutePct = (usage.minuteCount + 1) / plan.runsPerMinute;
  const dayPct = (usage.dayCount + 1) / plan.runsPerDay;
  const monthPct = (usage.monthCount + 1) / plan.runsPerMonth;

  let hotBucket: QuotaDecision["hotBucket"] = "none";
  let pressure = 0;
  if (minutePct >= dayPct && minutePct >= monthPct) {
    hotBucket = "minute";
    pressure = minutePct;
  } else if (dayPct >= monthPct) {
    hotBucket = "day";
    pressure = dayPct;
  } else {
    hotBucket = "month";
    pressure = monthPct;
  }

  let resetInMs: number;
  if (hotBucket === "minute") {
    resetInMs = nextMinuteUtc(now) - now;
  } else if (hotBucket === "day") {
    resetInMs = nextMidnightUtc(now) - now;
  } else {
    resetInMs = nextMonthStartUtc(now) - now;
  }

  if (usage.minuteCount + 1 > plan.runsPerMinute) {
    return {
      allowed: false,
      reason: "minute-limit",
      pressure: minutePct,
      hotBucket: "minute",
      resetInMs: nextMinuteUtc(now) - now,
    };
  }
  if (usage.dayCount + 1 > plan.runsPerDay) {
    return {
      allowed: false,
      reason: "day-limit",
      pressure: dayPct,
      hotBucket: "day",
      resetInMs: nextMidnightUtc(now) - now,
    };
  }
  if (usage.monthCount + 1 > plan.runsPerMonth) {
    return {
      allowed: false,
      reason: "month-limit",
      pressure: monthPct,
      hotBucket: "month",
      resetInMs: nextMonthStartUtc(now) - now,
    };
  }

  return {
    allowed: true,
    pressure,
    hotBucket,
    resetInMs,
  };
}
