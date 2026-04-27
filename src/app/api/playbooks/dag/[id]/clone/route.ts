/**
 * POST /api/playbooks/dag/[id]/clone — fork an existing DAG.
 *
 * The store's cloneDag() copies the source (after verifying the user
 * owns it) into a new draft row. Returns the new id so the editor
 * can router-push to it immediately.
 *
 * Tenant isolation: getDag inside the store returns null if the
 * source isn't owned by the requester. We surface that as 404 (no
 * leak via 403 vs 404).
 *
 * Audit-logs the clone so a forensic timeline of "playbook X was
 * forked into Y at time T by user Z" survives.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-guard";
import { cloneDag } from "@/lib/playbook-dag-store";
import { auditLog } from "@/lib/audit-log";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";

const log = createLogger("playbooks/dag/clone");

const BodySchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
  })
  .optional();

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const userId = auth.userId;

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  // The body is optional; the only field is `name` for the new DAG.
  // Tolerate empty / no body.
  let body: unknown = {};
  try {
    const text = await req.text();
    if (text.trim()) body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const overrideName = parsed.data?.name;

  const result = await cloneDag({
    sourceId: id,
    userId,
    name: overrideName,
  });
  if (!result) {
    return NextResponse.json(
      { error: "Source DAG not found or could not be cloned" },
      { status: 404 },
    );
  }

  await auditLog({
    userId,
    action: "settings.update",
    resource: "playbook_dag",
    details: {
      kind: "playbook_dag.clone",
      sourceId: id,
      newId: result.id,
      persisted: result.persisted,
    },
  });

  log.info("playbook DAG cloned", {
    userId,
    sourceId: id,
    newId: result.id,
    persisted: result.persisted,
  });

  return NextResponse.json({
    success: true,
    id: result.id,
    persisted: result.persisted,
  });
}
