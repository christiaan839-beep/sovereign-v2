/**
 * Minimal cron expression matcher + next-fire computer.
 *
 * Supports the 5-field standard (minute hour day-of-month month day-of-week)
 * with tokens: `*`, `*\/N` (step), `N`, `N,M,P` (list), and `A-B` (range).
 * No named aliases (e.g. @hourly), no seconds field, no DST magic — all
 * evaluation is UTC.
 *
 * Two API surfaces:
 *   matches(expr, date)       — does this expression fire at this minute?
 *   nextRun(expr, after)      — first minute after `after` when it fires
 *
 * Design notes:
 *   - The cron loop runs once per minute (see vercel.json crons entry for
 *     /api/cron/scheduler). `matches()` is the fast path used at tick time.
 *   - `nextRun()` iterates minute-by-minute for up to 366 days to find a
 *     match. Worst-case ~527k iterations of a pure-JS numeric check; under
 *     50ms on a cold serverless. We only call this on scheduler CRUD,
 *     never on the hot path.
 */

type Field = Set<number> | "any";

function parseField(token: string, min: number, max: number): Field {
  const trimmed = token.trim();
  if (trimmed === "*") return "any";

  const values = new Set<number>();

  for (const part of trimmed.split(",")) {
    // Step: "*/N" or "A-B/N" — iterate with stride
    const stepMatch = part.match(/^(\*|\d+(?:-\d+)?)\/(\d+)$/);
    if (stepMatch) {
      const range = stepMatch[1];
      const step = Number(stepMatch[2]);
      if (!Number.isFinite(step) || step <= 0) continue;
      let lo = min, hi = max;
      if (range !== "*") {
        const rangeMatch = range.match(/^(\d+)(?:-(\d+))?$/);
        if (rangeMatch) {
          lo = Number(rangeMatch[1]);
          hi = rangeMatch[2] ? Number(rangeMatch[2]) : max;
        }
      }
      for (let i = lo; i <= hi; i += step) {
        if (i >= min && i <= max) values.add(i);
      }
      continue;
    }

    // Range: "A-B"
    const rangeMatch = part.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const lo = Number(rangeMatch[1]);
      const hi = Number(rangeMatch[2]);
      for (let i = lo; i <= hi; i++) {
        if (i >= min && i <= max) values.add(i);
      }
      continue;
    }

    // Single number
    const n = Number(part);
    if (Number.isFinite(n) && n >= min && n <= max) values.add(n);
  }

  return values;
}

function fieldContains(field: Field, n: number): boolean {
  return field === "any" || field.has(n);
}

interface Parsed {
  minute: Field;
  hour: Field;
  dom: Field;
  month: Field;   // 1–12
  dow: Field;     // 0–6 (Sun=0)
}

function parseCron(expr: string): Parsed | null {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  return {
    minute: parseField(parts[0], 0, 59),
    hour:   parseField(parts[1], 0, 23),
    // DOM range is 1–31 (cron convention; month lengths handled at match time)
    dom:    parseField(parts[2], 1, 31),
    month:  parseField(parts[3], 1, 12),
    // DOW: cron allows 0 or 7 for Sunday. We normalize to 0..6 at parse time.
    dow:    parseField(parts[4].replace(/\b7\b/g, "0"), 0, 6),
  };
}

/** Does the given UTC date match this cron expression at its minute? */
export function matches(expr: string, date: Date): boolean {
  const p = parseCron(expr);
  if (!p) return false;

  if (!fieldContains(p.minute, date.getUTCMinutes())) return false;
  if (!fieldContains(p.hour, date.getUTCHours())) return false;
  if (!fieldContains(p.month, date.getUTCMonth() + 1)) return false;

  // Cron DOM/DOW semantics: if BOTH are restricted, match if either matches;
  // if either is "*", both must match. We follow the common implementation.
  const domMatch = fieldContains(p.dom, date.getUTCDate());
  const dowMatch = fieldContains(p.dow, date.getUTCDay());
  const domRestricted = p.dom !== "any";
  const dowRestricted = p.dow !== "any";

  if (domRestricted && dowRestricted) return domMatch || dowMatch;
  return domMatch && dowMatch;
}

/**
 * First minute strictly after `from` when `expr` fires. Iterates minute-by-
 * minute up to 366 days. Returns null if the expression never matches.
 */
export function nextRun(expr: string, from: Date = new Date()): Date | null {
  const p = parseCron(expr);
  if (!p) return null;

  // Start from the minute AFTER `from`, aligned to minute boundary (UTC).
  const start = new Date(from);
  start.setUTCSeconds(0, 0);
  start.setUTCMinutes(start.getUTCMinutes() + 1);

  const MAX_ITERATIONS = 366 * 24 * 60; // 1 year
  const cur = new Date(start);

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    if (matches(expr, cur)) return cur;
    cur.setUTCMinutes(cur.getUTCMinutes() + 1);
  }
  return null;
}

/**
 * Validate — returns null if expr parses, otherwise an error string.
 * Useful for UI validation before saving a user-provided schedule.
 */
export function validateCron(expr: string): string | null {
  const p = parseCron(expr);
  if (!p) return "Cron expression must have 5 space-separated fields (minute hour day month day-of-week).";
  // Check that at least one minute matches (guards against empty ranges)
  const next = nextRun(expr, new Date(0));
  if (!next) return "Cron expression has no valid firing time within a year.";
  return null;
}
