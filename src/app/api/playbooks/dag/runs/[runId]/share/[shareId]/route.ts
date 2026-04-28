/**
 * DELETE /api/playbooks/dag/runs/[runId]/share/[shareId]
 *
 * Revoke a share. Soft-delete (sets revoked_at). The share row stays
 * for audit; the public resolver immediately stops returning hits.
 *
 * The route requires BOTH runId and shareId in the URL (rather than
 * just shareId) so the URL itself documents which run is affected —
 * useful for diffing audit logs and grepping nginx access logs.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { revokeShareToken } from "@/lib/share-token-store";
import { auditLog } from "@/lib/audit-log";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";

const log = createLogger("playbooks/dag/runs/share/revoke");

interface Ctx {
  params: Promise<{ runId: string; shareId: string }>;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(_req: Request, ctx: Ctx): Promise<Response> {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const userId = auth.userId;

  const { runId, shareId } = await ctx.params;
  if (!UUID_RE.test(runId) || !UUID_RE.test(shareId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  // The store's WHERE includes both shareId AND userId — a hostile
  // actor can't revoke someone else's share by guessing the id.
  const result = await revokeShareToken({ shareId, userId });
  if (!result.revoked) {
    return NextResponse.json(
      { error: "Share not found or already revoked" },
      { status: 404 },
    );
  }

  await auditLog({
    userId,
    action: "settings.update",
    resource: "dag_run_share",
    details: {
      kind: "dag_run_share.revoke",
      shareId,
      runId,
    },
  });

  log.info("dag run share revoked", { userId, shareId, runId });

  return NextResponse.json({ success: true, revoked: true });
}
