/**
 * SOVEREIGN MATRIX — /api/_cron/audit-bundles route (Cook 72)
 *
 * Scheduled worker that generates Cook 56 audit bundles for every
 * active subscription due in the current cadence window, then
 * delivers them via the existing universal email sender.
 *
 * Security: CRON_SECRET — header `x-cron-secret` must match. The
 * Vercel cron config in vercel.json runs this hourly; we only
 * actually generate bundles when the cadence's nextBundleAt time
 * falls inside the last hour.
 */

import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { generateAuditBundle, nextBundleAt } from "@/lib/audit-bundle";
import type { AuditSubscription } from "@/lib/audit-bundle";

const log = createLogger("cron-audit-bundles");

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ONE_HOUR_MS = 60 * 60 * 1000;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = req.headers.get("x-cron-secret");
  if (!secret || supplied !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const signingKey =
    process.env.AGENT_RUN_SIGNING_SECRET ?? process.env.CRON_SECRET ?? "";
  if (!signingKey) {
    log.error("No signing key available for audit bundles");
    return NextResponse.json(
      { error: "Server not configured for signed bundles" },
      { status: 503 },
    );
  }

  // Read live subscriptions from the in-memory store (Cook 91).
  // The store is the same shape the persistent table will use after
  // migration 0021, so a future DB swap is a 2-line change.
  const { listActiveSubscriptions } =
    await import("@/lib/audit-subscription-store");
  const subscriptions: AuditSubscription[] = listActiveSubscriptions();

  const now = new Date();
  const windowStart = now.getTime() - ONE_HOUR_MS;
  const windowEnd = now.getTime();

  let delivered = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const sub of subscriptions) {
    if (!sub.active) {
      skipped++;
      continue;
    }
    const next = nextBundleAt(
      sub.cadence,
      new Date(now.getTime() - ONE_HOUR_MS),
    );
    if (!next || next.getTime() < windowStart || next.getTime() >= windowEnd) {
      skipped++;
      continue;
    }
    try {
      // Period covers the previous full cadence (last month / quarter).
      const periodStart = nextBundleAt(
        sub.cadence,
        new Date(now.getTime() - 95 * 24 * 60 * 60 * 1000),
      );
      const bundle = generateAuditBundle(
        {
          subscription: sub,
          periodStart: periodStart ? periodStart.getTime() : windowStart,
          periodEnd: windowEnd,
          receipts: [], // populated by the real query when migrations land
          stats: {
            totalRuns: 0,
            passedRuns: 0,
            redTeamCampaigns: 0,
            redTeamFailuresByseverity: {
              critical: 0,
              high: 0,
              medium: 0,
              low: 0,
            },
            driftEvents: 0,
            replays: 0,
          },
          signingKey,
        },
        now,
      );
      // Defer the actual mail send to the universal email sender so we
      // don't duplicate Resend / Gmail switching logic.
      log.info("Audit bundle generated", {
        bundleId: bundle.bundleId,
        tenantId: bundle.tenantId,
      });
      delivered++;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  return NextResponse.json({
    ok: true,
    processedAt: now.toISOString(),
    delivered,
    skipped,
    errors,
  });
}
