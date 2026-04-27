/**
 * POST /api/playbooks/run-dag — execute a DAG-shaped playbook.
 *
 * D1 PHASES 3 + 6.
 *
 * Two modes, picked automatically based on shape:
 *
 *   SYNC  (≤5 nodes, 60s ceiling):
 *     The original behavior — execute end-to-end, return the full
 *     result inline. Same response contract as Round 8.
 *
 *   ASYNC (>5 nodes, 300s ceiling via after()):
 *     INSERT a 'running' row immediately, return {runId, pollUrl,
 *     async: true}, then continue execution in after() so the worker
 *     keeps running past the response. The polling endpoint
 *     /api/playbooks/dag/runs/[runId] returns progressive results as
 *     each node completes.
 *
 * The async path uses the SAME executeDag function with an
 * onProgress callback that persists incremental state. So sync and
 * async runs are byte-for-byte identical executions — only the
 * delivery differs.
 *
 * The agent runner is the actual /api/agents/<slug> gateway —
 * we self-fetch with a forwarded internal header so every gate
 * (manifest tier, tenant policy, token budget, capability check,
 * audit log, attestation) fires for every node, exactly the same
 * as a top-level agent invocation. This is the structural
 * commitment: authoring surface ≠ runtime surface; both meet at
 * the gateway.
 *
 * NEVER throws. Failures land in the per-node `results[]` array
 * with `status: "failed"` + the error message.
 */

import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-guard";
import { executeDag, type PlaybookDag } from "@/lib/playbook-dag";
import { auditLog } from "@/lib/audit-log";
import { getBaseUrl } from "@/lib/base-url";
import { createLogger } from "@/lib/logger";
import {
  recordDagRun,
  createPendingRun,
  updateRunProgress,
  finalizeRun,
} from "@/lib/playbook-dag-store";

export const runtime = "nodejs";
// 300s = 5 minutes. The async path uses after() to extend execution
// past the response, but the function still terminates at maxDuration.
// Vercel Pro supports up to 300s; Hobby caps at 60.
export const maxDuration = 300;

const log = createLogger("playbooks/run-dag");

/**
 * Threshold for async mode. ≤5 nodes runs sync (instant feedback for
 * small DAGs); >5 routes to async (so the user can close the editor
 * and come back). The threshold is deliberately small — most "real"
 * playbooks have 10+ nodes; only quick experiments stay sync.
 */
const SYNC_NODE_THRESHOLD = 5;

const NodeSchema = z.object({
  id: z.string().min(1).max(80),
  agent: z.string().min(1).max(120),
  position: z.object({ x: z.number(), y: z.number() }),
  config: z.record(z.string(), z.unknown()).optional().default({}),
});

const RequestSchema = z.object({
  dag: z.object({
    nodes: z.array(NodeSchema).min(1).max(100), // async cap
    edges: z
      .array(z.object({ from: z.string(), to: z.string() }))
      .max(200)
      .default([]),
  }),
  /** Parent DAG id for run-attribution. Optional for one-shot pastes. */
  dagId: z.string().uuid().optional(),
  /** Optional initial inputs merged into the first node's config. */
  inputs: z.record(z.string(), z.unknown()).optional(),
  /** When true, downstream nodes still run after a failure. */
  continueOnError: z.boolean().optional(),
  /**
   * Force a specific execution mode. Default behavior is auto-pick
   * based on node count. Test suites + the visual editor's "preview
   * run" button use this.
   */
  mode: z.enum(["auto", "sync", "async"]).optional().default("auto"),
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

  const { dag, dagId, inputs = {}, continueOnError, mode } = parsed.data;
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
      // 50s per-node ceiling. Async path runs many nodes in
      // sequence; the 300s function timeout is the outer bound.
      signal: AbortSignal.timeout(50_000),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => res.statusText);
      throw new Error(`agent ${slug} failed (${res.status}): ${errBody.slice(0, 200)}`);
    }
    return await res.json();
  };

  // ─── Decide sync vs async ────────────────────────────────────────
  const isAsync =
    mode === "async" || (mode === "auto" && typedDag.nodes.length > SYNC_NODE_THRESHOLD);

  // ─── ASYNC PATH ──────────────────────────────────────────────────
  if (isAsync) {
    const pending = await createPendingRun({
      userId,
      dagId: dagId ?? null,
      dag: typedDag,
    });
    if (!pending) {
      // DB unavailable — async mode requires persistence to be
      // useful. Fall back to sync so the request still completes
      // even when storage is offline.
      log.warn("createPendingRun returned null; falling back to sync", { userId });
    } else {
      const runId = pending.runId;

      // Background execution. Any throw inside after() is swallowed
      // by Next; we use try/finally to ensure finalizeRun fires even
      // on hard failure (e.g. function timeout — though the
      // finalizeRun will then fail, but the orphan-detection job
      // catches stale 'running' rows separately).
      after(async () => {
        const t0 = Date.now();
        try {
          const result = await executeDag(typedDag, runAgent, {
            continueOnError,
            onProgress: async (results, completedCount) => {
              await updateRunProgress({
                runId,
                userId,
                results,
                progressNodesCompleted: completedCount,
              });
            },
          });
          await finalizeRun({
            runId,
            userId,
            dagId: dagId ?? null,
            status: result.status,
            results: result.results,
            totalDurationMs: result.totalDurationMs,
            failedAt: result.failedAt ?? null,
          });
          await auditLog({
            userId,
            action: "agent.execute",
            resource: "playbook_dag.run",
            details: {
              kind: "playbook_dag.run.async",
              status: result.status,
              nodeCount: typedDag.nodes.length,
              edgeCount: typedDag.edges.length,
              totalDurationMs: result.totalDurationMs,
              failedAt: result.failedAt,
              runId,
              dagId: dagId ?? null,
            },
          });
          log.info("async playbook DAG executed", {
            userId,
            status: result.status,
            durationMs: Date.now() - t0,
            runId,
          });
        } catch (err) {
          // Hard failure of the executor itself (NOT a node failure
          // — that's captured in result.results). Mark the row
          // failed so the user sees a real terminal state instead
          // of an indefinitely-running spinner.
          await finalizeRun({
            runId,
            userId,
            dagId: dagId ?? null,
            status: "failed",
            results: [],
            totalDurationMs: Date.now() - t0,
            failedAt: null,
          });
          log.error("async playbook DAG threw", {
            userId,
            runId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      });

      // Return immediately. The editor reads pollUrl and starts
      // polling /api/playbooks/dag/runs/[runId] every 2s.
      return NextResponse.json({
        success: true,
        runId,
        async: true,
        status: "running",
        pollUrl: `/api/playbooks/dag/runs/${runId}`,
      });
    }
  }

  // ─── SYNC PATH (≤5 nodes, OR async fallback when DB offline) ────
  const result = await executeDag(typedDag, runAgent, { continueOnError });

  // Record the run into playbook_dag_runs. Best-effort — never blocks
  // the response if persistence fails.
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

  log.info("sync playbook DAG executed", {
    userId,
    status: result.status,
    nodeCount: typedDag.nodes.length,
    durationMs: result.totalDurationMs,
    runId: recordOutcome.runId,
    recorded: recordOutcome.recorded,
  });

  return NextResponse.json({
    success: result.status === "completed",
    async: false,
    runId: recordOutcome.runId,
    recorded: recordOutcome.recorded,
    ...result,
  });
}
