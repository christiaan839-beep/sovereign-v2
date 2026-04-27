/**
 * GET /api/playbooks/dag/runs/[runId] — single-run detail.
 *
 * Returns the FULL SavedDagRun:
 *   - `dagSnapshot` — the frozen DAG shape that actually executed
 *   - `results[]`   — per-node NodeRunResult with output (possibly
 *                     truncated by the store on insert)
 *   - all metadata (status, durations, failed_at, etc.)
 *
 * Tenant isolation: the store's getDagRun scopes by userId, so
 * passing someone else's runId returns 404 (same response as "not
 * found" — no information leak).
 *
 * Powers the run-detail page at /dashboard/playbooks/runs/[runId].
 * Read-only — no audit log entry.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { getDagRun } from "@/lib/playbook-dag-store";

export const runtime = "nodejs";

interface Ctx {
  params: Promise<{ runId: string }>;
}

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { runId } = await ctx.params;
  if (!runId) {
    return NextResponse.json({ error: "Missing runId" }, { status: 400 });
  }

  // UUID guard — paranoia layer, the store handles invalid uuids by
  // returning null but we'd rather not even hit the DB layer.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(runId)) {
    return NextResponse.json({ error: "Invalid runId" }, { status: 400 });
  }

  const run = await getDagRun({ id: runId, userId: auth.userId });
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, run });
}
