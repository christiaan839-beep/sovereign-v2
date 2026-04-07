import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getPendingApprovals,
  getApprovalHistory,
  approveRequest,
  denyRequest,
} from "@/lib/hitl-approval";

/**
 * GET /api/approvals
 *
 * Returns pending approvals + recent history for the current user.
 * Used by the NemoClaw Security Command Center to surface the HITL queue.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pending = getPendingApprovals(userId);
  const history = getApprovalHistory(userId, 20);

  // Compute summary stats
  const approved = history.filter(r => r.status === "approved").length;
  const denied = history.filter(r => r.status === "denied").length;
  const timedOut = history.filter(r => r.status === "timeout").length;

  return NextResponse.json({
    pending,
    history,
    stats: {
      pendingCount: pending.length,
      approved,
      denied,
      timedOut,
      total: history.length,
    },
  });
}

/**
 * POST /api/approvals
 *
 * Approve or deny a pending request.
 * Body: { id: string, decision: "approve" | "deny" }
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, decision } = await req.json();

  if (!id || !decision) {
    return NextResponse.json({ error: "Missing id or decision" }, { status: 400 });
  }

  if (decision === "approve") {
    const ok = approveRequest(id, userId);
    return ok
      ? NextResponse.json({ status: "approved", id })
      : NextResponse.json({ error: "Request not found or already decided" }, { status: 404 });
  }

  if (decision === "deny") {
    const ok = denyRequest(id, userId);
    return ok
      ? NextResponse.json({ status: "denied", id })
      : NextResponse.json({ error: "Request not found or already decided" }, { status: 404 });
  }

  return NextResponse.json({ error: "Invalid decision — use 'approve' or 'deny'" }, { status: 400 });
}
