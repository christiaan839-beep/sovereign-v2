/**
 * /api/playbooks/dag
 *
 *   GET   — list the user's saved DAGs (newest-edit first)
 *   POST  — create or update a DAG from the visual editor
 *
 * The editor's save flow always POSTs the full DAG. If `id` is in the
 * body and the user owns it, we update; otherwise we insert and
 * return the new id so the editor can navigate to /[id] afterwards.
 *
 * Persistence is best-effort: when DATABASE_URL is unset (dev /
 * preview), the store returns a logical id and persisted=false. The
 * editor still gets a "saved ✓" UX so structural validation always
 * works regardless of DB availability — drift between marketing and
 * implementation is the audit story we're trying to keep honest.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-guard";
import { topoSort } from "@/lib/playbook-dag";
import { auditLog } from "@/lib/audit-log";
import { createLogger } from "@/lib/logger";
import {
  createDagVersion,
  getDag,
  insertDag,
  listDags,
  updateDag,
} from "@/lib/playbook-dag-store";

export const runtime = "nodejs";

const log = createLogger("playbooks/dag");

const NodeSchema = z.object({
  id: z.string().min(1).max(80),
  agent: z.string().min(1).max(120),
  position: z.object({ x: z.number(), y: z.number() }),
  config: z.record(z.string(), z.unknown()).optional().default({}),
});

const EdgeSchema = z.object({
  from: z.string().min(1).max(120),
  to: z.string().min(1).max(120),
});

const RequestSchema = z.object({
  id: z.string().uuid().optional(), // proper UUID — fallback ids look like dag_local_*
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).optional(),
  dag: z.object({
    nodes: z.array(NodeSchema).min(1).max(100),
    edges: z.array(EdgeSchema).max(200),
  }),
  // Round 24 — optional human-readable label attached to this version
  // ("Added n3 follow-up", "Pre-launch tuning"). Surfaces in the
  // version-history sidebar to make rollbacks navigable. Optional —
  // an empty save still creates a numbered version, just without
  // narrative.
  note: z.string().max(280).optional(),
});

/**
 * GET /api/playbooks/dag
 *
 * List the authenticated user's saved DAGs. Used by the visual
 * editor's "My playbooks" sidebar and any analytics surface that
 * needs to enumerate authoring activity per user.
 */
export async function GET(): Promise<Response> {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const userId = auth.userId;

  const { dags } = await listDags({ userId, limit: 50 });
  // Strip the heavy `dag` field from the list response — the editor
  // hydrates it via GET /api/playbooks/dag/[id]. This keeps the list
  // endpoint cheap when a user has 50 multi-node playbooks.
  const summaries = dags.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    status: d.status,
    nodeCount: d.nodeCount,
    edgeCount: d.edgeCount,
    lastRunAt: d.lastRunAt,
    lastRunStatus: d.lastRunStatus,
    lastRunDurationMs: d.lastRunDurationMs,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }));
  return NextResponse.json({ success: true, dags: summaries });
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

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { id, name, description, dag, note } = parsed.data;

  // Validate node IDs are unique.
  const ids = new Set<string>();
  for (const n of dag.nodes) {
    if (ids.has(n.id)) {
      return NextResponse.json(
        { error: `Duplicate node id: ${n.id}` },
        { status: 400 },
      );
    }
    ids.add(n.id);
  }

  // Validate edges reference real nodes.
  for (const e of dag.edges) {
    const fromNode = e.from.split(".")[0];
    const toNode = e.to.split(".")[0];
    if (!ids.has(fromNode)) {
      return NextResponse.json(
        { error: `Edge references unknown node: ${fromNode}` },
        { status: 400 },
      );
    }
    if (!ids.has(toNode)) {
      return NextResponse.json(
        { error: `Edge references unknown node: ${toNode}` },
        { status: 400 },
      );
    }
  }

  // Validate the DAG is acyclic. The editor enforces this in the UI
  // but the API has to defend against direct curl callers.
  const topo = topoSort({
    nodes: dag.nodes.map((n) => ({
      id: n.id,
      agent: n.agent,
      position: n.position,
      config: n.config ?? {},
    })),
    edges: dag.edges,
  });
  if (!topo.order) {
    return NextResponse.json(
      { error: "DAG contains a cycle", cycle: topo.cycle },
      { status: 400 },
    );
  }

  // Resolve the name. Default to "Visual playbook (Nn / Ne)" so the
  // list view is still readable for users who don't bother titling.
  const resolvedName =
    name ?? `Visual playbook (${dag.nodes.length}n / ${dag.edges.length}e)`;

  let storedId: string;
  let persisted: boolean;
  let action: "create" | "update";
  // Round 24 — version_count after this save lands. The editor renders
  // "v12 of 12" without an extra round-trip when we surface it here.
  let versionAfterSave: number | null = null;

  if (id) {
    // UPDATE branch — existing DAG.
    //
    // Round 24 changes the write semantics: instead of UPDATE-in-place
    // on the dag column (which destroys the prior shape), every save
    // appends a new version. The parent's `dag` column still tracks
    // "current"; the version table is the immutable trail.
    //
    // We verify ownership up-front via getDag so 404 surfaces cleanly
    // before any write. The store helpers themselves fail-silent
    // (return null on wrong-owner / unknown-id) but the route's job
    // is to translate that into the right HTTP response.
    const existing = await getDag({ id, userId });
    if (!existing) {
      return NextResponse.json(
        { error: "DAG not found or could not be updated" },
        { status: 404 },
      );
    }

    // Metadata-only patch (name / description) is a separate, cheap
    // write — renames don't bump the version_count because the saved
    // shape didn't change.
    const metaChanged =
      (name !== undefined && name !== existing.name) ||
      (description !== undefined && description !== existing.description);
    if (metaChanged) {
      await updateDag({
        id,
        userId,
        name,
        description,
      });
    }

    // Append a new version. createDagVersion is the ONLY write path
    // for the dag column — it transactionally bumps version_count +
    // mirrors the payload into the live column, so the editor and
    // history table never disagree on "what's current".
    const version = await createDagVersion({
      dagId: id,
      userId,
      dag: dag as unknown as import("@/lib/playbook-dag").PlaybookDag,
      note: note ?? null,
    });
    if (!version) {
      // Tenant ownership was already verified above, so this lands
      // here only on DB failure mid-transaction. 500 — not 404 — is
      // the honest signal.
      return NextResponse.json(
        { error: "Could not save DAG version" },
        { status: 500 },
      );
    }
    storedId = id;
    persisted = true;
    action = "update";
    versionAfterSave = version.version;
  } else {
    // INSERT branch — new DAG. insertDag creates the parent row at
    // version_count=0; createDagVersion then records v1 and bumps
    // the count. Two writes, but each is logically distinct: "create
    // the playbook" vs. "record its first version".
    const result = await insertDag({
      userId,
      name: resolvedName,
      description: description ?? null,
      dag: dag as unknown as import("@/lib/playbook-dag").PlaybookDag,
    });
    storedId = result.id;
    persisted = result.persisted;
    action = "create";

    // Skip the version write when persistence is off (DATABASE_URL
    // unset) — the fallback id has no parent row to attach versions
    // to. The editor still shows "saved ✓" via the persisted=false
    // signal, same as before Round 24.
    if (persisted) {
      const version = await createDagVersion({
        dagId: storedId,
        userId,
        dag: dag as unknown as import("@/lib/playbook-dag").PlaybookDag,
        note: note ?? null,
      });
      versionAfterSave = version?.version ?? 1;
    }
  }

  // Audit-log the save through the SHA-256 hash chain. Including
  // `version` makes the audit trail individually addressable —
  // "user X saved playbook Y at version 12 at time T" — which is
  // what diligence teams ask about.
  await auditLog({
    userId,
    action: "settings.update",
    resource: "playbook_dag",
    details: {
      kind: action === "create" ? "playbook_dag.create" : "playbook_dag.update",
      id: storedId,
      persisted,
      nodeCount: dag.nodes.length,
      edgeCount: dag.edges.length,
      // Don't log the full DAG body — may contain user prompts.
      shape: `${dag.nodes.length}n_${dag.edges.length}e`,
      version: versionAfterSave,
      noteAttached: !!note,
    },
  });

  log.info(`playbook DAG ${action}d`, {
    userId,
    persisted,
    id: storedId,
    nodeCount: dag.nodes.length,
    edgeCount: dag.edges.length,
    version: versionAfterSave,
  });

  return NextResponse.json({
    success: true,
    id: storedId,
    persisted,
    action,
    executionOrder: topo.order,
    version: versionAfterSave,
  });
}
