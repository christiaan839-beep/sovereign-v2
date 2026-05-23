/**
 * SOVEREIGN MATRIX — Shared admin UI helpers (Wave 160).
 *
 * Pure formatters + accent mappers + truncators used across the
 * admin pages (war-room, sessions, KG, infrastructure, memories).
 * Extracted so the formatting/categorisation logic is pinned by
 * unit tests without React Testing Library + JSDOM.
 *
 * Each function is a pure transform — no I/O, no React, no DOM.
 */

// ─── Time formatters ──────────────────────────────────────────────

/**
 * Render an ISO timestamp as a compact "HH:MM:SS UTC" tag suitable
 * for tight admin table cells. Falls back to the raw string on bad
 * input — never throws.
 */
export function shortHmsUtc(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return `${String(d.getUTCHours()).padStart(2, "0")}:${String(
      d.getUTCMinutes(),
    ).padStart(2, "0")}:${String(d.getUTCSeconds()).padStart(2, "0")}`;
  } catch {
    return iso;
  }
}

/**
 * "Today: HH:MM UTC" | "YYYY-MM-DD" date display. Same input;
 * collapses today's timestamp to time-only to keep tables scannable.
 */
export function shortDateOrTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const today = new Date();
    if (
      d.getUTCFullYear() === today.getUTCFullYear() &&
      d.getUTCMonth() === today.getUTCMonth() &&
      d.getUTCDate() === today.getUTCDate()
    ) {
      return `${String(d.getUTCHours()).padStart(2, "0")}:${String(
        d.getUTCMinutes(),
      ).padStart(2, "0")} UTC`;
    }
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(
      2,
      "0",
    )}-${String(d.getUTCDate()).padStart(2, "0")}`;
  } catch {
    return iso;
  }
}

/** Minutes elapsed since an ISO timestamp, floored. Returns 0 on bad input. */
export function ageMinutesSince(iso: string, now: number = Date.now()): number {
  try {
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return 0;
    return Math.max(0, Math.floor((now - t) / 60_000));
  } catch {
    return 0;
  }
}

// ─── Truncation ───────────────────────────────────────────────────

/** Truncate to `max` chars + append ellipsis when over. Empty input → "—" sentinel. */
export function truncateOrDash(
  s: string | null | undefined,
  max: number,
): string {
  if (!s) return "—";
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

/** Plain truncate without the dash fallback. Empty input → "". */
export function truncate(s: string | null | undefined, max: number): string {
  if (!s) return "";
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

// ─── Numeric formatting ───────────────────────────────────────────

/** Locale-aware integer formatting. NaN/Infinity → "—". */
export function fmtNumOrDash(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString();
}

/** Percentage formatter from a 0..1 fraction. Out-of-range → clamp + format. */
export function fmtPct01(fraction: number, digits: number = 1): string {
  if (!Number.isFinite(fraction)) return "—%";
  const clamped = Math.max(0, Math.min(1, fraction));
  return `${(clamped * 100).toFixed(digits)}%`;
}

// ─── Accent / status colour mapping ───────────────────────────────

export type Accent =
  | "cyan"
  | "emerald"
  | "red"
  | "amber"
  | "violet"
  | "neutral";

/** Returns the foreground class for an accent. Stable mapping — UI tests pin this. */
export function accentText(accent: Accent): string {
  switch (accent) {
    case "cyan":
      return "text-cyan-300";
    case "emerald":
      return "text-emerald-300";
    case "red":
      return "text-red-300";
    case "amber":
      return "text-amber-300";
    case "violet":
      return "text-violet-300";
    case "neutral":
    default:
      return "text-neutral-300";
  }
}

/** Returns the gradient class for a glass-card accent. */
export function accentGradient(accent: Accent): string {
  switch (accent) {
    case "cyan":
      return "from-cyan-500/[0.08] via-cyan-500/[0.02] to-transparent";
    case "emerald":
      return "from-emerald-500/[0.08] via-emerald-500/[0.02] to-transparent";
    case "red":
      return "from-red-500/[0.08] via-red-500/[0.02] to-transparent";
    case "amber":
      return "from-amber-500/[0.08] via-amber-500/[0.02] to-transparent";
    case "violet":
      return "from-violet-500/[0.08] via-violet-500/[0.02] to-transparent";
    case "neutral":
    default:
      return "from-white/[0.04] via-white/[0.01] to-transparent";
  }
}

// ─── Tick-status mapping (war room) ───────────────────────────────

export type TickStatus = "auto-approved" | "needs-approval" | "blocked";

/** Returns the badge class for a trust verdict. UI consistency pinned by tests. */
export function tickStatusBadgeClass(status: string): string {
  switch (status) {
    case "auto-approved":
      return "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300";
    case "blocked":
      return "border-red-500/30 bg-red-500/[0.08] text-red-300";
    case "needs-approval":
      return "border-amber-500/30 bg-amber-500/[0.08] text-amber-300";
    default:
      return "border-neutral-500/30 bg-neutral-500/[0.08] text-neutral-400";
  }
}

// ─── KG node-type colour mapping ─────────────────────────────────

/** Returns the chip class for a knowledge-graph node type. */
export function nodeTypeColor(type: string): string {
  switch (type) {
    case "agent":
      return "border-cyan-500/30 bg-cyan-500/[0.08] text-cyan-300";
    case "domain":
    case "url":
      return "border-violet-500/30 bg-violet-500/[0.08] text-violet-300";
    case "amount":
      return "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300";
    case "date":
      return "border-amber-500/30 bg-amber-500/[0.08] text-amber-300";
    case "entity":
      return "border-rose-500/30 bg-rose-500/[0.08] text-rose-300";
    case "concept":
    default:
      return "border-neutral-500/30 bg-neutral-500/[0.08] text-neutral-300";
  }
}
