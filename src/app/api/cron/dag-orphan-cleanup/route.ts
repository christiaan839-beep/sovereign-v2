/**
 * /api/cron/dag-orphan-cleanup — sweep stuck async DAG runs.
 *
 * Schedule: every 5 minutes (registered in vercel.json crons table).
 * Why 5min: the function's after() ceiling is 5 minutes; a row stuck
 * past 10 minutes is definitely dead. Sweeping every 5min means
 * worst-case the user sees a stuck spinner for ~10-15 minutes before
 * the cron flips it to failed. That's an acceptable "ghost run" SLO
 * given how rare hard-timeouts are.
 *
 * What it does:
 *   - Finds runs WHERE status='running' AND last_progress_at < (now - 10min)
 *   - Bulk-marks them status='failed' with failed_at='__orphaned__'
 *     so the run-detail UI distinguishes "agent threw" from "infra ate
 *     the function"
 *   - Audit-logs the sweep IF any rows were reaped, so the SHA-256
 *     chain has a forensic record of orphans
 *
 * Auth: Bearer CRON_SECRET via verifyCron (timing-safe compare). Not a
 * user action — runs at the system level.
 *
 * Both GET and POST supported.
 */

import { NextResponse } from "next/server";
import { verifyCron } from "@/lib/cron-auth";
import { reapOrphanedRuns } from "@/lib/playbook-dag-store";
import { auditLog } from "@/lib/audit-log";
import { createLogger } from "@/lib/logger";

const log = createLogger("cron-dag-orphan-cleanup");

export const runtime = "nodejs";

async function handle(request: Request): Promise<Response> {
  const unauthorized = verifyCron(request);
  if (unauthorized) return unauthorized;

  try {
    const result = await reapOrphanedRuns({
      thresholdMinutes: 10,
      limit: 200,
    });

    if (result.reaped > 0) {
      log.warn("reaped orphaned async DAG runs", {
        count: result.reaped,
        ids: result.rows.map((r) => r.id),
      });

      // One audit-log entry per run reaped, so the SHA-256 chain
      // captures EXACTLY which rows the cron touched. Per-user
      // userId scoping preserves tenant isolation in the trail.
      // Best-effort — a single audit failure shouldn't fail the
      // whole cron run.
      for (const row of result.rows) {
        await auditLog({
          userId: row.userId,
          action: "agent.execute",
          resource: "playbook_dag.run",
          details: {
            kind: "playbook_dag.run.orphan_reaped",
            runId: row.id,
            thresholdMinutes: 10,
          },
        }).catch(() => {
          // intentional swallow — covered by the loop's resilience
        });
      }
    } else {
      // Successful no-op. Logged at debug level by createLogger so it
      // doesn't pollute production logs every 5 minutes — only
      // surfaced when there's actually something to clean up.
      log.debug?.("no orphaned runs found");
    }

    return NextResponse.json({
      ok: true,
      reaped: result.reaped,
      sweptAt: new Date().toISOString(),
    });
  } catch (err) {
    log.error("dag-orphan-cleanup threw", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request): Promise<Response> {
  return handle(request);
}

export async function POST(request: Request): Promise<Response> {
  return handle(request);
}
