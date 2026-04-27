/**
 * SOVEREIGN MATRIX — Unified DB error handling.
 *
 * Replaces the inconsistent ad-hoc error handling across 10+ routes that
 * each formatted Postgres errors differently (some 503, some empty array,
 * some 404). The reliability audit found this hurt operator clarity (can't
 * distinguish "table not migrated yet" from "permission denied" without
 * sampling logs by route).
 *
 * Usage:
 *   try {
 *     const rows = await db.select()...;
 *   } catch (err) {
 *     return handleDBError(err, { route: "/api/jobs", emptyOnMissing: true });
 *   }
 */
import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("db-error");

const APPLY_HINT = "DATABASE_URL=… npx tsx scripts/apply-pending-migrations.ts";

/** Postgres error codes we know how to translate. */
const PG_TABLE_MISSING = "42P01";
const PG_COLUMN_MISSING = "42703";

interface PgError {
  code?: string;
  message?: string;
}

export function isPgTableMissing(err: unknown): boolean {
  const e = err as PgError;
  return (
    e?.code === PG_TABLE_MISSING ||
    (typeof e?.message === "string" && e.message.includes("does not exist"))
  );
}

export function isPgColumnMissing(err: unknown): boolean {
  const e = err as PgError;
  return e?.code === PG_COLUMN_MISSING;
}

interface HandleDBErrorOptions<T> {
  /** The route path for logging — e.g. "/api/jobs" */
  route: string;
  /** Returned when the table is missing instead of a 503. Use for read-only
   *  endpoints that should silently render an empty list when the migration
   *  hasn't run yet. */
  emptyOnMissing?: T;
}

/**
 * Translate a thrown DB error into a consistent NextResponse.
 *
 * - Table missing (42P01) → 503 with migration hint, or `emptyOnMissing`
 *   when the route prefers a soft fallback.
 * - Column missing (42703) → 503 with the same hint (older deploys hitting
 *   newer schema).
 * - Anything else → 500 with a generic message (we never leak Pg internals).
 */
export function handleDBError<T = never>(
  err: unknown,
  options: HandleDBErrorOptions<T>,
): NextResponse {
  const e = err as PgError;
  const message = e?.message ?? String(err);

  if (isPgTableMissing(err) || isPgColumnMissing(err)) {
    log.warn("schema not migrated", {
      route: options.route,
      code: e?.code,
      message,
    });
    if (options.emptyOnMissing !== undefined) {
      return NextResponse.json(options.emptyOnMissing as object);
    }
    return NextResponse.json(
      {
        error: "Database not fully migrated",
        code: "MIGRATION_REQUIRED",
        hint: APPLY_HINT,
      },
      { status: 503 },
    );
  }

  // Anything else is operationally interesting — log it and return generic 500.
  log.error("db error", { route: options.route, message });
  return NextResponse.json(
    { error: "Internal database error", code: "DB_ERROR" },
    { status: 500 },
  );
}
