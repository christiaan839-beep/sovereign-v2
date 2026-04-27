/**
 * /api/appeals
 *
 *   GET  — list the authenticated user's appeals
 *   POST — file a new appeal
 *
 * Closes FMTI's "user appeal / agent rerun mechanism" subdomain
 * (60% before this round). The replay-verification infra at
 * /api/_replay/verify already provides cryptographic evidence; this
 * endpoint is the user-facing entry to ask for that evidence to
 * be reviewed.
 *
 * Idempotency: posting twice for the same target returns the
 * existing pending/reviewing appeal — no duplicates, no abuse vector.
 *
 * Audit-logged: every filed appeal goes into the SHA-256 hash chain
 * so the policy team has a tamper-evident record of when each
 * appeal arrived.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-guard";
import { createAppeal, listAppeals } from "@/lib/appeals-store";
import { auditLog } from "@/lib/audit-log";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";

const log = createLogger("appeals");

const PostSchema = z.object({
  targetKind: z.enum(["run", "output", "suspension"]),
  // The runId / outputId / accountId being appealed. Untyped string
  // here; the reviewer is responsible for validating the target
  // exists when they pick up the case.
  targetId: z.string().min(1).max(120),
  message: z.string().min(10).max(5000),
});

export async function GET(): Promise<Response> {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { appeals } = await listAppeals({ userId: auth.userId, limit: 50 });
  return NextResponse.json({ success: true, appeals });
}

export async function POST(req: Request): Promise<Response> {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const userId = auth.userId;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await createAppeal({
    userId,
    targetKind: parsed.data.targetKind,
    targetId: parsed.data.targetId,
    message: parsed.data.message,
  });
  if (!result) {
    // DB unavailable. Don't lie to the user — surface 503 so they
    // know to retry later. Filing an appeal is a moment that must
    // not be silently dropped.
    return NextResponse.json(
      {
        error: "Appeals service is temporarily unavailable; please retry",
      },
      { status: 503 },
    );
  }

  await auditLog({
    userId,
    action: "settings.update",
    resource: "user_appeal",
    details: {
      kind: result.created ? "appeal.create" : "appeal.duplicate_returned",
      appealId: result.id,
      targetKind: parsed.data.targetKind,
      targetId: parsed.data.targetId,
    },
  });

  log.info(result.created ? "appeal filed" : "duplicate appeal returned existing id", {
    userId,
    appealId: result.id,
    targetKind: parsed.data.targetKind,
  });

  // 201 on a fresh creation, 200 on an idempotent return so clients
  // can distinguish without parsing the body.
  return NextResponse.json(
    { success: true, ...result },
    { status: result.created ? 201 : 200 },
  );
}
