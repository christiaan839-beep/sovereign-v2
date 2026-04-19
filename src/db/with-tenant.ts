import { db } from "@/db";
import { sql } from "drizzle-orm";

/**
 * Scope a block of Drizzle queries to a specific tenant (Clerk user id)
 * using Postgres Row-Level Security.
 *
 * How it works
 * ------------
 * 1. We open a transaction.
 * 2. At the top of the transaction, we call
 *      SET LOCAL app.current_user_id = '<userId>'
 *    which writes a session variable scoped to this transaction.
 * 3. Every RLS policy defined in drizzle/0005_row_level_security.sql
 *    reads that variable via `app_current_user_id()` and restricts
 *    visible rows.
 * 4. `SET LOCAL` is auto-discarded when the transaction ends, so
 *    nothing leaks into the next request on the same Neon pooled
 *    connection.
 *
 * Fail-safe behavior
 * ------------------
 * If userId is empty or null we throw — calling withTenant() with no
 * user is almost always a bug (usually an unauthenticated code path).
 * If you genuinely need cross-tenant access (cron jobs, Stripe webhook,
 * migrations) use the service role via DATABASE_URL_SERVICE, not
 * withTenant.
 *
 * Usage
 * -----
 *   const rows = await withTenant(userId, (tx) =>
 *     tx.select().from(playbookRuns)  // WHERE user_id=... enforced by RLS
 *   );
 */
export async function withTenant<T>(
  userId: string,
  handler: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>,
): Promise<T> {
  if (!userId || typeof userId !== "string") {
    throw new Error("withTenant: userId is required and must be a string");
  }

  // Clerk user ids match /^user_[A-Za-z0-9]+$/. We allow the same character
  // set (no `:` `@` `.`) as a belt-and-braces guard against set_config
  // injection. Drizzle parameterizes the value below, but keeping the
  // allowlist tight means a bug that sneaks a wrong-type value through
  // fails loudly instead of silently passing a crafted payload.
  if (!/^[A-Za-z0-9_-]+$/.test(userId)) {
    throw new Error("withTenant: userId contains disallowed characters");
  }

  return db.transaction(async (tx) => {
    // set_config(name, value, is_local) — is_local=true scopes to the
    // current transaction. We use it instead of SET LOCAL because
    // Drizzle's sql`...` interpolation works more reliably with function
    // calls than bare SQL statements.
    await tx.execute(sql`SELECT set_config('app.current_user_id', ${userId}, true)`);
    return handler(tx);
  });
}
