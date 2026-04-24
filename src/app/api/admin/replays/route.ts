/**
 * GET /api/admin/replays
 *
 * Admin-only list of recent agent-replay traces (in-memory store from
 * src/lib/agent-replay.ts — persisted to DB in a later migration).
 *
 * Returns up to `limit` most-recent traces across all users. Used by
 * /admin/replays to show a flyover of recent executions for debug +
 * audit.
 *
 * Auth: requireAdmin() (Clerk + ADMIN_USER_IDS). Non-admins 404.
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getReplay, getUserReplays } from "@/lib/agent-replay";

function clamp(raw: string | null, fallback: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

export async function GET(request: Request): Promise<Response> {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;

  const url = new URL(request.url);
  const limit = clamp(url.searchParams.get("limit"), 50, 200);
  const byUser = url.searchParams.get("userId");
  const replayId = url.searchParams.get("id");

  // Single-replay lookup.
  if (replayId) {
    const trace = getReplay(replayId);
    if (!trace) {
      return NextResponse.json(
        { ok: false, error: "not_found" },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { ok: true, trace },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }

  // User-scoped list (admin surveillance of a specific user's history).
  if (byUser) {
    const traces = getUserReplays(byUser, limit);
    return NextResponse.json(
      { ok: true, count: traces.length, userId: byUser, traces },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Admin's own recent replays. The full-platform list isn't exposed
  // here by default to avoid cross-tenant leakage even for admins —
  // admins must supply a userId to see that user's replays, same
  // pattern a support tool would enforce.
  const traces = getUserReplays(gate.userId, limit);
  return NextResponse.json(
    { ok: true, count: traces.length, userId: gate.userId, traces },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
