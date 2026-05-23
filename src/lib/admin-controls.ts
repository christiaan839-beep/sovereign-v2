/**
 * SOVEREIGN MATRIX — Admin agent controls (Wave 156).
 *
 * Pure-function helpers + DB writers for the operator's "kill /
 * mark-stuck / re-run" surface over the persistent agent_sessions
 * table (Wave 126). Without this, the war room is read-only; with
 * it, the operator can intervene on an in-flight loop.
 *
 * What it does:
 *   - markSessionAbandoned(sessionId, userId) — flips status to
 *     "abandoned" so the cleanup cron stops counting it as stuck
 *   - markSessionFailed(sessionId, userId, reason)
 *   - extendSessionTtl(sessionId, userId, addMinutes)
 *   - cleanupStaleSessions(staleAfterMinutes) — admin-triggered
 *     pass that flips active sessions idle > N minutes → abandoned
 *
 * Each operation is permission-gated: the route layer enforces
 * admin email allowlist; this lib trusts its callers. User-scoped
 * reads/writes preserved from Wave 126.
 *
 * Pure-function selectors:
 *   - normalizeAction(raw) — coerces user input to a valid action
 *   - validateTtlExtension(minutes) — bounds-checks the TTL bump
 */

import { db } from "@/db";
import { agentSessions } from "@/db/schema";
import { eq, and, lt, isNotNull, sql as drizzleSql } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin-controls");

const VALID_ACTIONS = ["abandon", "fail", "extend"] as const;
export type SessionAction = (typeof VALID_ACTIONS)[number];

/** Pure: coerce user input to a valid action or null. */
export function normalizeAction(
  raw: string | null | undefined,
): SessionAction | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  return (VALID_ACTIONS as readonly string[]).includes(trimmed)
    ? (trimmed as SessionAction)
    : null;
}

/** Pure: clamp a TTL bump to [1, 720] minutes (max 12h). */
export function validateTtlExtension(minutes: number): number | null {
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 720) return null;
  return Math.floor(minutes);
}

function isMissingTableError(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  const msg = err instanceof Error ? err.message : String(err);
  return code === "42P01" || /does not exist/.test(msg);
}

export interface ControlResult {
  ok: boolean;
  /** Number of rows the action affected. */
  affected: number;
  error?: string;
}

/**
 * Flip a session's status to "abandoned". Best-effort. Returns
 * `{ ok: false }` when:
 *   - sessionId or userId is missing
 *   - the row doesn't belong to that user
 *   - the agent_sessions table is missing
 */
export async function markSessionAbandoned(
  sessionId: string,
  userId: string,
): Promise<ControlResult> {
  if (!sessionId || !userId) {
    return { ok: false, affected: 0, error: "sessionId + userId required" };
  }
  try {
    const r = await db
      .update(agentSessions)
      .set({ status: "abandoned", lastTouchedAt: new Date() })
      .where(
        and(eq(agentSessions.id, sessionId), eq(agentSessions.userId, userId)),
      )
      .returning({ id: agentSessions.id });
    return { ok: r.length > 0, affected: r.length };
  } catch (err) {
    if (isMissingTableError(err)) {
      return { ok: false, affected: 0, error: "agent_sessions missing" };
    }
    log.warn("markSessionAbandoned failed", { error: String(err) });
    return { ok: false, affected: 0, error: "db-error" };
  }
}

/** Flip to "failed" with a reason recorded in the session state blob. */
export async function markSessionFailed(
  sessionId: string,
  userId: string,
  reason: string,
): Promise<ControlResult> {
  if (!sessionId || !userId) {
    return { ok: false, affected: 0, error: "sessionId + userId required" };
  }
  const trimmedReason = (reason ?? "").slice(0, 400);
  try {
    const r = await db
      .update(agentSessions)
      .set({
        status: "failed",
        state: JSON.stringify({
          failedReason: trimmedReason,
          failedAt: new Date().toISOString(),
        }),
        lastTouchedAt: new Date(),
      })
      .where(
        and(eq(agentSessions.id, sessionId), eq(agentSessions.userId, userId)),
      )
      .returning({ id: agentSessions.id });
    return { ok: r.length > 0, affected: r.length };
  } catch (err) {
    if (isMissingTableError(err)) {
      return { ok: false, affected: 0, error: "agent_sessions missing" };
    }
    log.warn("markSessionFailed failed", { error: String(err) });
    return { ok: false, affected: 0, error: "db-error" };
  }
}

/** Push expiresAt forward by `addMinutes`. */
export async function extendSessionTtl(
  sessionId: string,
  userId: string,
  addMinutes: number,
): Promise<ControlResult> {
  const mins = validateTtlExtension(addMinutes);
  if (mins == null) {
    return { ok: false, affected: 0, error: "addMinutes must be 1..720" };
  }
  if (!sessionId || !userId) {
    return { ok: false, affected: 0, error: "sessionId + userId required" };
  }
  try {
    const now = Date.now();
    const newExpiry = new Date(now + mins * 60_000);
    const r = await db
      .update(agentSessions)
      .set({
        expiresAt: newExpiry,
        lastTouchedAt: new Date(),
      })
      .where(
        and(eq(agentSessions.id, sessionId), eq(agentSessions.userId, userId)),
      )
      .returning({ id: agentSessions.id });
    return { ok: r.length > 0, affected: r.length };
  } catch (err) {
    if (isMissingTableError(err)) {
      return { ok: false, affected: 0, error: "agent_sessions missing" };
    }
    log.warn("extendSessionTtl failed", { error: String(err) });
    return { ok: false, affected: 0, error: "db-error" };
  }
}

/**
 * Admin-only sweep — flips ALL active sessions whose lastTouchedAt
 * is older than `staleAfterMinutes` to status="abandoned".
 *
 * No userId scope (admin-only sweep). Useful for nightly cleanup
 * or one-shot triage when the war room shows N stuck sessions.
 *
 * Returns the number of sessions flipped.
 */
export async function cleanupStaleSessions(
  staleAfterMinutes: number = 30,
): Promise<{ ok: boolean; flipped: number; error?: string }> {
  const cutoffMin = Math.min(Math.max(staleAfterMinutes, 5), 1440);
  const cutoff = new Date(Date.now() - cutoffMin * 60_000);
  try {
    const r = await db
      .update(agentSessions)
      .set({ status: "abandoned", lastTouchedAt: new Date() })
      .where(
        and(
          eq(agentSessions.status, "active"),
          lt(agentSessions.lastTouchedAt, cutoff),
        ),
      )
      .returning({ id: agentSessions.id });
    return { ok: true, flipped: r.length };
  } catch (err) {
    if (isMissingTableError(err)) {
      return { ok: false, flipped: 0, error: "agent_sessions missing" };
    }
    log.warn("cleanupStaleSessions failed", { error: String(err) });
    return { ok: false, flipped: 0, error: "db-error" };
  }
}

/** Admin-only count of currently expired-but-active sessions. */
export async function countExpiredActive(): Promise<number> {
  try {
    const r = await db
      .select({ id: agentSessions.id })
      .from(agentSessions)
      .where(
        and(
          eq(agentSessions.status, "active"),
          isNotNull(agentSessions.expiresAt),
          lt(agentSessions.expiresAt, drizzleSql`now()`),
        ),
      );
    return r.length;
  } catch {
    return 0;
  }
}
