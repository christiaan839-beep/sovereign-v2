/**
 * GET /api/privacy/deletion-receipt/:ticketId
 *
 * Public, open-CORS, rate-limited. Returns the signed deletion receipt
 * for a given ticketId so a former data subject (or their regulator)
 * can verify the GDPR Art. 17 / POPIA §24 erasure happened.
 *
 * Verification flow for the data subject:
 *   1. Fetch this endpoint with the ticketId returned by /api/me/delete.
 *   2. Recompute sha256(your_former_userId) — must equal subjectCommitment.
 *   3. Recompute sha256(your_former_email.toLowerCase()) — must equal
 *      emailCommitment.
 *   4. Verify mldsa65Sig against the public key at
 *      /.well-known/sovereign-receipts/mldsa65.b64.
 *
 * Returns 404 (generic message) when:
 *   - the ticketId shape is invalid
 *   - no deletion receipt exists for that ticketId
 *   - the audit_logs table is unavailable on this deploy
 *
 * Matches the wave-95/96 pattern: same 404 message for every not-found
 * path so unauthenticated probes can't fingerprint deploy state.
 */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";

const log = createLogger("deletion-receipt-fetch");

export const revalidate = 60;

// Per-IP limit. The audit_logs lookup without an index on
// (action, resource) is scan-shaped; the limiter caps unauthenticated
// enumeration cost on the deletion-receipt namespace.
const limiter = rateLimit({ interval: 60, limit: 20 });

const NOT_FOUND = (msg: string) =>
  NextResponse.json(
    { error: msg },
    {
      status: 404,
      headers: {
        "Access-Control-Allow-Origin": "*",
        // no-store on 404 — wave-97 security finding L1. A CDN that
        // caches the 404 for 60s combined with open CORS lets a
        // browser-side attacker bypass the per-IP limiter by replaying
        // out of cache. Force every 404 back to origin so the limiter
        // is authoritative.
        "Cache-Control": "no-store",
      },
    },
  );

const GENERIC_NOT_FOUND_MSG = "no deletion receipt for this ticket";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ ticketId: string }> },
) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const { ticketId } = await ctx.params;
  if (
    typeof ticketId !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      ticketId,
    )
  ) {
    return NOT_FOUND(GENERIC_NOT_FOUND_MSG);
  }

  let row: { details: string | null; createdAt: Date | null } | undefined;
  try {
    const rows = await db
      .select({
        details: auditLogs.details,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.action, "data.delete-receipt"),
          eq(auditLogs.resource, `deletion:${ticketId}`),
        ),
      )
      .orderBy(desc(auditLogs.createdAt))
      .limit(1);
    row = rows[0];
  } catch (err) {
    log.warn("audit_logs read failed for deletion receipt lookup", {
      ticketId,
      error: String(err),
    });
    return NOT_FOUND(GENERIC_NOT_FOUND_MSG);
  }

  if (!row) {
    return NOT_FOUND(GENERIC_NOT_FOUND_MSG);
  }

  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(row.details ?? "{}") as Record<string, unknown>;
  } catch {
    return NOT_FOUND(GENERIC_NOT_FOUND_MSG);
  }

  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      persistedAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
      schema: parsed.schema ?? "vaos-deletion-event-v1",
      ticketId,
      ts: parsed.ts ?? null,
      subjectKind: parsed.subjectKind ?? null,
      subjectCommitment: parsed.subjectCommitment ?? null,
      emailCommitment: parsed.emailCommitment ?? null,
      legalBasis: parsed.legalBasis ?? null,
      requestedByCommitment: parsed.requestedByCommitment ?? null,
      note: parsed.note ?? null,
      tablesAffected: parsed.tablesAffected ?? null,
      summary: parsed.summary ?? null,
      summaryHash: parsed.summaryHash ?? null,
      mldsa65Sig: parsed.mldsa65Sig ?? null,
      pqEnabled: parsed.pqEnabled ?? false,
      howToVerify:
        "Recompute sha256(your_former_userId) and confirm it equals subjectCommitment. " +
        "Recompute sha256(your_former_email.toLowerCase()) and confirm it equals emailCommitment. " +
        "Verify mldsa65Sig against the public key at /.well-known/sovereign-receipts/mldsa65.b64.",
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=60, s-maxage=60",
        "Content-Type": "application/json; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
