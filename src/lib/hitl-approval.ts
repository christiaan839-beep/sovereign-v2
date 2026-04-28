/**
 * SOVEREIGN MATRIX — Human-in-the-Loop (HITL) Approval System
 *
 * Pauses agent execution for human approval on high-stakes actions.
 *
 * Round 26 — DURABLE. Pre-R26 the queue lived in a module-level
 * `Map<string, ApprovalRequest>` that vanished on every Vercel
 * cold-start. A user could submit an action, navigate away, come
 * back tomorrow, and find their request had VANISHED — not denied,
 * not timed out, just gone. The /security page surfaced the queue
 * as a forensic artifact, but the underlying data was amnesiac.
 *
 * Now backed by `hitl_approvals` (drizzle/0041). Tenant-scoped via
 * userId on every WHERE. Pruning is opportunistic: getPendingApprovals
 * flips expired rows to 'timeout' inline; the cron sweeper does the
 * bulk catch-up.
 *
 * Flow:
 *   1. Agent triggers action marked "requireApproval" by policy
 *   2. requestApproval() inserts a pending row + Slack notify
 *   3. User approves/denies via /api/approvals
 *   4. waitForApproval polls by id until terminal status (or timeout)
 *
 * EVERY function returns a sane shape on DB unavailable. The
 * graceful no-DB fallback mirrors playbook-dag-store: critical
 * paths never throw, the route translates the result into HTTP.
 */

import { and, desc, eq, lte, sql } from "drizzle-orm";
import { createLogger } from "@/lib/logger";
import { safeFetch } from "@/lib/safe-fetch";

const log = createLogger("hitl-approval");

// ── Types ──

export type ApprovalStatus = "pending" | "approved" | "denied" | "timeout";

export interface ApprovalRequest {
  id: string;
  userId: string;
  agentName: string;
  action: string;
  description: string;
  metadata: Record<string, unknown>;
  status: ApprovalStatus;
  createdAt: number;
  decidedAt?: number;
  decidedBy?: string;
  expiresAt: number;
}

const APPROVAL_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes default

/**
 * Lazy DB import — keeps this module out of the Edge bundle and
 * lets tests stub DATABASE_URL absence to exercise the fallback.
 */
async function getDb() {
  if (!process.env.DATABASE_URL) return null;
  try {
    const { db } = await import("@/db");
    return db;
  } catch {
    return null;
  }
}

/** Map a DB row to the public ApprovalRequest shape. */
function rowToApproval(row: {
  id: string;
  userId: string;
  agentName: string;
  action: string;
  description: string;
  metadata: unknown;
  status: string;
  createdAt: Date;
  expiresAt: Date;
  decidedAt: Date | null;
  decidedBy: string | null;
}): ApprovalRequest {
  return {
    id: row.id,
    userId: row.userId,
    agentName: row.agentName,
    action: row.action,
    description: row.description,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    status: (row.status as ApprovalStatus) ?? "pending",
    createdAt: row.createdAt.getTime(),
    expiresAt: row.expiresAt.getTime(),
    decidedAt: row.decidedAt?.getTime(),
    decidedBy: row.decidedBy ?? undefined,
  };
}

// ── Create Approval Request ──

/**
 * Create a pending approval request and notify the user.
 * Returns the approval ID for polling.
 *
 * Returns "" (empty string) when DB is unavailable — the caller's
 * agent code should treat this as "approval system offline; default
 * deny" rather than blindly proceeding.
 */
export async function requestApproval(options: {
  userId: string;
  agentName: string;
  action: string;
  description: string;
  metadata?: Record<string, unknown>;
  timeoutMs?: number;
}): Promise<string> {
  const id = `apr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const timeoutMs = options.timeoutMs || APPROVAL_TIMEOUT_MS;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + timeoutMs);

  const db = await getDb();
  if (!db) {
    log.warn("Approval system has no DB — request not persisted", {
      agent: options.agentName,
      action: options.action,
    });
    return "";
  }

  try {
    const { hitlApprovals } = await import("@/db/schema");
    await db.insert(hitlApprovals).values({
      id,
      userId: options.userId,
      agentName: options.agentName,
      action: options.action,
      description: options.description,
      metadata: options.metadata ?? {},
      status: "pending",
      createdAt: now,
      expiresAt,
    });
    log.info("Approval requested", {
      id,
      agent: options.agentName,
      action: options.action,
    });
  } catch (err) {
    log.error("Approval insert failed", { id, error: String(err) });
    return "";
  }

  // Best-effort Slack notify. Through safeFetch so a malicious /
  // misconfigured SLACK_WEBHOOK_URL pointing at a private IP can't
  // SSRF us. The notification is opportunistic; a Slack failure
  // doesn't fail the approval request.
  const slackUrl = process.env.SLACK_WEBHOOK_URL;
  if (slackUrl) {
    safeFetch(slackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `*Approval Required* — Agent \`${options.agentName}\` wants to: ${options.description}`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Approval Required*\nAgent \`${options.agentName}\` wants to perform: *${options.action}*\n\n${options.description}\n\n_Expires in ${Math.round(timeoutMs / 60_000)} minutes_`,
            },
          },
        ],
      }),
      timeoutMs: 5000,
      maxRedirects: 0,
    }).catch(() => {
      /* swallow — notification is best-effort */
    });
  }

  return id;
}

// ── Approve/Deny ──

/**
 * Decide a pending request. Tenant-scoped: the WHERE clause includes
 * status='pending' so a re-decide on a terminal row is a no-op (no
 * forensic trail rewrite). Returns false on:
 *   - row missing
 *   - already decided (status != pending)
 *   - DB unavailable
 *
 * Atomic: the UPDATE … WHERE status='pending' clause means two
 * concurrent decisions race-resolve to one winner.
 */
async function decideRequest(
  id: string,
  decidedBy: string,
  newStatus: "approved" | "denied",
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    const { hitlApprovals } = await import("@/db/schema");
    const result = await db
      .update(hitlApprovals)
      .set({
        status: newStatus,
        decidedAt: new Date(),
        decidedBy,
      })
      .where(
        and(eq(hitlApprovals.id, id), eq(hitlApprovals.status, "pending")),
      )
      .returning({ id: hitlApprovals.id });
    if (result.length > 0) {
      log.info(`Approval ${newStatus}`, { id, decidedBy });
      return true;
    }
    return false;
  } catch (err) {
    log.error("Approval decide failed", { id, error: String(err) });
    return false;
  }
}

export async function approveRequest(id: string, decidedBy: string): Promise<boolean> {
  return decideRequest(id, decidedBy, "approved");
}

export async function denyRequest(id: string, decidedBy: string): Promise<boolean> {
  return decideRequest(id, decidedBy, "denied");
}

// ── Poll / Wait ──

/**
 * Wait for an approval decision. Polls every 2 seconds.
 * Returns the final status after decision or timeout.
 *
 * The DB version of this is more honest than the in-memory poll:
 * it survives function recycling. If a user's first invocation of
 * the agent gets killed mid-poll, a subsequent retry can re-poll
 * the same `id` and pick up the existing decision.
 */
export async function waitForApproval(id: string): Promise<ApprovalStatus> {
  const pollInterval = 2000;
  const maxPolls = 300; // 10 minutes at 2s intervals

  for (let i = 0; i < maxPolls; i++) {
    const req = await getApproval(id);
    if (!req) return "denied";

    // Inline timeout check — flips to 'timeout' if the DB-state row
    // is still 'pending' but we're past expires_at. Saves a round
    // through the cron sweeper.
    if (Date.now() >= req.expiresAt && req.status === "pending") {
      await markTimeout(id);
      log.warn("Approval timed out", { id });
      return "timeout";
    }

    if (req.status !== "pending") return req.status;

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  return "timeout";
}

async function markTimeout(id: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    const { hitlApprovals } = await import("@/db/schema");
    await db
      .update(hitlApprovals)
      .set({ status: "timeout", decidedAt: new Date() })
      .where(
        and(eq(hitlApprovals.id, id), eq(hitlApprovals.status, "pending")),
      );
  } catch {
    /* swallow */
  }
}

// ── Query ──

/**
 * Get all pending approvals for a user. Side effect: flips any
 * past-due rows to 'timeout' before returning so callers don't see
 * stale "pending" entries that should already be terminal.
 *
 * Returns [] when DB is unavailable — the dashboard renders an
 * empty queue rather than a stale snapshot.
 */
export async function getPendingApprovals(userId: string): Promise<ApprovalRequest[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    const { hitlApprovals } = await import("@/db/schema");
    // Sweep expired in this user's slice. Bounded to the user's own
    // rows so a high-traffic user doesn't get a slow read while we
    // sweep the whole platform's expired set.
    await db
      .update(hitlApprovals)
      .set({ status: "timeout", decidedAt: new Date() })
      .where(
        and(
          eq(hitlApprovals.userId, userId),
          eq(hitlApprovals.status, "pending"),
          lte(hitlApprovals.expiresAt, new Date()),
        ),
      );

    const rows = await db
      .select()
      .from(hitlApprovals)
      .where(
        and(eq(hitlApprovals.userId, userId), eq(hitlApprovals.status, "pending")),
      )
      .orderBy(desc(hitlApprovals.createdAt))
      .limit(50);
    return rows.map(rowToApproval);
  } catch {
    return [];
  }
}

/**
 * Get approval history for a user. Includes ALL statuses (pending +
 * decided), newest first, capped at `limit`.
 */
export async function getApprovalHistory(
  userId: string,
  limit = 20,
): Promise<ApprovalRequest[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    const { hitlApprovals } = await import("@/db/schema");
    const rows = await db
      .select()
      .from(hitlApprovals)
      .where(eq(hitlApprovals.userId, userId))
      .orderBy(desc(hitlApprovals.createdAt))
      .limit(Math.min(Math.max(1, limit), 200));
    return rows.map(rowToApproval);
  } catch {
    return [];
  }
}

/**
 * Get a specific approval request. NOT tenant-scoped at this layer
 * because the caller (the polling agent) already knows the id was
 * minted for this run. The /api/approvals POST DOES re-check
 * ownership via the userId field returned in the row — the gate is
 * in the route, not here.
 */
export async function getApproval(id: string): Promise<ApprovalRequest | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  try {
    const { hitlApprovals } = await import("@/db/schema");
    const rows = await db
      .select()
      .from(hitlApprovals)
      .where(eq(hitlApprovals.id, id))
      .limit(1);
    return rows[0] ? rowToApproval(rows[0]) : undefined;
  } catch {
    return undefined;
  }
}

// ── Cleanup ──

/**
 * Bulk-flip past-due pending rows to 'timeout'. Called by a cron
 * worker on a 5-minute cadence. Returns the number of rows updated.
 *
 * Tenant-agnostic: this is a system sweep, not a per-user action.
 * The cron handler is auth'd via verifyCron.
 */
export async function pruneApprovals(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  try {
    const { hitlApprovals } = await import("@/db/schema");
    const result = await db
      .update(hitlApprovals)
      .set({ status: "timeout", decidedAt: new Date() })
      .where(
        and(
          eq(hitlApprovals.status, "pending"),
          lte(hitlApprovals.expiresAt, new Date()),
        ),
      )
      .returning({ id: hitlApprovals.id });
    return result.length;
  } catch {
    return 0;
  }
}

/**
 * Round 26 — older-than-24h pending rows that the prune sweep
 * missed (DB outage, etc) get vacuumed by the same cron. Belt and
 * braces against the table growing unbounded.
 */
export async function deleteOldDecidedApprovals(thresholdDays = 90): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  try {
    const { hitlApprovals } = await import("@/db/schema");
    const cutoff = new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000);
    const result = await db
      .delete(hitlApprovals)
      .where(
        and(
          sql`${hitlApprovals.status} != 'pending'`,
          lte(hitlApprovals.createdAt, cutoff),
        ),
      )
      .returning({ id: hitlApprovals.id });
    return result.length;
  } catch {
    return 0;
  }
}
