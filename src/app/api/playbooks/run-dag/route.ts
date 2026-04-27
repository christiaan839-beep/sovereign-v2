/**
 * POST /api/playbooks/run-dag — execute a DAG-shaped playbook.
 *
 * D1 PHASE 3 — closes the visual-editor end-to-end loop. The editor
 * saves DAGs to /api/playbooks/dag; this endpoint executes them.
 *
 * Synchronous execution. For large DAGs (>5 nodes or expected
 * runtime >15s), the next sprint adds a queued path that mirrors
 * the existing /api/playbooks/run pattern (returns runId + pollUrl).
 * Today: inline run + direct response. Vercel's 60s ceiling is
 * tolerable for the visual editor's "run + review" flow.
 *
 * The agent runner is the actual /api/v1/agents/<slug> gateway —
 * we self-fetch with a forwarded internal header so every gate
 * (manifest tier, tenant policy, token budget, capability check,
 * audit log, attestation) fires for every node, exactly the same
 * as a top-level agent invocation.
 *
 * NEVER throws. Failures land in the per-node `results[]` array
 * with `status: "failed"` + the error message.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-guard";
import { executeDag, type PlaybookDag } from "@/lib/playbook-dag";
import { auditLog } from "@/lib/audit-log";
import { getBaseUrl } from "@/lib/base-url";
import { createLogger } from "@/lib/logger";
import { recordDagRun } from "@/lib/playbook-dag-store";

export const runtime = "nodejs";
export const maxDuration = 60;

const log = createLogger("playbooks/run-dag");

const NodeSchema = z.object({
  id: z.string().min(1).max(80),
  agent: z.string().min(1).max(120),
  position: z.object({ x: z.number(), y: z.number() }),
  config: z.record(z.string(), z.unknown()).optional().default({}),
});

const RequestSchema = z.object({
  dag: z.object({
    nodes: z.array(NodeSchema).min(1).max(20), // synchronous cap
    edges: z
      .array(z.object({ from: z.string(), to: z.string() }))
      .max(100)
      .default([]),
  }),
  /**
   * If the DAG was loaded from the visual editor, the parent saved
   * DAG's id. Used to record the run against that DAG so the
   * "previous runs" panel can scope correctly. Optional — anonymous
   * one-shot runs (paste-and-execute) just don't get a parent link.
   */
  dagId: z.string().uuid().optional(),
  /** Optional initial inputs merged into the first node's config. */
  inputs: z.record(z.string(), z.unknown()).optional(),
  /** When true, downstream nodes still run after a failure. */
  continueOnError: z.boolean().optional(),
});

export async function POST(req: NextRequest): Promise<Response> {
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

  const { dag, dagId, inputs = {}, continueOnError } = parsed.data;
  // Cast to satisfy executeDag's typed PlaybookDag — Zod's parsed
  // shape is structurally identical, this is just TS narrowing.
  const typedDag = dag as PlaybookDag;

  // Merge user-supplied inputs onto the first topological-order
  // node's config. The convention is "the first node consumes the
  // user's input fields".
  if (Object.keys(inputs).length > 0 && typedDag.nodes[0]) {
    typedDag.nodes[0].config = { ...typedDag.nodes[0].config, ...inputs };
  }

  const baseUrl = getBaseUrl();
  // Self-fetch the agent gateway so every safety gate fires per node.
  // The X-Sovereign-Internal-Secret header is what the factory checks
  // to allow this kind of trusted server-to-self call.
  const internalSecret = process.env.SOVEREIGN_INTERNAL_SECRET ?? "";

  const runAgent = async (
    slug: string,
    nodeInput: Record<string, unknown>,
  ): Promise<unknown> => {
    const res = await fetch(`${baseUrl}/api/agents/${slug}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(internalSecret
          ? {
              "X-Sovereign-Internal-Secret": internalSecret,
              "X-Sovereign-User-Id": userId,
            }
          : {}),
      },
      body: JSON.stringify(nodeInput),
      signal: AbortSignal.timeout(50_000),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => res.statusText);
      throw new Error(`agent ${slug} failed (${res.status}): ${errBody.slice(0, 200)}`);
    }
    return await res.json();
  };

  const result = await executeDag(typedDag, runAgent, { continueOnError });

  // Record the run into playbook_dag_runs. Best-effort — never blocks
  // the response if persistence fails. The dagId may be null (one-shot
  // execution from a paste, or pre-save run); the row still records.
  const recordOutcome = await recordDagRun({
    userId,
    dagId: dagId ?? null,
    dag: typedDag,
    status: result.status,
    results: result.results,
    totalDurationMs: result.totalDurationMs,
    failedAt: result.failedAt ?? null,
  });

  // Audit-log the run through the SHA-256 chain so even visual-editor
  // executions show up in the immutable trail.
  await auditLog({
    userId,
    action: "agent.execute",
    resource: "playbook_dag.run",
    details: {
      kind: "playbook_dag.run",
      status: result.status,
      nodeCount: typedDag.nodes.length,
      edgeCount: typedDag.edges.length,
      totalDurationMs: result.totalDurationMs,
      failedAt: result.failedAt,
      runId: recordOutcome.runId,
      dagId: dagId ?? null,
      recorded: recordOutcome.recorded,
    },
  });

  log.info("playbook DAG executed", {
    userId,
    status: result.status,
    nodeCount: typedDag.nodes.length,
    durationMs: result.totalDurationMs,
    runId: recordOutcome.runId,
    recorded: recordOutcome.recorded,
  });

  return NextResponse.json({
    success: result.status === "completed",
    runId: recordOutcome.runId,
    recorded: recordOutcome.recorded,
    ...result,
  });
}
