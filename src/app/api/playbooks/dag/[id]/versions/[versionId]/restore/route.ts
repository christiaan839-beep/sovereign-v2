/**
 * POST /api/playbooks/dag/[id]/versions/[versionId]/restore
 *
 * Restore a prior version of a DAG. The fundamental "I broke
 * something — give me yesterday's version back" UX.
 *
 * Restoration is an APPEND, not a mutation. We don't roll the live
 * `dag` column back to the source version's payload — we record a
 * NEW version whose payload IS the source's, with restoredFromVersion
 * pointing back. The timeline reads:
 *
 *   v3: "Initial save"
 *   v4: "Added n3 follow-up node"
 *   v5: "Pre-launch tuning"
 *   v6: "Restored from v3"
 *
 * After this call, the editor's live view rehydrates from v3's shape
 * (because createDagVersion updates the parent's `dag` column), but
 * the history is preserved verbatim. v4 + v5 are still visible in
 * the sidebar; the user can restore back to either at any time.
 *
 * Tenant scoping: restoreDagVersion calls getDagVersion first (which
 * enforces userId), then createDagVersion (which re-verifies
 * ownership of the parent DAG). Both gates fire — defense in depth.
 *
 * Audit-logged with the source + new version numbers so a forensic
 * timeline of "user X restored playbook Y to v3 at time T" survives
 * in the SHA-256 hash chain.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-guard";
import { restoreDagVersion } from "@/lib/playbook-dag-store";
import { auditLog } from "@/lib/audit-log";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";

const log = createLogger("playbooks/dag/versions/restore");

const BodySchema = z
  .object({
    note: z.string().max(280).optional(),
  })
  .optional();

interface Ctx {
  params: Promise<{ id: string; versionId: string }>;
}

export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const userId = auth.userId;

  const { id, versionId } = await ctx.params;
  if (!id || !versionId) {
    return NextResponse.json({ error: "Missing id or versionId" }, { status: 400 });
  }

  // Body is optional — `note` overrides the default
  // "Restored from v<N>" label. Tolerate empty / no body.
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
  const noteOverride = parsed.data?.note;

  const restored = await restoreDagVersion({
    versionId,
    userId,
    note: noteOverride,
  });
  if (!restored) {
    return NextResponse.json(
      { error: "Version not found or could not be restored" },
      { status: 404 },
    );
  }

  // Cross-check: the version we restored should belong to the [id]
  // in the URL. Same defense as the per-version GET — refuse a URL
  // that pairs the wrong dagId with a version the user happens to
  // own. If this fires, it's almost certainly a client bug, not an
  // attack, but the audit trail thanks us either way.
  if (restored.dagId !== id) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  await auditLog({
    userId,
    action: "settings.update",
    resource: "playbook_dag",
    details: {
      kind: "playbook_dag.restore",
      id,
      restoredVersion: restored.version,
      sourceVersion: restored.restoredFromVersion,
      noteAttached: !!noteOverride,
    },
  });

  log.info("playbook DAG version restored", {
    userId,
    dagId: id,
    versionId,
    restoredVersion: restored.version,
    sourceVersion: restored.restoredFromVersion,
  });

  return NextResponse.json({
    success: true,
    version: restored,
  });
}
