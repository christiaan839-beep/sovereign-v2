import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { workflows, playbookRuns, playbookRunSteps } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { createLogger } from "@/lib/logger";
import { getBaseUrl } from "@/lib/base-url";
import {
  checkFreeUsage,
  incrementUsage,
  getSmartUpgradeInfo,
} from "@/lib/free-tier";

const log = createLogger("workflow-run");

interface WorkflowNode {
  id?: string;
  agent?: { id: string; name?: string };
  agentId?: string;
  prompt?: string;
  topic?: string;
  payload?: Record<string, unknown>;
}

/**
 * POST /api/workflows/[id]/run
 *
 * Server-side execution of a saved workflow. Iterates the node list
 * sequentially, dispatches each step to its agent endpoint, records every
 * step in the playbook_runs / playbook_run_steps tables, and returns the
 * run summary. Downstream UIs can poll /api/workflows/[id]/run?runId=...
 * for live status (future enhancement).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Plan-limit gate (one workflow run = one quota unit)
  const usage = await checkFreeUsage(userId);
  if (!usage.allowed) {
    const upgrade = await getSmartUpgradeInfo(userId);
    return NextResponse.json(
      {
        error: "Usage limit reached",
        message: `You've used all ${upgrade.currentLimit} runs this month.`,
        upgrade,
        code: "USAGE_LIMIT_REACHED",
      },
      { status: 429 },
    );
  }

  const { id } = await params;
  const [workflow] = await db
    .select()
    .from(workflows)
    .where(and(eq(workflows.id, id), eq(workflows.userId, userId)))
    .limit(1);

  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  let nodes: WorkflowNode[];
  try {
    nodes = JSON.parse(workflow.nodes);
    if (!Array.isArray(nodes) || nodes.length === 0) {
      return NextResponse.json(
        { error: "Workflow has no nodes" },
        { status: 400 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Workflow nodes corrupt" },
      { status: 422 },
    );
  }

  // Optional override payload from request body
  const body = (await req.json().catch(() => ({}))) as {
    input?: Record<string, unknown>;
  };
  const overrideInput = body.input || {};

  // ── Open the run ──
  const runStart = Date.now();
  let runId: string | undefined;
  try {
    const [run] = await db
      .insert(playbookRuns)
      .values({
        userId,
        playbookId: `workflow:${workflow.id}`,
        playbookName: workflow.name,
        inputs: JSON.stringify(overrideInput),
        status: "running",
        stepCount: nodes.length,
      })
      .returning({ id: playbookRuns.id });
    runId = run.id;
  } catch (err) {
    // playbook_runs may not be migrated yet — execution should still work
    log.warn("playbook_runs unavailable, running in ephemeral mode", {
      error: String(err),
    });
  }

  const baseUrl = getBaseUrl();
  const stepResults: Array<{
    agentId: string;
    status: "done" | "failed";
    durationMs: number;
    output?: string;
    error?: string;
  }> = [];

  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const agentId = node.agentId || node.agent?.id;
    if (!agentId) {
      stepResults.push({
        agentId: "unknown",
        status: "failed",
        durationMs: 0,
        error: "Node missing agent id",
      });
      failed++;
      continue;
    }

    const stepStart = Date.now();
    let stepStatus: "done" | "failed" = "done";
    let output = "";
    let error = "";

    try {
      const dispatchBody = {
        ...overrideInput,
        ...(node.payload || {}),
        prompt:
          node.prompt || node.topic || `Execute step ${i + 1}: ${agentId}`,
      };

      const res = await fetch(`${baseUrl}/api/_agents/${agentId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-workflow": workflow.id,
        },
        body: JSON.stringify(dispatchBody),
        signal: AbortSignal.timeout(60_000),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        stepStatus = "failed";
        error = data?.error || `HTTP ${res.status}`;
        failed++;
      } else {
        output =
          (typeof data.output === "string" && data.output) ||
          (typeof data.result === "string" && data.result) ||
          (typeof data.response === "string" && data.response) ||
          JSON.stringify(data).slice(0, 500);
        succeeded++;
      }
    } catch (err) {
      stepStatus = "failed";
      error = err instanceof Error ? err.message : String(err);
      failed++;
    }

    const durationMs = Date.now() - stepStart;
    stepResults.push({
      agentId,
      status: stepStatus,
      durationMs,
      output,
      error,
    });

    // Persist step (best-effort)
    if (runId) {
      db.insert(playbookRunSteps)
        .values({
          runId,
          stepIndex: i,
          agentName: agentId,
          status: stepStatus,
          result: output.slice(0, 4000),
          error: error.slice(0, 1000) || null,
          durationMs,
          startedAt: new Date(stepStart),
          completedAt: new Date(),
        })
        .catch(() => {}); // non-blocking
    }
  }

  const totalDuration = Date.now() - runStart;
  const finalStatus: "completed" | "failed" | "partial" =
    failed === 0 ? "completed" : succeeded === 0 ? "failed" : "partial";

  // Close the run
  if (runId) {
    db.update(playbookRuns)
      .set({
        status: finalStatus,
        stepsSucceeded: succeeded,
        stepsFailed: failed,
        durationMs: totalDuration,
        completedAt: new Date(),
      })
      .where(eq(playbookRuns.id, runId))
      .catch(() => {});
  }

  // Bump workflow's lastRunAt + run count
  db.update(workflows)
    .set({
      lastRunAt: new Date(),
      runCount: (workflow.runCount ?? 0) + 1,
    })
    .where(eq(workflows.id, workflow.id))
    .catch(() => {});

  // Count the workflow execution as one billable run
  incrementUsage(userId, `workflow:${workflow.id}`).catch(() => {});

  log.info("workflow run complete", {
    workflowId: workflow.id,
    runId,
    status: finalStatus,
    succeeded,
    failed,
    durationMs: totalDuration,
  });

  return NextResponse.json({
    runId: runId || null,
    status: finalStatus,
    durationMs: totalDuration,
    succeeded,
    failed,
    steps: stepResults,
  });
}
