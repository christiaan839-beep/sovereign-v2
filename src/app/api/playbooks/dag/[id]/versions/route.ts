/**
 * GET /api/playbooks/dag/[id]/versions
 *
 * Returns the version history for a single DAG, newest-first. Powers
 * the "Version history" sidebar in the visual editor.
 *
 * Round 24's forensic completeness story: combined with the existing
 * playbook_dag_runs.dagSnapshot ("what shape actually executed?"),
 * this endpoint answers "what shape was SAVED at time T?". The two
 * together let an auditor reconstruct any historical execution from
 * the immutable trail.
 *
 * The response shape is intentionally lean — we don't ship the full
 * `dag` payload for every version in the list (that would balloon
 * the wire size for a DAG with 200+ saves). Instead we surface the
 * metadata the sidebar needs: id, version, note, restoredFromVersion,
 * createdAt. The editor calls a separate per-version GET (TODO) when
 * the user clicks "preview" / "restore".
 *
 * Tenant isolation is enforced inside listDagVersions via userId in
 * the WHERE clause — a hostile dagId returns an empty list, not a
 * cross-tenant peek.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { getDag, listDagVersions } from "@/lib/playbook-dag-store";

export const runtime = "nodejs";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, ctx: Ctx): Promise<Response> {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const userId = auth.userId;

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  // Verify the parent DAG exists + belongs to this user before
  // surfacing version metadata. Without this gate, the response on a
  // hostile id would be `{ versions: [] }` (correct, but identical to
  // "real DAG with no versions yet"). Front-loading the 404 keeps the
  // editor's error states cleaner.
  const parent = await getDag({ id, userId });
  if (!parent) {
    return NextResponse.json({ error: "DAG not found" }, { status: 404 });
  }

  // Optional limit query — defaults to 50, max 200 (matches store).
  const url = new URL(req.url);
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Math.min(Math.max(1, Number(limitParam) || 50), 200) : 50;

  const { versions } = await listDagVersions({
    dagId: id,
    userId,
    limit,
  });

  // Strip the heavy `dag` field from the list response. The editor's
  // sidebar only needs metadata to render the timeline; it fetches
  // the full payload on click via GET /versions/[versionId].
  const summaries = versions.map((v) => ({
    id: v.id,
    version: v.version,
    note: v.note,
    restoredFromVersion: v.restoredFromVersion,
    createdAt: v.createdAt,
    nodeCount: v.dag.nodes.length,
    edgeCount: v.dag.edges.length,
  }));

  // versionCount comes from the parent DAG row — it's the monotonic
  // counter that createDagVersion bumps. The list above might be
  // capped by the limit param, but versionCount tells the editor
  // "this is v3 of 47" even when only the most recent 50 are loaded.
  return NextResponse.json({
    success: true,
    dagId: id,
    versionCount: parent.versionCount,
    versions: summaries,
  });
}
