import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { evalRuns, evalRunResults } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

/**
 * GET /api/admin/eval-health
 *
 * Admin-only. Returns the last 30 eval runs with their rolled-up
 * pass rates + the per-eval breakdown from the most recent run.
 * Used by /dashboard/admin/eval-health to render trend charts +
 * "which evals are currently failing" table.
 */
export async function GET() {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;

  const runs = await db
    .select({
      id: evalRuns.id,
      startedAt: evalRuns.startedAt,
      completedAt: evalRuns.completedAt,
      trigger: evalRuns.trigger,
      total: evalRuns.total,
      passed: evalRuns.passed,
      failed: evalRuns.failed,
      skipped: evalRuns.skipped,
      passRate: evalRuns.passRate,
      durationMs: evalRuns.durationMs,
    })
    .from(evalRuns)
    .orderBy(desc(evalRuns.startedAt))
    .limit(30);

  const latestId = runs[0]?.id;
  let latestResults: typeof evalRunResults.$inferSelect[] = [];
  if (latestId) {
    latestResults = await db
      .select()
      .from(evalRunResults)
      .where(eq(evalRunResults.runId, latestId));
  }

  return NextResponse.json({
    runs: runs.map((r) => ({
      ...r,
      passRate: Number(r.passRate ?? "0"),
    })),
    latestResults,
  });
}
