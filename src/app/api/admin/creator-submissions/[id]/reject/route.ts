/**
 * POST /api/admin/creator-submissions/[id]/reject
 *
 * Reject a pending SAM v1.0 submission with a required reason.
 * Idempotent-friendly: returns 409 if the row is already rejected.
 *
 * Body: { "reason": "string, non-empty, <= 1000 chars" }
 *
 * Auth: requireAdmin() (Clerk + ADMIN_USER_IDS). Non-admins get 404.
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { rejectSamSubmission } from "@/lib/admin-submissions";
import { notifyRejected } from "@/lib/creator-emails";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(
  request: Request,
  ctx: RouteContext,
): Promise<Response> {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;

  const { id } = await ctx.params;

  let reason = "";
  try {
    const body = (await request.json()) as { reason?: unknown };
    if (typeof body.reason === "string") reason = body.reason;
  } catch {
    return NextResponse.json(
      { success: false, error: "invalid_json" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const trimmed = reason.trim();
  if (trimmed.length === 0) {
    return NextResponse.json(
      { success: false, error: "reason_required" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (trimmed.length > 1000) {
    return NextResponse.json(
      { success: false, error: "reason_too_long" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  let result;
  try {
    result = await rejectSamSubmission(id, gate.userId, trimmed);
  } catch {
    return NextResponse.json(
      { success: false, error: "reject_failed" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (result.ok && result.row) {
    // Fire-and-forget: tell the creator why, with the reason the admin
    // typed. Rejection emails are the most-read transactional email in
    // any marketplace — creators parse them carefully. `trimmed` is
    // the same validated string that went into the DB.
    void notifyRejected({
      to: result.row.authorEmail,
      displayName: result.row.name,
      referenceId: result.row.referenceId ?? "",
      reason: trimmed,
      reviewedBy: gate.userId,
    });

    return NextResponse.json(
      { success: true, submission: result.row },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }

  const statusByCode: Record<NonNullable<typeof result.error>, number> = {
    not_found: 404,
    already_terminal: 409,
    db_unavailable: 503,
    insert_failed: 500,
  };
  const httpStatus = result.error ? statusByCode[result.error] : 500;

  return NextResponse.json(
    { success: false, error: result.error ?? "unknown" },
    { status: httpStatus, headers: { "Cache-Control": "no-store" } },
  );
}
