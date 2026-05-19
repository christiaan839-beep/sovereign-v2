/**
 * GET /api/cron/honeypot-flush
 *
 * Periodic Vercel cron. Reads the recent `honeypot.signal` audit rows,
 * aggregates them per the MIN_DISTINCT_SOURCES + severity gates in
 * src/lib/honeypot-emitter.ts, builds + persists a federation bulletin
 * if any fingerprints qualify.
 *
 * Recommended schedule: every 15-30 minutes. The bulletin TTL is 24h
 * by default, so more frequent flushes mostly produce redundant
 * bulletins; less frequent flushes leave attack signal unbroadcast.
 *
 * Security: CRON_SECRET-gated (same pattern as audit-log-anchor).
 *
 * Failure modes:
 *   - audit_logs unavailable → 503 (operator alert; no bulletin)
 *   - issuer id misconfigured → 412 (cron is healthy, config is not)
 *   - zero qualifying fingerprints → 200 with empty bulletin metric
 *     (this is the steady-state on a deployment with no recent attacks)
 */

import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { and, eq, gt, desc } from "drizzle-orm";
import {
  flushHoneypotBulletin,
  isAutoEmitEnabled,
  MAX_SIGNALS_PER_FLUSH,
  SIGNAL_RETENTION_HOURS,
  type SignalRecord,
} from "@/lib/honeypot-emitter";
import { createLogger } from "@/lib/logger";

const log = createLogger("cron-honeypot-flush");

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  // Constant-time secret compare — wave-100 review M2 fix. The
  // existing audit-log-anchor pattern uses raw `!==`; this route
  // upgrades to timingSafeEqual since cron secrets are long-lived
  // and timing oracles on long-lived secrets are the textbook
  // exploit surface.
  const secret = process.env.CRON_SECRET;
  const supplied = req.headers.get("x-cron-secret");
  if (!secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const a = Buffer.from(supplied ?? "");
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Operator opt-in gate. If federation publishing isn't enabled, the
  // cron silently no-ops with 200 — gives operators a clean rollback
  // path without changing the cron's URL.
  if (!isAutoEmitEnabled()) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "HONEYPOT_AUTO_EMIT not enabled",
    });
  }

  const issuerId = process.env.HONEYPOT_ISSUER_ID;
  if (!issuerId || issuerId.trim().length === 0) {
    log.error("HONEYPOT_ISSUER_ID not configured");
    return NextResponse.json(
      {
        ok: false,
        reason:
          "HONEYPOT_ISSUER_ID must be configured before publishing bulletins",
      },
      { status: 412 },
    );
  }

  // SQL-side retention prefilter — never read signals older than the
  // retention window. Mirrors the same DB-side TTL strategy used by the
  // /api/honeypot/feed route.
  const since = new Date(Date.now() - SIGNAL_RETENTION_HOURS * 3600 * 1000);
  let rows: Array<{ details: string | null }> = [];
  try {
    rows = await db
      .select({ details: auditLogs.details })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.action, "honeypot.signal"),
          gt(auditLogs.createdAt, since),
        ),
      )
      .orderBy(desc(auditLogs.createdAt))
      .limit(MAX_SIGNALS_PER_FLUSH);
  } catch (err) {
    log.error("audit_logs read failed for honeypot-flush", {
      error: String(err),
    });
    return NextResponse.json(
      { ok: false, reason: "audit unavailable" },
      {
        status: 503,
      },
    );
  }

  // Parse each row defensively — drop malformed entries silently so
  // a single bad insert can't break the flush.
  const records: Array<SignalRecord & { ts: string }> = [];
  for (const r of rows) {
    try {
      const parsed = JSON.parse(r.details ?? "{}") as Record<string, unknown>;
      if (
        parsed &&
        typeof parsed.fingerprintId === "string" &&
        typeof parsed.sourceHash === "string" &&
        typeof parsed.ts === "string" &&
        parsed.fingerprint &&
        typeof parsed.fingerprint === "object"
      ) {
        records.push({
          fingerprint: parsed.fingerprint as SignalRecord["fingerprint"],
          fingerprintId: parsed.fingerprintId as string,
          sourceHash: parsed.sourceHash as string,
          ts: parsed.ts as string,
        });
      }
    } catch {
      /* skip malformed */
    }
  }

  const result = await flushHoneypotBulletin(records, issuerId);

  log.info("honeypot flush complete", {
    signalsRead: result.signalsRead,
    fingerprintsAfterAggregate: result.fingerprintsAfterAggregate,
    bulletinPublished: result.bulletinPublished,
  });

  return NextResponse.json({
    ok: true,
    ...result,
  });
}
