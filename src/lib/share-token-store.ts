/**
 * SHARE TOKEN STORE
 *
 * Public-share links for DAG runs. Tenant-scoped CRUD with the same
 * graceful-no-DB pattern as the other dag stores.
 *
 * SECURITY MODEL:
 *
 *   - Token is the secret in the URL. 128 bits of entropy via
 *     `crypto.randomBytes(16).toString('hex')` — collision-free at
 *     any plausible scale.
 *   - Resolver never returns the SavedDagRun directly; the route
 *     handler does that with the user_id from the token row plugged
 *     into the regular getDagRun() so all other isolation checks
 *     still fire.
 *   - Revocation is soft (revoked_at) — the audit chain has the
 *     event, this table has the index.
 *   - Expiry is enforced at resolve time. Cron sweep is YAGNI for
 *     now; the WHERE clause filters expired rows.
 *
 * EVERY function is fail-soft: missing DB returns null/empty, never
 * throws. The route's job is to translate that into HTTP responses.
 */

import { eq, and, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";

export interface SavedShareToken {
  id: string;
  runId: string;
  userId: string;
  token: string;
  label: string | null;
  expiresAt: string;
  revokedAt: string | null;
  lastAccessedAt: string | null;
  accessCount: number;
  createdAt: string;
  /** Derived — is this share usable right now? */
  active: boolean;
}

/** Default share lifetime. Long enough for diligence flows, short
 *  enough that forgotten links don't hang around forever. Owners can
 *  shorten via the optional ttlDays argument. */
const DEFAULT_TTL_DAYS = 7;

/** Hard ceiling on ttlDays — even the most patient diligence flow
 *  shouldn't need a year-long share. Capping at 90 days keeps the
 *  forgotten-link risk bounded. */
const MAX_TTL_DAYS = 90;

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
 * Generate a fresh share token. The token is 32 hex chars (128 bits).
 * Exposed as a top-level export so tests can drive it deterministically
 * via vi.spyOn.
 */
export function generateShareToken(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Create a share for a run. The caller MUST verify ownership of the
 * run first — this function trusts the caller (route handler) to have
 * called getDagRun() with the right userId before getting here.
 *
 * Returns null when DB is unavailable; the route surfaces 503 in that
 * case so the user knows to retry.
 */
export async function createShareToken(input: {
  runId: string;
  userId: string;
  label?: string;
  ttlDays?: number;
}): Promise<{ token: string; id: string; expiresAt: string } | null> {
  const db = await getDb();
  if (!db) return null;

  const ttlDays = Math.min(
    Math.max(1, input.ttlDays ?? DEFAULT_TTL_DAYS),
    MAX_TTL_DAYS,
  );
  const token = generateShareToken();
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

  try {
    const { dagRunShares } = await import("@/db/schema");
    const inserted = await db
      .insert(dagRunShares)
      .values({
        runId: input.runId,
        userId: input.userId,
        token,
        label: input.label ?? null,
        expiresAt,
      })
      .returning({ id: dagRunShares.id });
    const id = inserted[0]?.id;
    if (!id) return null;
    return { token, id, expiresAt: expiresAt.toISOString() };
  } catch {
    return null;
  }
}

/**
 * List the active+revoked shares for a run. The owner-facing UI uses
 * this to render "Active shares: 2 — last accessed 10 min ago".
 */
export async function listShareTokensForRun(input: {
  runId: string;
  userId: string;
}): Promise<{ shares: SavedShareToken[] }> {
  const db = await getDb();
  if (!db) return { shares: [] };

  try {
    const { dagRunShares } = await import("@/db/schema");
    const rows = await db
      .select()
      .from(dagRunShares)
      .where(
        and(
          eq(dagRunShares.runId, input.runId),
          eq(dagRunShares.userId, input.userId),
        ),
      );
    return { shares: rows.map(rowToSavedShareToken) };
  } catch {
    return { shares: [] };
  }
}

/**
 * Revoke a share (soft-delete). The owner can do this from the run-
 * detail page. We require BOTH the share id AND the userId in the
 * WHERE so a hostile actor can't revoke someone else's share by
 * guessing the id.
 */
export async function revokeShareToken(input: {
  shareId: string;
  userId: string;
}): Promise<{ revoked: boolean }> {
  const db = await getDb();
  if (!db) return { revoked: false };

  try {
    const { dagRunShares } = await import("@/db/schema");
    const result = await db
      .update(dagRunShares)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(dagRunShares.id, input.shareId),
          eq(dagRunShares.userId, input.userId),
        ),
      )
      .returning({ id: dagRunShares.id });
    return { revoked: result.length > 0 };
  } catch {
    return { revoked: false };
  }
}

/**
 * PUBLIC RESOLVER. Used by the unauthenticated /share/[token] page.
 *
 * Returns the share row + the underlying runId IF AND ONLY IF the
 * share is currently usable:
 *   - exists
 *   - not revoked
 *   - not expired
 *
 * Side effect: bumps last_accessed_at + access_count on every
 * successful resolve. This is intentional — the owner-facing UI
 * relies on it for the "last accessed" display.
 *
 * The resolver does NOT return the run itself. The caller (public
 * route handler) plugs the resolved userId into getDagRun() so the
 * regular tenant-isolation logic still runs.
 */
export async function resolveShareToken(input: {
  token: string;
}): Promise<{
  runId: string;
  ownerUserId: string;
  shareId: string;
  label: string | null;
  expiresAt: string;
} | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const { dagRunShares } = await import("@/db/schema");
    const rows = await db
      .select()
      .from(dagRunShares)
      .where(eq(dagRunShares.token, input.token))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    if (row.revokedAt) return null;
    if (row.expiresAt.getTime() < Date.now()) return null;

    // Bump access counters. Best-effort — a slow update shouldn't
    // block the page render; we don't await the result, but we DO
    // catch errors so a transient failure doesn't poison the
    // function's resolved state.
    void db
      .update(dagRunShares)
      .set({
        lastAccessedAt: new Date(),
        accessCount: sql`${dagRunShares.accessCount} + 1`,
      })
      .where(eq(dagRunShares.id, row.id))
      .catch(() => {
        // intentional: observation must not kill resolution
      });

    return {
      runId: row.runId,
      ownerUserId: row.userId,
      shareId: row.id,
      label: row.label,
      expiresAt: row.expiresAt.toISOString(),
    };
  } catch {
    return null;
  }
}

function rowToSavedShareToken(row: {
  id: string;
  runId: string;
  userId: string;
  token: string;
  label: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  lastAccessedAt: Date | null;
  accessCount: number;
  createdAt: Date;
}): SavedShareToken {
  const isExpired = row.expiresAt.getTime() < Date.now();
  const isRevoked = row.revokedAt !== null;
  return {
    id: row.id,
    runId: row.runId,
    userId: row.userId,
    token: row.token,
    label: row.label,
    expiresAt: row.expiresAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
    lastAccessedAt: row.lastAccessedAt?.toISOString() ?? null,
    accessCount: row.accessCount,
    createdAt: row.createdAt.toISOString(),
    active: !isExpired && !isRevoked,
  };
}
