/**
 * APPEALS STORE
 *
 * Typed CRUD for user_appeals. Mirrors the patterns in
 * playbook-dag-store.ts:
 *
 *   - Tenant-scoped via userId in every WHERE
 *   - Graceful no-DB fallback (empty / null returns)
 *   - Never throws to the caller
 *
 * Public/user-facing surface only: reviewer-side mutations
 * (claim / upheld / overturned) live in admin-shaped routes that
 * are out of scope for this codebase.
 */

import { eq, and, desc } from "drizzle-orm";

export type AppealTargetKind = "run" | "output" | "suspension";
export type AppealStatus = "pending" | "reviewing" | "upheld" | "overturned";

export interface SavedAppeal {
  id: string;
  userId: string;
  targetKind: AppealTargetKind;
  targetId: string;
  message: string;
  status: AppealStatus;
  reviewerNotes: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

async function getDb() {
  if (!process.env.DATABASE_URL) return null;
  try {
    const { db } = await import("@/db");
    return db;
  } catch {
    return null;
  }
}

/**
 * Create an appeal. Idempotency by (userId, targetKind, targetId):
 * we don't allow a user to file two pending appeals for the same
 * target — surfaces a single-row state ("you've already appealed
 * this; here's the existing one") instead of a duplicate spam vector.
 *
 * Returns:
 *   { id, created: true }       on a fresh appeal
 *   { id, created: false }      if a pending/reviewing appeal already
 *                                exists for the target (returns the
 *                                existing id)
 *   null                         when DB is unavailable
 */
export async function createAppeal(input: {
  userId: string;
  targetKind: AppealTargetKind;
  targetId: string;
  message: string;
}): Promise<{ id: string; created: boolean } | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const { userAppeals } = await import("@/db/schema");

    // Idempotency check: any existing pending/reviewing appeal for
    // (userId, targetKind, targetId)?
    const existing = await db
      .select({ id: userAppeals.id, status: userAppeals.status })
      .from(userAppeals)
      .where(
        and(
          eq(userAppeals.userId, input.userId),
          eq(userAppeals.targetKind, input.targetKind),
          eq(userAppeals.targetId, input.targetId),
        ),
      )
      .limit(5);
    const stillOpen = existing.find(
      (r) => r.status === "pending" || r.status === "reviewing",
    );
    if (stillOpen) {
      return { id: stillOpen.id, created: false };
    }

    const inserted = await db
      .insert(userAppeals)
      .values({
        userId: input.userId,
        targetKind: input.targetKind,
        targetId: input.targetId,
        message: input.message,
      })
      .returning({ id: userAppeals.id });
    const id = inserted[0]?.id;
    return id ? { id, created: true } : null;
  } catch {
    return null;
  }
}

/**
 * List the user's appeals, newest-filed first. Default limit 50;
 * the dashboard page renders all of them inline.
 */
export async function listAppeals(input: {
  userId: string;
  limit?: number;
}): Promise<{ appeals: SavedAppeal[] }> {
  const db = await getDb();
  if (!db) return { appeals: [] };

  try {
    const { userAppeals } = await import("@/db/schema");
    const limit = Math.min(Math.max(1, input.limit ?? 50), 200);
    const rows = await db
      .select()
      .from(userAppeals)
      .where(eq(userAppeals.userId, input.userId))
      .orderBy(desc(userAppeals.createdAt))
      .limit(limit);
    return { appeals: rows.map(rowToSavedAppeal) };
  } catch {
    return { appeals: [] };
  }
}

function rowToSavedAppeal(row: {
  id: string;
  userId: string;
  targetKind: string;
  targetId: string;
  message: string;
  status: string;
  reviewerNotes: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
}): SavedAppeal {
  return {
    id: row.id,
    userId: row.userId,
    targetKind: row.targetKind as AppealTargetKind,
    targetId: row.targetId,
    message: row.message,
    status: (row.status as AppealStatus) ?? "pending",
    reviewerNotes: row.reviewerNotes,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
  };
}
