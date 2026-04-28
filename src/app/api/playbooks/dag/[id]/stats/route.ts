/**
 * GET /api/playbooks/dag/[id]/stats — per-DAG aggregate statistics.
 *
 * Returns success rate, p50/p95 duration, last-run telemetry, total
 * run counts. Powers the analytics card on the editor page and a
 * cross-link panel on individual run-detail pages.
 *
 * Auth + ownership check: the store's getDagStats scopes by userId
 * directly, but we ALSO call getDag first to confirm ownership and
 * return a clean 404 (not "stats showing 0 runs") when the DAG is
 * gone or wrong-owner.
 *
 * Read-only — no audit log entry.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { getDag, getDagStats } from "@/lib/playbook-dag-store";

export const runtime = "nodejs";

interface Ctx {
  params: Promise<{ id: string }>;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  // Ownership gate. Without this, a hostile actor could enumerate
  // run counts across DAG ids by issuing this endpoint repeatedly.
  // Same 404 response as "doesn't exist" — no information leak.
  const dag = await getDag({ id, userId: auth.userId });
  if (!dag) {
    return NextResponse.json({ error: "DAG not found" }, { status: 404 });
  }

  const stats = await getDagStats({ dagId: id, userId: auth.userId });

  return NextResponse.json({ success: true, stats });
}
