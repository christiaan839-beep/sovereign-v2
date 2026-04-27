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
import { insertDag, listDags, updateDag } from "@/lib/playbook-dag-store";

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

  const { id, name, description, dag } = parsed.data;

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

  if (id) {
    // UPDATE branch — existing DAG.
    const result = await updateDag({
      id,
      userId,
      name,
      description,
      dag: dag as unknown as import("@/lib/playbook-dag").PlaybookDag,
    });
    if (!result.updated) {
      // Either the row doesn't exist, the user doesn't own it, or DB
      // is offline. We don't distinguish — same response either way
      // (no leak).
      return NextResponse.json(
        { error: "DAG not found or could not be updated" },
        { status: 404 },
      );
    }
    storedId = id;
    persisted = true;
    action = "update";
  } else {
    // INSERT branch — new DAG.
    const result = await insertDag({
      userId,
      name: resolvedName,
      description: description ?? null,
      dag: dag as unknown as import("@/lib/playbook-dag").PlaybookDag,
    });
    storedId = result.id;
    persisted = result.persisted;
    action = "create";
  }

  // Audit-log the save through the SHA-256 hash chain.
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
    },
  });

  log.info(`playbook DAG ${action}d`, {
    userId,
    persisted,
    id: storedId,
    nodeCount: dag.nodes.length,
    edgeCount: dag.edges.length,
  });

  return NextResponse.json({
    success: true,
    id: storedId,
    persisted,
    action,
    executionOrder: topo.order,
  });
}
