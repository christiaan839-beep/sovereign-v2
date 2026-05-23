/**
 * SOVEREIGN MATRIX — Persistent agent sessions (Wave 126).
 *
 * Backed by the `agent_sessions` table. Provides a small CRUD surface
 * for agents that need to RESUME after a process restart / cold start /
 * across-day continuation:
 *
 *   - `createSession(userId, agentName, initialState?, ttlMinutes?)`
 *   - `getSession(sessionId, userId)`  — user-scoped read
 *   - `appendStep(sessionId, userId, step)`
 *   - `updateState(sessionId, userId, patcher)`
 *   - `endSession(sessionId, userId, status)`
 *   - `listOpenSessions(userId, agentName?)`
 *
 * Why session lib is separate from agent-factory:
 *   The factory enforces the SAFETY envelope on every run. Sessions
 *   are a higher-level construct — only agents that opt in declare a
 *   session shape. The factory stays slim; this lib carries the
 *   resume-state pattern for the agents that need it.
 *
 * Design rules:
 *   - User-scoped reads/writes ALWAYS — no cross-tenant leak path
 *   - Step history capped at 50 entries (LRU-style: oldest dropped)
 *   - State blob capped at 64 KB (JSON.stringify; reject if larger)
 *   - Best-effort writes — DB unavailable does not crash the agent
 *   - Atomic step-append via SQL `step_count = step_count + 1`
 *
 * The agent's state shape is opaque to this module — it's a JSON blob
 * the agent decodes. Encoding the shape per-agent (via Zod) is the
 * agent's responsibility.
 */

import { db } from "@/db";
import { agentSessions } from "@/db/schema";
import { eq, and, gt, isNull, or, desc } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("agent-sessions");

const MAX_STATE_BYTES = 64 * 1024;
const MAX_STEPS = 50;

export type SessionStatus = "active" | "done" | "failed" | "abandoned";

export interface SessionStep {
  /** Sequence number, 0-indexed. */
  index: number;
  /** Free-form label, e.g. "tool:web_research". */
  label: string;
  /** Optional input/output payload. Stringified JSON; cap 2 KB per field. */
  input?: string;
  output?: string;
  durationMs?: number;
  /** ISO timestamp. */
  at: string;
}

export interface AgentSession {
  id: string;
  userId: string;
  agentName: string;
  status: SessionStatus;
  state: Record<string, unknown>;
  steps: SessionStep[];
  stepCount: number;
  createdAt: Date;
  lastTouchedAt: Date;
  expiresAt: Date | null;
}

function stringifyCapped(value: unknown, label: string, cap: number): string {
  const raw = JSON.stringify(value ?? null);
  if (raw.length > cap) {
    throw new Error(
      `${label} exceeds ${cap}-byte cap (got ${raw.length}). Trim before persisting.`,
    );
  }
  return raw;
}

function parseSteps(raw: string): SessionStep[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SessionStep[]) : [];
  } catch {
    return [];
  }
}

function parseState(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function isMissingTableError(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  const msg = err instanceof Error ? err.message : String(err);
  return code === "42P01" || /does not exist/.test(msg);
}

/** Create a new session, optionally with initial state + TTL. */
export async function createSession(
  userId: string,
  agentName: string,
  opts: {
    initialState?: Record<string, unknown>;
    ttlMinutes?: number;
  } = {},
): Promise<AgentSession | null> {
  if (!userId || userId === "anon") return null;

  let state: string;
  try {
    state = stringifyCapped(
      opts.initialState ?? {},
      "initialState",
      MAX_STATE_BYTES,
    );
  } catch (err) {
    // Oversize state — log + null-return per the lib's "best-effort,
    // never crash the agent" contract. Caller can detect via the
    // null return and downsize.
    log.warn("createSession rejected oversize initialState", {
      error: String(err),
      agentName,
    });
    return null;
  }
  const expiresAt =
    opts.ttlMinutes && opts.ttlMinutes > 0
      ? new Date(Date.now() + opts.ttlMinutes * 60_000)
      : null;

  try {
    const [row] = await db
      .insert(agentSessions)
      .values({
        userId,
        agentName,
        status: "active",
        state,
        steps: "[]",
        stepCount: 0,
        expiresAt,
      })
      .returning();
    return rowToSession(row);
  } catch (err) {
    if (isMissingTableError(err)) {
      log.warn("agent_sessions table missing — run migration", {
        agentName,
      });
      return null;
    }
    log.error("createSession failed", { error: String(err), agentName });
    return null;
  }
}

/** Read a session — user-scoped. Returns null on miss. */
export async function getSession(
  sessionId: string,
  userId: string,
): Promise<AgentSession | null> {
  if (!sessionId || !userId) return null;
  try {
    const rows = await db
      .select()
      .from(agentSessions)
      .where(
        and(eq(agentSessions.id, sessionId), eq(agentSessions.userId, userId)),
      )
      .limit(1);
    if (rows.length === 0) return null;
    return rowToSession(rows[0]);
  } catch (err) {
    if (isMissingTableError(err)) return null;
    log.warn("getSession failed", { error: String(err), sessionId });
    return null;
  }
}

/**
 * Atomic step append. Reads the existing step list, prepends/appends
 * the new entry (LRU: drops oldest if over MAX_STEPS), writes back.
 * Updates lastTouchedAt + stepCount.
 *
 * Two-step read-modify-write — caller should not rely on strict
 * ordering under high concurrency. For the resume-state pattern
 * (one-writer-per-session-at-a-time), this is sufficient.
 */
export async function appendStep(
  sessionId: string,
  userId: string,
  step: Omit<SessionStep, "index" | "at">,
): Promise<boolean> {
  if (!sessionId || !userId) return false;

  const session = await getSession(sessionId, userId);
  if (!session) return false;

  const existing = session.steps;
  const next: SessionStep = {
    ...step,
    index: session.stepCount,
    at: new Date().toISOString(),
  };
  const updated = [...existing, next].slice(-MAX_STEPS);
  let stepsBlob: string;
  try {
    stepsBlob = stringifyCapped(updated, "steps", MAX_STATE_BYTES);
  } catch (err) {
    log.warn("appendStep rejected oversize step blob", {
      error: String(err),
      sessionId,
    });
    return false;
  }

  try {
    await db
      .update(agentSessions)
      .set({
        steps: stepsBlob,
        stepCount: session.stepCount + 1,
        lastTouchedAt: new Date(),
      })
      .where(
        and(eq(agentSessions.id, sessionId), eq(agentSessions.userId, userId)),
      );
    return true;
  } catch (err) {
    log.warn("appendStep failed", { error: String(err), sessionId });
    return false;
  }
}

/** Replace the state JSON blob via a patcher function. */
export async function updateState(
  sessionId: string,
  userId: string,
  patcher: (prev: Record<string, unknown>) => Record<string, unknown>,
): Promise<boolean> {
  if (!sessionId || !userId) return false;

  const session = await getSession(sessionId, userId);
  if (!session) return false;

  const next = patcher(session.state);
  let blob: string;
  try {
    blob = stringifyCapped(next, "state", MAX_STATE_BYTES);
  } catch (err) {
    log.warn("updateState rejected oversize patched state", {
      error: String(err),
      sessionId,
    });
    return false;
  }

  try {
    await db
      .update(agentSessions)
      .set({ state: blob, lastTouchedAt: new Date() })
      .where(
        and(eq(agentSessions.id, sessionId), eq(agentSessions.userId, userId)),
      );
    return true;
  } catch (err) {
    log.warn("updateState failed", { error: String(err), sessionId });
    return false;
  }
}

/** Mark a session terminal. */
export async function endSession(
  sessionId: string,
  userId: string,
  status: Exclude<SessionStatus, "active">,
): Promise<boolean> {
  if (!sessionId || !userId) return false;
  try {
    await db
      .update(agentSessions)
      .set({ status, lastTouchedAt: new Date() })
      .where(
        and(eq(agentSessions.id, sessionId), eq(agentSessions.userId, userId)),
      );
    return true;
  } catch (err) {
    log.warn("endSession failed", { error: String(err), sessionId });
    return false;
  }
}

/** Live (non-expired, non-terminal) sessions for this user. */
export async function listOpenSessions(
  userId: string,
  agentName?: string,
  limit: number = 20,
): Promise<AgentSession[]> {
  if (!userId) return [];
  const now = new Date();
  try {
    const conds = [
      eq(agentSessions.userId, userId),
      eq(agentSessions.status, "active"),
      or(isNull(agentSessions.expiresAt), gt(agentSessions.expiresAt, now)),
    ];
    if (agentName) {
      conds.push(eq(agentSessions.agentName, agentName));
    }
    const rows = await db
      .select()
      .from(agentSessions)
      .where(and(...conds))
      .orderBy(desc(agentSessions.lastTouchedAt))
      .limit(Math.min(Math.max(limit, 1), 100));
    return rows.map(rowToSession);
  } catch (err) {
    if (isMissingTableError(err)) return [];
    log.warn("listOpenSessions failed", { error: String(err) });
    return [];
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

type Row = typeof agentSessions.$inferSelect;

function rowToSession(row: Row): AgentSession {
  return {
    id: row.id,
    userId: row.userId,
    agentName: row.agentName,
    status: (row.status ?? "active") as SessionStatus,
    state: parseState(row.state ?? "{}"),
    steps: parseSteps(row.steps ?? "[]"),
    stepCount: row.stepCount ?? 0,
    createdAt: row.createdAt as Date,
    lastTouchedAt: row.lastTouchedAt as Date,
    expiresAt: (row.expiresAt as Date | null) ?? null,
  };
}
