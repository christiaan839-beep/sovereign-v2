/**
 * SOVEREIGN MATRIX — Scheduled / cron agent primitive (Cook 46 / Tier 2 #6)
 *
 * Cron-style scheduling for agent runs. "Run lead-blitz every Monday
 * 9 am." Pure module: it parses cron-like specs and computes the
 * next-fire timestamp. The scheduler that actually FIRES the runs is
 * the caller's responsibility (existing `scheduledRuns` table +
 * cron worker).
 *
 * Supported cron grammar (subset that covers ≥ 95 % of business needs):
 *
 *   minute  hour  dom  month  dow
 *
 * Each field accepts:
 *   - `*`                  — every value
 *   - `5`                  — exact match
 *   - `5,10,15`            — comma list
 *   - `0-30`               — range
 *   - `* /5`               — step from 0
 *   - `2-20/3`             — stepped range
 *
 * Day-of-month and day-of-week are OR-combined (cron tradition).
 *
 * Timezone: UTC. Per-tenant TZ is layered on top by the caller.
 */

// ── Field parser ──────────────────────────────────────────────────────────

interface FieldRange {
  min: number;
  max: number;
}

const RANGES: Record<string, FieldRange> = {
  minute: { min: 0, max: 59 },
  hour: { min: 0, max: 23 },
  dom: { min: 1, max: 31 },
  month: { min: 1, max: 12 },
  dow: { min: 0, max: 6 }, // 0 = Sunday
};

function parseField(raw: string, range: FieldRange): Set<number> {
  if (raw === "*") {
    const set = new Set<number>();
    for (let i = range.min; i <= range.max; i++) set.add(i);
    return set;
  }
  const out = new Set<number>();
  for (const part of raw.split(",")) {
    const stepMatch = /^(.+)\/(\d+)$/.exec(part);
    let baseSpec = part;
    let step = 1;
    if (stepMatch) {
      baseSpec = stepMatch[1];
      step = parseInt(stepMatch[2], 10);
      if (!Number.isFinite(step) || step <= 0) {
        throw new Error(`Invalid step in cron field: '${part}'`);
      }
    }
    let lo: number, hi: number;
    if (baseSpec === "*") {
      lo = range.min;
      hi = range.max;
    } else if (baseSpec.includes("-")) {
      const [a, b] = baseSpec.split("-");
      lo = parseInt(a, 10);
      hi = parseInt(b, 10);
    } else {
      lo = parseInt(baseSpec, 10);
      hi = lo;
    }
    if (
      !Number.isFinite(lo) ||
      !Number.isFinite(hi) ||
      lo < range.min ||
      hi > range.max ||
      lo > hi
    ) {
      throw new Error(`Invalid cron field segment: '${part}'`);
    }
    for (let v = lo; v <= hi; v += step) out.add(v);
  }
  return out;
}

export interface CronSpec {
  minute: Set<number>;
  hour: Set<number>;
  dom: Set<number>;
  month: Set<number>;
  dow: Set<number>;
  /** Whether the spec uses default-* for dom or dow (affects OR-combination). */
  domStar: boolean;
  dowStar: boolean;
}

/**
 * Parse a 5-field cron expression. Throws on invalid input.
 */
export function parseCron(expr: string): CronSpec {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(
      `Cron expression must have 5 fields (minute hour dom month dow), got: '${expr}'`,
    );
  }
  const [m, h, dom, mo, dow] = parts;
  return {
    minute: parseField(m, RANGES.minute),
    hour: parseField(h, RANGES.hour),
    dom: parseField(dom, RANGES.dom),
    month: parseField(mo, RANGES.month),
    dow: parseField(dow, RANGES.dow),
    domStar: dom === "*",
    dowStar: dow === "*",
  };
}

// ── Next-fire computation ─────────────────────────────────────────────────

function matches(spec: CronSpec, date: Date): boolean {
  if (!spec.minute.has(date.getUTCMinutes())) return false;
  if (!spec.hour.has(date.getUTCHours())) return false;
  if (!spec.month.has(date.getUTCMonth() + 1)) return false;
  const domHit = spec.dom.has(date.getUTCDate());
  const dowHit = spec.dow.has(date.getUTCDay());
  // Cron tradition: if BOTH dom and dow are restricted (non-star),
  // it's an OR; if either is "*", apply the other one normally.
  if (spec.domStar && spec.dowStar) return true;
  if (spec.domStar) return dowHit;
  if (spec.dowStar) return domHit;
  return domHit || dowHit;
}

/**
 * Compute the next minute-aligned fire time at or after `from`.
 * Returns `null` if no match within the lookahead horizon (default
 * 366 days — protects against unsatisfiable specs).
 */
export function nextFireAt(
  spec: CronSpec,
  from: Date,
  options?: { lookaheadDays?: number },
): Date | null {
  const horizon = options?.lookaheadDays ?? 366;
  const max = new Date(from.getTime() + horizon * 24 * 60 * 60 * 1000);

  // Start at the next whole minute STRICTLY after `from` to avoid
  // returning `from` itself on consecutive calls.
  const t = new Date(from);
  t.setUTCSeconds(0, 0);
  t.setUTCMinutes(t.getUTCMinutes() + 1);

  while (t <= max) {
    if (matches(spec, t)) return t;
    t.setUTCMinutes(t.getUTCMinutes() + 1);
  }
  return null;
}
