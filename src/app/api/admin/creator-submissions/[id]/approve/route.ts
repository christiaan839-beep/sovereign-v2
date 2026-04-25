/**
 * POST /api/admin/creator-submissions/[id]/approve
 *
 * Approve a pending SAM v1.0 submission. Idempotent-friendly:
 * returns 409 if the row is already verified (prevents double-click
 * duplicate approvals via stale UI).
 *
 * Auth: requireAdmin() (Clerk + ADMIN_USER_IDS). Non-admins get 404.
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { approveSamSubmission } from "@/lib/admin-submissions";
import { notifyApproved } from "@/lib/creator-emails";
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

  const result = await approveSamSubmission(id, gate.userId);

  if (result.ok && result.row) {
    // Audit — admin moderation action on third-party content. The hash
    // chain in audit-log.ts ensures this can't be silently rewritten if
    // a creator later disputes "did the admin actually approve me?".
    await auditLog({
      userId: gate.userId,
      action: "admin.submission_approve",
      resource: id,
      details: {
        slug: result.row.slug,
        authorEmail: result.row.authorEmail,
        referenceId: result.row.referenceId ?? null,
      },
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        ?? request.headers.get("x-real-ip")?.trim()
        ?? undefined,
    });

    // Fire-and-forget email. We don't await Promise rejection to the
    // HTTP response — the admin action is already persisted; a
    // delivery failure is operator-noise, not blocking. Degrades
    // silently when RESEND_API_KEY is unset.
    void notifyApproved({
      to: result.row.authorEmail,
      displayName: result.row.name,
      slug: result.row.slug,
      referenceId: result.row.referenceId ?? "",
      reviewedBy: gate.userId,
    });

    return NextResponse.json(
      { success: true, submission: result.row },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Map structured error codes → HTTP.
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
