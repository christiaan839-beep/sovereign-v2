/**
 * Shared time/duration formatters used across the dashboard.
 *
 * Consolidates 7 near-duplicate copies (simplifier audit 2026-04-20).
 * Accepts both ISO strings and epoch millis for `timeAgo`, and an
 * optional custom fallback for `formatDuration` so the call sites
 * that used "—" and the ones that used "N/A" can keep their UX.
 */

/**
 * Human-relative time: "just now" / "5m ago" / "3h ago" / "2d ago".
 * Accepts an ISO 8601 string, a Date, or epoch-ms number.
 */
export function timeAgo(input: string | number | Date): string {
  const ts =
    typeof input === "number"
      ? input
      : input instanceof Date
        ? input.getTime()
        : new Date(input).getTime();

  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Compact duration: "450ms" / "2.3s". Returns the configured
 * fallback string when the input is null/undefined/zero.
 */
export function formatDuration(
  ms: number | null | undefined,
  opts: { fallback?: string } = {},
): string {
  const fallback = opts.fallback ?? "—";
  if (!ms) return fallback;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
