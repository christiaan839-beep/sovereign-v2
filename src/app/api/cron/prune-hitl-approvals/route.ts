/**
 * GET /api/cron/prune-hitl-approvals
 *
 * Vercel Cron — runs every 5 minutes. Two responsibilities:
 *
 *   1. Flip past-due pending approvals to 'timeout'. The lib's
 *      getPendingApprovals does this opportunistically per-user
 *      already, but the cron catches users who never poll (e.g. a
 *      headless agent that requested approval and crashed).
 *
 *   2. Vacuum old terminal approvals (>90 days). Bounded retention
 *      keeps the table cheap. Audit forensics for the relevant
 *      window survive in audit_logs (the SHA-256 hash chain).
 *
 * Auth: verifyCron (timing-safe, fail-closed).
 *
 * NEVER returns 5xx for graceful failures. The cron's job is to
 * progress the system; a transient DB error means "0 swept this
 * tick" and Vercel doesn't page on it.
 */

import { NextResponse } from "next/server";
import { pruneApprovals, deleteOldDecidedApprovals } from "@/lib/hitl-approval";
import { verifyCron } from "@/lib/cron-auth";
import { createLogger } from "@/lib/logger";

const log = createLogger("cron:prune-hitl-approvals");

export const runtime = "nodejs";

export async function GET(req: Request) {
  const cronErr = verifyCron(req);
  if (cronErr) return cronErr;

  const [timedOut, deleted] = await Promise.all([
    pruneApprovals(),
    deleteOldDecidedApprovals(90),
  ]);

  if (timedOut > 0 || deleted > 0) {
    log.info("HITL prune tick", { timedOut, deleted });
  }

  return NextResponse.json({
    ok: true,
    timedOut,
    deleted,
    ranAt: new Date().toISOString(),
  });
}
