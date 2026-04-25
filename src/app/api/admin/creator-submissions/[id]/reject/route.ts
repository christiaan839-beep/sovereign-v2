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
import { auditLog } from "@/lib/audit-log";

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
    // Audit — moderation rejection. The reason text is part of the
    // audit row (and therefore the hash chain), so a creator disputing
    // "what reason was given for my rejection?" can be answered from
    // the tamper-detected log, not just the DB row that was inserted.
    await auditLog({
      userId: gate.userId,
      action: "admin.submission_reject",
      resource: id,
      details: {
        authorEmail: result.row.authorEmail,
        referenceId: result.row.referenceId ?? null,
        reason: trimmed,
      },
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        ?? request.headers.get("x-real-ip")?.trim()
        ?? undefined,
    });

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
