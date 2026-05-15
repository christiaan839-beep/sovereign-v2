/**
 * SOVEREIGN MATRIX — Privilege-escalation alerts (Cook 107).
 *
 * Pages on the FIRST occurrence of admin-tier audit events per
 * tenant. Composes with Cook 77 admin allowlist + the existing
 * audit-log writer. The threat model: a non-admin somehow grants
 * themselves admin (via a bug or compromised dev workstation) and
 * uses the grant to dispatch a Tier-3 tool before anyone notices.
 *
 * Pure module — caller injects the pager (Sentry / PagerDuty /
 * Slack). State is per-tenant in-memory; production keys it to the
 * existing audit_logs table once migration 0021 lands.
 */

// ── Public types ──────────────────────────────────────────────────────────

export type PrivilegeEvent =
  | "admin.grant"
  | "admin.revoke"
  | "marketplace.published"
  | "marketplace.connect";

export interface AlertConfig {
  /** Stable tenant identifier (or "global" for platform-wide events). */
  tenantId: string;
  /** Stable user who triggered the event. */
  actorId: string;
  /** Event class. */
  event: PrivilegeEvent;
  /** Optional resource id touched by the event. */
  resource?: string;
  /** Caller-supplied timestamp for determinism. */
  occurredAt: number;
}

export interface AlertOutcome {
  /** True iff the pager was called for this event. */
  paged: boolean;
  /** Reason the pager was NOT called (when paged=false). */
  reason?: "duplicate-event" | "in-quiet-window";
  /** Human-readable message that was sent to the pager. */
  message: string;
}

export type Pager = (
  message: string,
  severity: "info" | "warn" | "crit",
) => Promise<void>;

// ── State (in-memory until audit_logs migration) ──────────────────────────

interface SeenKey {
  tenantId: string;
  actorId: string;
  event: PrivilegeEvent;
}

function keyOf(k: SeenKey): string {
  return `${k.tenantId}|${k.actorId}|${k.event}`;
}

const FIRST_SEEN = new Map<string, number>();
const QUIET_WINDOW_MS = 60 * 60 * 1000; // 1 hour — page once per hour per tenant+actor+event

export function _resetForTests(): void {
  FIRST_SEEN.clear();
}

// ── Severity mapping ──────────────────────────────────────────────────────

const SEVERITY: Record<PrivilegeEvent, "info" | "warn" | "crit"> = {
  "admin.grant": "crit",
  "admin.revoke": "warn",
  "marketplace.published": "info",
  "marketplace.connect": "info",
};

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Decide whether to page + call the pager. Returns the outcome so
 * the caller can log even non-paged events for the audit trail.
 *
 * NEVER throws — a failed pager call returns paged=false with the
 * thrown message in the outcome.
 */
export async function maybeAlert(
  cfg: AlertConfig,
  pager: Pager,
): Promise<AlertOutcome> {
  if (!cfg.tenantId) {
    return {
      paged: false,
      reason: "duplicate-event",
      message: "missing-tenant",
    };
  }
  const key = keyOf(cfg);
  const lastSeen = FIRST_SEEN.get(key);
  if (lastSeen !== undefined && cfg.occurredAt - lastSeen < QUIET_WINDOW_MS) {
    return {
      paged: false,
      reason: "in-quiet-window",
      message: `Suppressed duplicate '${cfg.event}' alert (last seen ${new Date(lastSeen).toISOString()})`,
    };
  }
  FIRST_SEEN.set(key, cfg.occurredAt);
  const severity = SEVERITY[cfg.event] ?? "warn";
  const message = renderMessage(cfg, severity);
  try {
    await pager(message, severity);
  } catch {
    // Pager failed — caller still gets a structured outcome.
    return { paged: false, message };
  }
  return { paged: true, message };
}

function renderMessage(
  cfg: AlertConfig,
  severity: "info" | "warn" | "crit",
): string {
  const ts = new Date(cfg.occurredAt).toISOString();
  const resource = cfg.resource ? ` resource=${cfg.resource}` : "";
  return `[${severity.toUpperCase()}] ${cfg.event} actor=${cfg.actorId} tenant=${cfg.tenantId}${resource} at ${ts}`;
}

export const PRIVILEGE_CONSTANTS = {
  QUIET_WINDOW_MS,
  SEVERITY,
};
