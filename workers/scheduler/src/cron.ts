/**
 * A five-field cron matcher — standard Unix semantics.
 *
 * Why this exists rather than one Cloudflare Cron Trigger per job:
 *
 *  1. **Free-tier limits.** Cloudflare allows 5 Cron Triggers per account
 *     on the free plan. There are 10 scheduled jobs. One trigger firing
 *     every minute, dispatching internally, uses one of the five.
 *
 *  2. **Day-of-week semantics differ.** Cloudflare's cron parser numbers
 *     weekdays 1=Sunday..7=Saturday. Standard cron — and every expression
 *     in `vercel.json` — uses 0=Sunday..6=Saturday. Handing
 *     `0 3 * * 0` straight to Cloudflare would move the weekly cleanup by
 *     a day. Matching internally means the existing expressions are
 *     copied across verbatim and keep their original meaning.
 *
 * Supported syntax per field: `*`, `N`, `a-b`, `*​/n`, `a-b/n`, and any
 * comma-separated combination of those.
 *
 * All matching is in UTC, which is what both Vercel and Cloudflare use.
 */

/** Inclusive bounds for each field, in cron order. */
const BOUNDS: ReadonlyArray<readonly [number, number]> = [
  [0, 59], // minute
  [0, 23], // hour
  [1, 31], // day of month
  [1, 12], // month
  [0, 6], // day of week, 0 = Sunday
];

const FIELD_NAMES = ["minute", "hour", "day-of-month", "month", "day-of-week"] as const;

/**
 * Expand one field into the exact set of values it matches.
 *
 * Throws rather than returning an empty set on malformed input: a cron
 * field nobody can parse is a job that silently never runs, which is the
 * failure mode this whole Worker exists to prevent.
 */
export function expandField(field: string, index: number): Set<number> {
  const bound = BOUNDS[index];
  if (!bound) throw new RangeError(`cron: no such field index ${index}`);
  const [min, max] = bound;
  const out = new Set<number>();

  for (const part of field.split(",")) {
    const chunk = part.trim();
    if (!chunk) throw new SyntaxError(`cron: empty ${FIELD_NAMES[index]} entry in "${field}"`);

    const [rangePart, stepPart, ...rest] = chunk.split("/");
    if (rest.length > 0) {
      throw new SyntaxError(`cron: more than one "/" in ${FIELD_NAMES[index]} entry "${chunk}"`);
    }

    let step = 1;
    if (stepPart !== undefined) {
      step = Number(stepPart);
      if (!Number.isInteger(step) || step < 1) {
        throw new SyntaxError(`cron: step must be a positive integer in "${chunk}"`);
      }
    }

    let lo: number;
    let hi: number;
    if (rangePart === "*") {
      lo = min;
      hi = max;
    } else if (rangePart !== undefined && rangePart.includes("-")) {
      const [a, b] = rangePart.split("-");
      lo = Number(a);
      hi = Number(b);
      if (!Number.isInteger(lo) || !Number.isInteger(hi)) {
        throw new SyntaxError(`cron: non-integer range in "${chunk}"`);
      }
      // A reversed range is far more likely a typo than an intent to
      // wrap, so it is rejected rather than silently reinterpreted.
      if (lo > hi) throw new RangeError(`cron: reversed range "${chunk}"`);
    } else {
      lo = Number(rangePart);
      hi = lo;
      if (!Number.isInteger(lo)) {
        throw new SyntaxError(`cron: "${chunk}" is not a valid ${FIELD_NAMES[index]}`);
      }
      // `5/15` means "from 5, every 15" — an open-ended step from a
      // single start value, not the single value 5.
      if (stepPart !== undefined) hi = max;
    }

    if (lo < min || hi > max) {
      throw new RangeError(
        `cron: ${FIELD_NAMES[index]} "${chunk}" is outside ${min}-${max}`,
      );
    }
    for (let v = lo; v <= hi; v += step) out.add(v);
  }

  return out;
}

/** A cron expression compiled to the value sets it matches. */
export interface CompiledCron {
  readonly expression: string;
  readonly minute: Set<number>;
  readonly hour: Set<number>;
  readonly dayOfMonth: Set<number>;
  readonly month: Set<number>;
  readonly dayOfWeek: Set<number>;
  /** True when the field was literally `*` — needed for the OR rule below. */
  readonly domRestricted: boolean;
  readonly dowRestricted: boolean;
}

/** Parse a five-field expression. Throws on anything malformed. */
export function compileCron(expression: string): CompiledCron {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) {
    throw new SyntaxError(
      `cron: expected 5 fields, got ${fields.length} in "${expression}"`,
    );
  }
  const [min, hr, dom, mon, dow] = fields as [string, string, string, string, string];
  return {
    expression,
    minute: expandField(min, 0),
    hour: expandField(hr, 1),
    dayOfMonth: expandField(dom, 2),
    month: expandField(mon, 3),
    dayOfWeek: expandField(dow, 4),
    domRestricted: dom !== "*",
    dowRestricted: dow !== "*",
  };
}

/**
 * Does this expression fire at the given instant?
 *
 * Note the day rule, which is the part of cron most implementations get
 * wrong: when BOTH day-of-month and day-of-week are restricted, a match
 * on EITHER fires the job — they are OR'd, not AND'd. `0 0 1 * 1` means
 * "the 1st of the month, and also every Monday". When only one is
 * restricted, only that one is consulted.
 */
export function matches(cron: CompiledCron, at: Date): boolean {
  if (!cron.minute.has(at.getUTCMinutes())) return false;
  if (!cron.hour.has(at.getUTCHours())) return false;
  if (!cron.month.has(at.getUTCMonth() + 1)) return false;

  const domHit = cron.dayOfMonth.has(at.getUTCDate());
  const dowHit = cron.dayOfWeek.has(at.getUTCDay());

  if (cron.domRestricted && cron.dowRestricted) return domHit || dowHit;
  if (cron.domRestricted) return domHit;
  if (cron.dowRestricted) return dowHit;
  return true;
}

/** Convenience: compile and match in one call. */
export function isDue(expression: string, at: Date): boolean {
  return matches(compileCron(expression), at);
}
