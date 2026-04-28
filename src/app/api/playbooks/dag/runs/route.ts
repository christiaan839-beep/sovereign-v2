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

/**
 * Query params (all optional):
 *   - dagId    UUID — filter to a single playbook
 *   - status   running|completed|failed — filter by terminal state
 *   - before   ISO timestamp — pagination cursor (rows older than this)
 *   - limit    1..100 — page size (default 20)
 *
 * Response:
 *   { success: true, runs: [...], nextCursor: ISO|null }
 *
 * `nextCursor` is null when there are no more rows; otherwise pass
 * it back as `before` for the next page.
 */
const STATUS_VALUES = ["running", "completed", "failed"] as const;
type StatusValue = (typeof STATUS_VALUES)[number];

export async function GET(req: Request): Promise<Response> {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const url = new URL(req.url);
  const dagId = url.searchParams.get("dagId") ?? undefined;
  const statusRaw = url.searchParams.get("status") ?? undefined;
  const before = url.searchParams.get("before") ?? undefined;
  const limitStr = url.searchParams.get("limit");
  const limit = limitStr
    ? Math.min(Math.max(1, parseInt(limitStr, 10) || 20), 100)
    : 20;

  // UUID guard for dagId.
  if (
    dagId &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dagId)
  ) {
    return NextResponse.json({ error: "Invalid dagId" }, { status: 400 });
  }

  // Status enum guard — defensive. Bad values return 400 rather than
  // silently dropping the filter and showing all runs.
  let status: StatusValue | undefined;
  if (statusRaw !== undefined) {
    if (!STATUS_VALUES.includes(statusRaw as StatusValue)) {
      return NextResponse.json(
        { error: "Invalid status — expected running|completed|failed" },
        { status: 400 },
      );
    }
    status = statusRaw as StatusValue;
  }

  // ISO timestamp guard — bad cursors return 400 so the client knows
  // to drop them rather than silently paging from the latest row.
  if (before !== undefined && !Number.isFinite(new Date(before).getTime())) {
    return NextResponse.json(
      { error: "Invalid before — expected ISO timestamp" },
      { status: 400 },
    );
  }

  const { runs, nextCursor } = await listDagRuns({
    userId: auth.userId,
    dagId,
    status,
    before,
    limit,
  });

  // Return a leaner shape than SavedDagRun for the list view —
  // dropping results[] and dagSnapshot keeps payload small. Full
  // detail lives at /api/playbooks/dag/runs/[runId].
  const summaries = runs.map((r) => ({
    id: r.id,
    dagId: r.dagId,
    status: r.status,
    nodeCount: r.nodeCount,
    edgeCount: r.edgeCount,
    totalDurationMs: r.totalDurationMs,
    failedAt: r.failedAt,
    progressNodesCompleted: r.progressNodesCompleted,
    createdAt: r.createdAt,
  }));

  return NextResponse.json({ success: true, runs: summaries, nextCursor });
}
