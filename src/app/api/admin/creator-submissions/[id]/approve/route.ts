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

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(
  _request: Request,
  ctx: RouteContext,
): Promise<Response> {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;

  const { id } = await ctx.params;

  const result = await approveSamSubmission(id, gate.userId);

  if (result.ok && result.row) {
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
