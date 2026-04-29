/**
 * POST /api/admin/audit/export
 *
 * Round 45 — customer-managed audit-log export. Tenant-scoped,
 * Ed25519-signed batches that customers store in their own S3 /
 * GCS / blob storage and verify offline with `@sovereign/inspector`.
 *
 * Auth: Clerk-authenticated. ALWAYS tenant-scoped — a user can
 * only export their OWN userId's audit rows. Defense-in-depth
 * via `isOwnedByTenant` guard before signing.
 *
 * Body:
 *   {
 *     since?: ISO 8601,
 *     until?: ISO 8601,
 *     limit?: number (max 10000)
 *   }
 *
 * Returns: SignedAuditExport (see src/lib/audit-export.ts)
 *
 * Customer verification:
 *   sovereign-inspect audit-export-verify < export.json
 *
 * The platform CANNOT lie about a customer's audit history once
 * the export is signed. The customer holds the data, the math
 * verifies it, and Sovereign's continued existence is irrelevant
 * to the historical-record integrity.
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import {
  signAuditBatch,
  computeBatchRoot,
  isOwnedByTenant,
  type ExportedAuditRow,
} from "@/lib/audit-export";
import { getPlatformSigningKey } from "@/lib/reliability-attestation";
import { createLogger } from "@/lib/logger";

const log = createLogger("audit-export");

export const runtime = "nodejs";
export const maxDuration = 30;

const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 10000;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 503 },
    );
  }

  let body: { since?: string; until?: string; limit?: number } = {};
  try {
    body = await req.json();
  } catch {
    // Empty body is fine — defaults apply.
  }

  // Parse + bound the limit.
  const limit = Math.min(
    Math.max(typeof body.limit === "number" ? body.limit : DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  );

  // Parse window. Invalid dates are silently ignored (defaults to "all").
  let windowStart: Date | null = null;
  let windowEnd: Date | null = null;
  if (body.since) {
    const d = new Date(body.since);
    if (!isNaN(d.getTime())) windowStart = d;
  }
  if (body.until) {
    const d = new Date(body.until);
    if (!isNaN(d.getTime())) windowEnd = d;
  }

  try {
    const { db } = await import("@/db");
    const { auditLogs } = await import("@/db/schema");

    // Build the query. ALWAYS filter by userId — that's the tenant
    // scope guarantee. The window is optional.
    const conditions = [eq(auditLogs.userId, userId)];
    if (windowStart) conditions.push(gte(auditLogs.createdAt, windowStart));
    if (windowEnd) conditions.push(lt(auditLogs.createdAt, windowEnd));

    // Use raw SQL for prev_hash + row_hash since they're not in the
    // Drizzle schema typing yet (R26 migration added them post-schema).
    // We still use Drizzle for the WHERE clause via the conditions
    // array; but we read the row shape with sql<>.
    const rawRows = await db.execute<{
      id: string;
      user_id: string;
      action: string;
      resource: string | null;
      details: string | null;
      ip_address: string | null;
      created_at: Date;
      prev_hash: string | null;
      row_hash: string | null;
    }>(
      sql`
        SELECT id, user_id, action, resource, details, ip_address,
               created_at, prev_hash, row_hash
        FROM audit_logs
        WHERE user_id = ${userId}
          ${windowStart ? sql`AND created_at >= ${windowStart}` : sql``}
          ${windowEnd ? sql`AND created_at < ${windowEnd}` : sql``}
        ORDER BY created_at ASC
        LIMIT ${limit}
      `,
    );

    // Drizzle's execute returns either an object with rows or an
    // array depending on the driver; normalize.
    const rowsArr: typeof rawRows extends { rows: infer R } ? R : typeof rawRows =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Array.isArray(rawRows) ? rawRows : (rawRows as any).rows ?? [];

    const rows: ExportedAuditRow[] = rowsArr.map((r) => ({
      id: r.id,
      userId: r.user_id,
      action: r.action,
      resource: r.resource,
      details: r.details,
      ipAddress: r.ip_address,
      createdAt: r.created_at instanceof Date
        ? r.created_at.toISOString()
        : new Date(r.created_at).toISOString(),
      prevHash: r.prev_hash,
      rowHash: r.row_hash,
    }));

    // Defense-in-depth: every row must belong to the tenant.
    // If any row leaks through (would be a SQL bug), refuse to sign
    // — never publish a cross-tenant export.
    for (const row of rows) {
      if (!isOwnedByTenant(row, userId)) {
        log.error("Cross-tenant row leaked through filter", {
          userId,
          rowId: row.id,
          rowUserId: row.userId,
        });
        return NextResponse.json(
          { error: "Internal export integrity check failed; export refused." },
          { status: 500 },
        );
      }
    }

    const exportedAt = new Date().toISOString();
    const batchRoot = computeBatchRoot(rows);
    const batch = {
      userId,
      windowStart: windowStart?.toISOString() ?? null,
      windowEnd: windowEnd?.toISOString() ?? null,
      rowCount: rows.length,
      rows,
      batchRoot,
      exportedAt,
    };

    const { privateKey, publicKey, source } = getPlatformSigningKey();
    if (source === "cached_dev") {
      log.warn(
        "Signing audit export with EPHEMERAL dev key. " +
          "Set SOVEREIGN_PLATFORM_PRIVATE_KEY + SOVEREIGN_PLATFORM_PUBLIC_KEY " +
          "for production exports the customer can verify against a stable key.",
      );
    }

    const signed = signAuditBatch({
      batch,
      platformPrivateKey: privateKey,
      platformPublicKey: publicKey,
    });

    return NextResponse.json(
      {
        export: signed,
        verificationNote:
          "This export is Ed25519-signed. Verify offline with " +
          "`sovereign-inspect audit-export-verify < export.json`. The platform " +
          "cannot fabricate this — math is the truth.",
        verifierCommand:
          "sovereign-inspect audit-export-verify < your-saved-export.json",
      },
      { status: 200 },
    );
  } catch (err) {
    log.error("Audit export failed", { userId, error: String(err) });
    return NextResponse.json(
      { error: "Failed to produce audit export" },
      { status: 500 },
    );
  }
}
