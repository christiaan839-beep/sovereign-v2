import { db } from "@/db";
import { sql } from "drizzle-orm";
import { createLogger } from "@/lib/logger";
import { createHash } from "node:crypto";

const log = createLogger("idempotency");

/**
 * IDEMPOTENCY KEYS — prevent double-processing of non-idempotent requests.
 *
 * Pattern (Stripe-style):
 *   1. Client sends a request with `Idempotency-Key: <uuid>` header
 *   2. Server hashes the key + endpoint, writes an `idempotency_records` row
 *      via INSERT … ON CONFLICT DO NOTHING
 *   3. If row already existed (ON CONFLICT → 0 rows affected), the request
 *      is a replay; server returns the cached response unchanged
 *   4. If new row was inserted, server processes the request and writes
 *      the response body + status back into the row
 *   5. Rows expire after 24 hours (Neon auto-cleanup via scheduled task)
 *
 * Where we use this:
 *   - POST /api/_payments/stripe/refund  — refund endpoint
 *   - POST /api/agents/*                  — paid agent runs (optional; clients
 *     that retry on timeout can send a key to avoid double-billing)
 *
 * NOT used for:
 *   - GET requests (already safe)
 *   - Stripe's INCOMING webhook (Stripe already sends event.id for dedup,
 *     and we already handle that via `stripe_events` table)
 *
 * The idempotency store is a SQL table rather than Redis because:
 *   - Response bodies can be large (>10KB for some agent outputs)
 *   - We want durability — losing an idempotency record means a user
 *     can get charged twice, which is not acceptable
 *   - Upstash Redis has a 1MB value limit
 */

export interface IdempotencyResult<T> {
  /** True if this request was a replay; the response is cached. */
  replay: boolean;
  /** The request's stored response (only present if replay=true). */
  cached?: { status: number; body: T };
  /** Internal key used — caller should pass this to `commit()`. */
  key: string;
}

const TABLE_NAME = "idempotency_records";

/**
 * Normalize the client-supplied key + endpoint into a DB key. Hashing
 * prevents accidentally creating an index bloat from long client keys,
 * and rules out the possibility of a client key overlap across endpoints.
 */
function deriveKey(clientKey: string, endpoint: string): string {
  return createHash("sha256")
    .update(`${endpoint}::${clientKey}`)
    .digest("hex");
}

/**
 * Check whether the incoming request is a replay. If yes, returns the
 * cached response. If no, inserts a pending row so concurrent identical
 * requests see the lock.
 */
export async function beginIdempotent<T = unknown>(
  clientKey: string,
  endpoint: string,
): Promise<IdempotencyResult<T>> {
  const key = deriveKey(clientKey, endpoint);

  try {
    // Attempt to claim the key atomically. If it already exists, the
    // INSERT does nothing and we fall into the "read cached response"
    // path below.
    const claim = await db.execute<{ status: number; body: unknown }>(sql`
      INSERT INTO ${sql.identifier(TABLE_NAME)} (key, endpoint, status)
      VALUES (${key}, ${endpoint}, 'pending')
      ON CONFLICT (key) DO NOTHING
      RETURNING status, body
    `);

    if ((claim as { rowCount?: number }).rowCount && (claim as { rowCount?: number }).rowCount! > 0) {
      // Fresh key — caller must process the request and call commit().
      return { replay: false, key };
    }

    // Conflict — look up the prior response. If it's still "pending",
    // another request is in-flight; return replay=true with no body so
    // the caller can surface a 409-style "already processing" response.
    const existing = await db.execute<{ status: string; http_status: number | null; body: unknown }>(sql`
      SELECT status, http_status, body FROM ${sql.identifier(TABLE_NAME)}
      WHERE key = ${key}
      LIMIT 1
    `);

    const row = Array.isArray(existing) ? existing[0] : (existing as { rows?: unknown[] }).rows?.[0];

    if (!row) {
      // Extremely narrow race: row was deleted between INSERT attempt and
      // SELECT. Retry the claim once.
      return beginIdempotent<T>(clientKey, endpoint);
    }

    const r = row as { status: string; http_status: number | null; body: unknown };
    if (r.status === "pending") {
      // Another worker is still processing. Surface this cleanly.
      return {
        replay: true,
        key,
        cached: {
          status: 409,
          body: { error: "Request already in progress", idempotencyKey: clientKey } as T,
        },
      };
    }

    return {
      replay: true,
      key,
      cached: {
        status: r.http_status ?? 200,
        body: r.body as T,
      },
    };
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "42P01") {
      // idempotency_records table missing. Fail OPEN — we'd rather
      // process the request than silently break payments. The ops
      // team sees this in Sentry and can apply migration 0010.
      log.warn("idempotency_records table missing; idempotency disabled");
      return { replay: false, key };
    }
    log.error("idempotency begin failed", { error: String(err) });
    // Fail open on unexpected errors so the primary flow isn't blocked.
    return { replay: false, key };
  }
}

/**
 * Commit the response body back to the idempotency record so future
 * retries return the same result. Call this AFTER the request is
 * processed but BEFORE returning to the caller.
 */
export async function commitIdempotent(
  key: string,
  httpStatus: number,
  body: unknown,
): Promise<void> {
  try {
    await db.execute(sql`
      UPDATE ${sql.identifier(TABLE_NAME)}
      SET status = 'completed', http_status = ${httpStatus}, body = ${JSON.stringify(body)}::jsonb, completed_at = NOW()
      WHERE key = ${key}
    `);
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "42P01") return; // table missing — already warned
    log.error("idempotency commit failed", { error: String(err) });
  }
}

/**
 * Mark a key as failed so future retries get the cached error rather
 * than running the request again (useful for deterministic failures
 * like "insufficient funds" that will fail the same way next time).
 */
export async function failIdempotent(
  key: string,
  httpStatus: number,
  body: unknown,
): Promise<void> {
  try {
    await db.execute(sql`
      UPDATE ${sql.identifier(TABLE_NAME)}
      SET status = 'failed', http_status = ${httpStatus}, body = ${JSON.stringify(body)}::jsonb, completed_at = NOW()
      WHERE key = ${key}
    `);
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "42P01") return;
    log.error("idempotency fail failed", { error: String(err) });
  }
}

/**
 * Extract the idempotency key from standard HTTP headers. Accepts
 * both `Idempotency-Key` (Stripe-standard) and `X-Idempotency-Key`.
 * Returns null if the key is missing or malformed.
 */
export function extractIdempotencyKey(headers: Headers): string | null {
  const raw = headers.get("idempotency-key") ?? headers.get("x-idempotency-key");
  if (!raw) return null;
  // Reject empty strings and anything longer than Stripe's 255-char limit.
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 255) return null;
  // Allow alphanumeric + dash + underscore (UUID-friendly).
  if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) return null;
  return trimmed;
}
