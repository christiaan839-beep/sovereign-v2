/**
 * GET /api/playbooks/dag/runs — list recent DAG executions for the user.
 *
 * Powers:
 *   - Dashboard `<RecentDagRuns>` widget (no filter — last 20 runs)
 *   - Editor "previous runs" sidebar (filtered by ?dagId=<uuid>)
 *
 * Each row is the SavedDagRun shape from playbook-dag-store.ts. The
 * `results` JSONB is the per-node NodeRunResult[] with truncated
 * outputs (clipped at 32KB per node by the store on insert).
 *
 * Read-only endpoint — no audit log entry. Audit log is for state
 * changes; reads are tracked in access logs / Vercel analytics.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { listDagRuns } from "@/lib/playbook-dag-store";

export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const url = new URL(req.url);
  const dagId = url.searchParams.get("dagId") ?? undefined;
  const limitStr = url.searchParams.get("limit");
  const limit = limitStr ? Math.min(Math.max(1, parseInt(limitStr, 10) || 20), 100) : 20;

  // UUID guard so a bogus dagId doesn't reach the store layer. This
  // is paranoia — the store handles invalid uuids by returning empty
  // — but cheap to enforce at the edge.
  if (dagId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dagId)) {
    return NextResponse.json({ error: "Invalid dagId" }, { status: 400 });
  }

  const { runs } = await listDagRuns({
    userId: auth.userId,
    dagId,
    limit,
  });

  // Return a leaner shape than SavedDagRun for the list view —
  // dropping results[] and dagSnapshot keeps payload small. Full
  // detail lives at /api/playbooks/dag/runs/[runId] when we add it.
  const summaries = runs.map((r) => ({
    id: r.id,
    dagId: r.dagId,
    status: r.status,
    nodeCount: r.nodeCount,
    edgeCount: r.edgeCount,
    totalDurationMs: r.totalDurationMs,
    failedAt: r.failedAt,
    createdAt: r.createdAt,
  }));

  return NextResponse.json({ success: true, runs: summaries });
}
