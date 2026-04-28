/**
 * GET /api/playbooks/dag/[id]/versions/[versionId]
 *
 * Fetch the FULL payload of a specific version. The list endpoint
 * returns lightweight metadata for the sidebar; this is what the
 * editor calls when the user clicks "Preview" or "Restore" — needs
 * the complete `dag` payload to either render a diff or hand off to
 * the restore endpoint.
 *
 * Tenant isolation: getDagVersion enforces userId in the WHERE.
 * Returns 404 on miss OR wrong owner — same response either way
 * (no leak via 403 vs 404). The [id] param is included in the URL
 * shape for routing clarity but the version's own dagId carries
 * the source of truth — we cross-check to refuse mismatched URLs
 * (someone trying `/api/playbooks/dag/<other-dag>/versions/<this-version>`).
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { getDagVersion } from "@/lib/playbook-dag-store";

export const runtime = "nodejs";

interface Ctx {
  params: Promise<{ id: string; versionId: string }>;
}

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const userId = auth.userId;

  const { id, versionId } = await ctx.params;
  if (!id || !versionId) {
    return NextResponse.json({ error: "Missing id or versionId" }, { status: 400 });
  }

  const version = await getDagVersion({ versionId, userId });
  if (!version) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  // Cross-check the URL's [id] against the version's own dagId. A
  // hostile URL like /dag/<other-id>/versions/<this-version> shouldn't
  // succeed even if the user owns the version row — the URL contract
  // says "this version belongs to this DAG" and we honour it.
  if (version.dagId !== id) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, version });
}
