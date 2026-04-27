import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/cron-auth";
import { detectUsageDecline } from "@/lib/churn-detector";
import { auditLog } from "@/lib/audit-log";
import { loggedFireForget } from "@/lib/safe-async";
import { createLogger } from "@/lib/logger";

const log = createLogger("churn-alerts");

/**
 * Daily churn-alert cron — flags paid subscribers whose 30d run count has
 * dropped >= 30% vs the prior 30d window. Each at-risk user is recorded
 * to audit_logs (action: "subscription.change", resource: "churn-risk")
 * so sales/ops can pull a daily worklist without scraping logs.
 *
 * Schedule via vercel.json:
 *   { "path": "/api/_cron/churn-alerts", "schedule": "0 9 * * *" }
 *
 * Auth: CRON_SECRET via verifyCron() — fails closed.
 */
export async function GET(request: Request) {
  const denied = requireCronAuth(request);
  if (denied) return denied;

  const startedAt = Date.now();
  let atRisk;
  try {
    atRisk = await detectUsageDecline({
      thresholdPct: 30,
      windowDays: 30,
      minPriorRuns: 5,
    });
  } catch (err) {
    log.error("churn detector failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Detector failed" }, { status: 500 });
  }

  log.info("churn-alerts run complete", {
    atRiskCount: atRisk.length,
    durationMs: Date.now() - startedAt,
  });

  // Persist each at-risk row to the audit log so sales can query the table
  // directly rather than tailing structured logs.
  for (const row of atRisk) {
    loggedFireForget(
      auditLog({
        userId: row.userId,
        action: "subscription.change",
        resource: "churn-risk",
        details: {
          plan: row.plan,
          currentRuns: row.currentRuns,
          priorRuns: row.priorRuns,
          dropPct: row.dropPct,
        },
      }),
      { source: "churn-alerts", meta: { userId: row.userId } },
    );
  }

  return NextResponse.json({
    ok: true,
    atRiskCount: atRisk.length,
    durationMs: Date.now() - startedAt,
    sample: atRisk.slice(0, 10),
  });
}
