/**
 * SOVEREIGN MATRIX — /api/auditor/anchor (audit-2026-05 Wave 9).
 *
 * Public read-side surface for the daily audit-log Bitcoin anchor.
 *
 *   GET /api/auditor/anchor              — latest anchor
 *   GET /api/auditor/anchor?id=<uuid>    — specific anchor by id
 *   GET /api/auditor/anchor?head=<hex>   — anchor that covered a given chainHead
 *
 * No auth required. The anchor is the public-record proof that the
 * audit-log state at attestation time existed and has not been altered
 * since. An external auditor can:
 *   1. Fetch this anchor.
 *   2. Re-derive the chainDigest locally from anything we hand them
 *      (an exported subset of audit_logs).
 *   3. Re-submit the same digest to OpenTimestamps and compare proof
 *      timestamps. If the digest doesn't match what's already anchored,
 *      the audit log has been mutated.
 *
 * Rate-limited 60/min/IP.
 */
import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogAnchors } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { rateLimit } from "@/lib/rate-limit";

const limiter = rateLimit({ interval: 60, limit: 60 });

export async function GET(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const head = url.searchParams.get("head");

  try {
    let row;
    if (id && /^[0-9a-f-]{20,64}$/i.test(id)) {
      [row] = await db
        .select()
        .from(auditLogAnchors)
        .where(eq(auditLogAnchors.id, id))
        .limit(1);
    } else if (head && /^[0-9a-f]{64}$/i.test(head)) {
      [row] = await db
        .select()
        .from(auditLogAnchors)
        .where(eq(auditLogAnchors.chainHead, head))
        .limit(1);
    } else {
      [row] = await db
        .select()
        .from(auditLogAnchors)
        .orderBy(desc(auditLogAnchors.attestedAt))
        .limit(1);
    }
    if (!row) {
      return NextResponse.json({ error: "No anchor found" }, { status: 404 });
    }
    return NextResponse.json(
      {
        id: row.id,
        chainHead: row.chainHead,
        rowCount: row.rowCount,
        ok: row.ok,
        proofs: JSON.parse(row.proofs) as unknown[],
        failures: JSON.parse(row.failures) as unknown[],
        attestedAt: row.attestedAt,
      },
      { headers: { "cache-control": "public, max-age=60" } },
    );
  } catch {
    // audit_log_anchors table missing — surface gracefully
    return NextResponse.json(
      { error: "Anchor service not provisioned" },
      { status: 503 },
    );
  }
}
