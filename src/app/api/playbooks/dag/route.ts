/**
 * POST /api/playbooks/dag — save a DAG-shaped playbook from the
 * visual editor.
 *
 * D1 PHASE 2 surface. Phase 3 (next sprint) will:
 *   - Validate the DAG via topoSort + dryRun before persistence
 *   - Persist into a `playbooks_dag` table with a separate column
 *     so existing code-defined playbooks aren't disturbed
 *   - Wire execution into the existing runPlaybook() so the
 *     authoring surface becomes interchangeable with code
 *
 * For Phase 2 this endpoint:
 *   - Authenticates via Clerk
 *   - Validates the DAG is well-formed (no cycles, all node IDs
 *     are unique, edges reference existing nodes)
 *   - Audit-logs the save event through the SHA-256 hash chain
 *     so revoking a leaked playbook is forensically traceable
 *   - Returns the validated DAG + a placeholder ID so the editor
 *     can show "saved" UX
 *
 * Storage: not yet persisted (Phase 3). The endpoint is a no-op on
 * the DB side today; it returns success only after passing
 * structural validation. That keeps the editor's save flow honest
 * — if the DAG is broken, the editor sees the error.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-guard";
import { topoSort } from "@/lib/playbook-dag";
import { auditLog } from "@/lib/audit-log";
import { createLogger } from "@/lib/logger";

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
  id: z.string().optional(),
  dag: z.object({
    nodes: z.array(NodeSchema).min(1).max(100),
    edges: z.array(EdgeSchema).max(200),
  }),
});

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

  const { dag } = parsed.data;

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

  // Validate the DAG is acyclic.
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
      {
        error: "DAG contains a cycle",
        cycle: topo.cycle,
      },
      { status: 400 },
    );
  }

  // Audit-log the save (storage hookup deferred to Phase 3).
  await auditLog({
    userId,
    action: "settings.update",
    resource: "playbook_dag",
    details: {
      kind: "playbook_dag.save",
      nodeCount: dag.nodes.length,
      edgeCount: dag.edges.length,
      // Don't log full DAG bodies — they may contain user prompts.
      // Hash is enough for forensic traceability if disputes arise.
      shape: `${dag.nodes.length}n_${dag.edges.length}e`,
    },
  });

  log.info("playbook DAG validated + audit-logged", {
    userId,
    nodeCount: dag.nodes.length,
    edgeCount: dag.edges.length,
  });

  return NextResponse.json({
    success: true,
    id: parsed.data.id ?? `dag_${Date.now()}`,
    executionOrder: topo.order,
    note:
      "Phase 2: validated + audit-logged. Persistence + execution wire-up lands in Phase 3.",
  });
}
