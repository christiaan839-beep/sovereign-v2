/**
 * Helpers for the "Monday-the-batch-is-for" calendar arithmetic the
 * delivery system uses. Single source of truth so the admin UI, the
 * record-delivery API, and the Monday-watchdog cron all agree on
 * what "this week's delivery" means.
 *
 * Tradeoff: we treat all dates as UTC. Customer timezones aren't yet
 * a column on the tenants table; when they are, swap the `now`
 * argument for the customer's local time. For the founder-led phase
 * (US/EU customers, operator in similar TZ), UTC is close enough
 * that the watchdog still pings before 9am-anywhere.
 */

/** Returns YYYY-MM-DD for the Monday of the week containing `now`. */
export function mondayOfWeek(now: Date = new Date()): string {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  // getUTCDay: Sun=0, Mon=1 … Sat=6. We want Monday = 0 offset.
  const dow = d.getUTCDay();
  const offsetToMonday = (dow + 6) % 7; // Sun→6, Mon→0, Tue→1, …
  d.setUTCDate(d.getUTCDate() - offsetToMonday);
  return formatYYYYMMDD(d);
}

/** Returns YYYY-MM-DD for the Monday `weeksAgo` weeks before `now`. */
export function mondayWeeksAgo(
  weeksAgo: number,
  now: Date = new Date(),
): string {
  const monday = new Date(mondayOfWeek(now) + "T00:00:00Z");
  monday.setUTCDate(monday.getUTCDate() - weeksAgo * 7);
  return formatYYYYMMDD(monday);
}

/** Returns the next Monday on or after `now` as YYYY-MM-DD. */
export function nextMonday(now: Date = new Date()): string {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const dow = d.getUTCDay();
  const offset = dow === 1 ? 0 : (8 - dow) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + offset);
  return formatYYYYMMDD(d);
}

/** "2026-05-04" — used everywhere we serialise a date column. */
export function formatYYYYMMDD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Inclusive day diff: days(2026-05-04, 2026-05-08) === 4.
 * Both inputs must be YYYY-MM-DD strings (DB date columns serialise
 * this way already; calling with Date objects is also accepted).
 */
export function daysBetween(a: string | Date, b: string | Date): number {
  const aD = a instanceof Date ? a : new Date(a + "T00:00:00Z");
  const bD = b instanceof Date ? b : new Date(b + "T00:00:00Z");
  const ms = bD.getTime() - aD.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}
