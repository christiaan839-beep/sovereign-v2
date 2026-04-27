/**
 * /api/playbooks/dag/[id]
 *
 *   GET     — fetch a single saved DAG (returns full dag payload)
 *   DELETE  — soft-delete (status='archived')
 *
 * The editor hydrates from this endpoint when the URL is
 * /dashboard/playbooks/edit/<id> with a real id. URL "new" is a
 * sentinel that means "fresh STARTER_DAG" — the editor never calls
 * GET in that case.
 *
 * Tenant isolation is enforced by the store: passing someone else's
 * id returns 404 (same response as "not found"), no information leak.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { getDag, archiveDag } from "@/lib/playbook-dag-store";
import { auditLog } from "@/lib/audit-log";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";

const log = createLogger("playbooks/dag/[id]");

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const dag = await getDag({ id, userId: auth.userId });
  if (!dag) {
    return NextResponse.json({ error: "DAG not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, dag });
}

export async function DELETE(_req: Request, ctx: Ctx): Promise<Response> {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const userId = auth.userId;

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const result = await archiveDag({ id, userId });
  if (!result.archived) {
    return NextResponse.json(
      { error: "DAG not found or could not be archived" },
      { status: 404 },
    );
  }

  // Soft-delete is still a state change worth auditing. Future
  // forensics may need to see "user X archived DAG Y at time T".
  await auditLog({
    userId,
    action: "settings.update",
    resource: "playbook_dag",
    details: {
      kind: "playbook_dag.archive",
      id,
    },
  });

  log.info("playbook DAG archived", { userId, id });

  return NextResponse.json({ success: true, archived: true });
}
