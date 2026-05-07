import { NextResponse } from "next/server";
import { db } from "@/db";
import { webhookEvents } from "@/db/schema";
import { lt } from "drizzle-orm";
import { requireCronAuth } from "@/lib/cron-auth";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";

const log = createLogger("webhook-events-cleanup");

/**
 * GET /api/_cron/webhook-events-cleanup
 *
 * Runs weekly. Deletes `webhook_events` rows older than 90 days.
 *
 * Why this cron exists: the idempotency tier-2 store inserts one row
 * per webhook event we ever process. Stripe + PayPal + Yoco etc.
 * collectively shape the table to grow a few thousand rows/month
 * once we have meaningful traffic. None of the providers retry past
 * a 90-day window (most cap at 24-72 hours), so anything older is
 * pure storage cost with zero idempotency value.
 *
 * Without this cron, the table would grow unboundedly. With it, the
 * table self-trims on a fixed window — predictable storage cost.
 *
 * Failure modes:
 *
 *   - `webhook_events` missing (migration 0021 not applied) →
 *     return 200 with `skipped: true`. We never log this as an
 *     error because the migration may genuinely not be applied
 *     yet on a fresh deploy.
 *   - DB unreachable → log warn + return 200 with `error`. The
 *     cron will retry next week; webhook_events doesn't lose
 *     idempotency data when this cron is delayed.
 *
 * Vercel Cron config (vercel.json):
 *   { "path": "/api/_cron/webhook-events-cleanup", "schedule": "0 6 * * 0" }
 *   ↑ Sundays 6:00 UTC — off-peak. The deletion is idempotent,
 *     so a missed run is harmless and a duplicate run is harmless.
 */

const RETENTION_DAYS = 90;

export async function GET(req: Request) {
  const authErr = requireCronAuth(req);
  if (authErr) return authErr;

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  try {
    const result = await db
      .delete(webhookEvents)
      .where(lt(webhookEvents.receivedAt, cutoff))
      .returning({ provider: webhookEvents.provider });

    const deletedByProvider: Record<string, number> = {};
    for (const r of result) {
      deletedByProvider[r.provider] = (deletedByProvider[r.provider] ?? 0) + 1;
    }

    log.info("webhook-events cleanup complete", {
      retentionDays: RETENTION_DAYS,
      deleted: result.length,
      deletedByProvider,
    });

    return NextResponse.json({
      ok: true,
      retentionDays: RETENTION_DAYS,
      deleted: result.length,
      deletedByProvider,
      cutoff: cutoff.toISOString(),
    });
  } catch (err) {
    const pgCode = (err as { code?: string })?.code;
    if (pgCode === "42P01") {
      // webhook_events missing — migration 0021 not applied. Don't
      // treat as failure; the table will exist when the operator
      // runs MIGRATIONS-RUNME.sql.
      return NextResponse.json({
        ok: true,
        skipped: "webhook_events missing",
      });
    }
    log.warn("webhook-events cleanup failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({
      ok: false,
      error: "DB unavailable",
    });
  }
}
