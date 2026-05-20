/**
 * GET /api/cron/audit-retention
 *
 * Periodic Vercel cron. Prunes `audit_logs` rows according to the
 * explicit retention allowlist in `src/lib/audit-retention.ts`.
 *
 * Recommended schedule: every 6 hours. The MAX_ROWS_PER_PRUNE cap
 * means a large backlog drains incrementally — one tick removes up
 * to 10K rows per action; the next tick continues. Daily would
 * also work but leaves more headroom for storage spikes.
 *
 * Security:
 *   - CRON_SECRET-gated via timingSafeEqual (matches wave-100/102
 *     pattern).
 *   - SAFETY-BY-DEFAULT retention: only actions in the explicit
 *     allowlist are touched. EVIDENCE rows (deletion receipts, DSAR
 *     exports, TRS attestations, login audit trail) are never pruned.
 *   - Per-action LIMIT ensures the cron can't run away even if the
 *     audit_logs table has accumulated millions of stale rows.
 *
 * Failure modes:
 *   - Auth fail → 401
 *   - One action's DELETE throws → that action's `deleted` count is 0
 *     in the response, but other actions continue. The cron always
 *     returns 200 unless auth fails, so a partial failure is visible
 *     in the per-action metrics rather than aborting the whole tick.
 */

import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runRetentionCycle } from "@/lib/audit-retention";
import { createLogger } from "@/lib/logger";

const log = createLogger("cron-audit-retention");

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  // Constant-time secret compare (mirrors wave-100 honeypot-flush
  // and wave-102 federation-pull patterns).
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

  const result = await runRetentionCycle();

  log.info("audit retention cycle complete", {
    totalDeleted: result.totalDeleted,
    durationMs: result.durationMs,
    actionsTouched: result.perAction.length,
    cappedActions: result.perAction.filter((p) => p.capped).length,
  });

  return NextResponse.json({
    ok: true,
    startedAt: result.startedAt,
    durationMs: result.durationMs,
    totalDeleted: result.totalDeleted,
    perAction: result.perAction,
  });
}
