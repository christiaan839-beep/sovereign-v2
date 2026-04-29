/**
 * GET  /api/admin/hitl/[requestId]
 *   Fetch a multi-stage HITL request with all per-stage state.
 *
 * POST /api/admin/hitl/[requestId]
 *   Record an approve/reject decision on the current pending stage.
 *   Body: { decision: "approve" | "reject", reason?: string }
 *
 * Admin-gated. Audit-logged via the chained audit log.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import {
  getRequestWithStages,
  recordStageDecision,
} from "@/lib/multi-stage-hitl";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin-hitl");

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;

  const { requestId } = await params;
  if (!requestId || requestId.length > 200) {
    return NextResponse.json({ error: "Invalid request id" }, { status: 400 });
  }

  const data = await getRequestWithStages(requestId);
  if (!data) {
    return NextResponse.json(
      { error: "Request not found" },
      { status: 404 },
    );
  }
  return NextResponse.json(data);
}

const DecisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  reason: z.string().min(1).max(1000).optional(),
});

const ERROR_STATUS: Record<string, number> = {
  request_not_found: 404,
  stage_not_found: 404,
  request_already_approved: 409,
  request_already_denied: 409,
  request_already_timeout: 410,
  stage_not_pending: 409,
  db_unavailable: 503,
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;
  const { requestId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = DecisionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await recordStageDecision({
    requestId,
    approver: gate.userId,
    decision: parsed.data.decision,
    reason: parsed.data.reason,
  });

  if (!result.ok) {
    log.info("HITL stage decision rejected", {
      requestId,
      reason: result.reason,
    });
    return NextResponse.json(
      { error: result.reason },
      { status: ERROR_STATUS[result.reason] ?? 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    newRequestStatus: result.newRequestStatus,
    nextStage: result.nextStage,
  });
}
