/**
 * SOVEREIGN MATRIX — Admin sessions helpers (Wave 131).
 *
 * Pure utility functions for the /api/admin/sessions route. Extracted
 * so the parsing + bounds-checking logic is testable without hauling
 * Clerk/auth/db/route machinery into the test runner.
 *
 * Used by:
 *   - /api/admin/sessions/route.ts (operator-facing JSON)
 *   - /dashboard/admin/sessions page (consumes JSON output)
 *
 * Each function is a one-shot pure transform — no I/O, no state.
 */

const VALID_STATUSES = new Set([
  "active",
  "done",
  "failed",
  "abandoned",
] as const);

export type SessionStatus = "active" | "done" | "failed" | "abandoned";

/**
 * Clamp the `limit` query param to [1, 200] with a 50 default.
 * Non-numeric / NaN / Infinity inputs collapse to the default.
 */
export function clampLimit(
  raw: string | null,
  opts: { defaultValue?: number; min?: number; max?: number } = {},
): number {
  const def = opts.defaultValue ?? 50;
  const min = opts.min ?? 1;
  const max = opts.max ?? 200;
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(Math.max(n, min), max);
}

/** Returns `s` if it matches a known SessionStatus, else null. */
export function normalizeStatus(s: string | null): SessionStatus | null {
  if (!s) return null;
  const trimmed = s.trim().toLowerCase();
  return VALID_STATUSES.has(trimmed as SessionStatus)
    ? (trimmed as SessionStatus)
    : null;
}

/**
 * Pull the last step's label from an agent_sessions.steps JSON blob.
 * Returns null on:
 *   - malformed JSON
 *   - empty array
 *   - last entry missing a string `label`
 * Truncated to 80 chars to keep table cells terse.
 */
export function parseLastStepLabel(stepsBlob: string): string | null {
  if (!stepsBlob) return null;
  let arr: unknown;
  try {
    arr = JSON.parse(stepsBlob);
  } catch {
    return null;
  }
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const last = arr[arr.length - 1];
  if (
    !last ||
    typeof last !== "object" ||
    typeof (last as { label?: unknown }).label !== "string"
  ) {
    return null;
  }
  return (last as { label: string }).label.slice(0, 80);
}

/** Wave 126 missing-table detection — used to fail soft on the migration. */
export function isMissingTableError(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  if (code === "42P01") return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /does not exist/.test(msg);
}

/**
 * Bucket a session's age (in minutes since lastTouchedAt) into a
 * "freshness" category for stuck-run UI.
 *
 *   < 5  → fresh
 *   5-10 → cooling
 *   > 10 → stuck (admin should investigate if status is still "active")
 */
export type Freshness = "fresh" | "cooling" | "stuck";
export function bucketFreshness(ageMinutes: number): Freshness {
  if (ageMinutes < 5) return "fresh";
  if (ageMinutes <= 10) return "cooling";
  return "stuck";
}
