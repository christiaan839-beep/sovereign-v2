/**
 * POST /api/playbooks/runs/:id/resume
 *
 * Resume a failed playbook run from the first failed step. Idempotent —
 * calling resume on a run that's already "done" returns 200 with a no-op
 * response. Calling on a "running" run returns 409 (conflict) to prevent
 * double-execution.
 *
 * Implementation:
 *   1. Identify the first failed step (by stepIndex)
 *   2. Reset all failed steps from that index onward to "pending"
 *   3. Reset the run's status to "running"
 *   4. Re-enqueue the first failed step via the job queue
 *
 * The step runner's idempotency guard handles the rest: completed steps
 * are skipped, pending steps are executed, their results persisted.
 * Nothing needs to be re-done from the beginning.
 */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { playbookRuns, playbookRunSteps } from "@/db/schema";
import { and, eq, gte } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("playbook-resume");

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    // Load run + verify ownership in one query
    const [run] = await db
      .select()
      .from(playbookRuns)
      .where(and(eq(playbookRuns.id, id), eq(playbookRuns.userId, userId)))
      .limit(1);

    if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Guard: if still running, don't double-schedule
    if (run.status === "running") {
      return NextResponse.json(
        { error: "Run is still in progress — cannot resume" },
        { status: 409 },
      );
    }

    // Already done — no-op, return idempotently
    if (run.status === "done") {
      return NextResponse.json({
        runId: id,
        resumed: false,
        reason: "Run is already complete.",
      });
    }

    // Find the first failed step — we resume from HERE, not from step 0
    const steps = await db
      .select()
      .from(playbookRunSteps)
      .where(eq(playbookRunSteps.runId, id))
      .orderBy(playbookRunSteps.stepIndex);

    const firstFailedIdx = steps.findIndex((s) => s.status === "failed");
    if (firstFailedIdx === -1) {
      // Run is marked failed but no step is failed — data inconsistency
      log.warn("run is failed but no failed step found", { runId: id });
      return NextResponse.json(
        { error: "No failed step found — cannot determine resume point" },
        { status: 422 },
      );
    }

    // Reset all steps at or after the failed index back to "pending".
    // Their `result` and `error` columns are cleared so the re-run
    // doesn't confuse the downstream consumer with stale data.
    await db
      .update(playbookRunSteps)
      .set({
        status: "pending",
        result: null,
        error: null,
        durationMs: null,
        startedAt: null,
        completedAt: null,
      })
      .where(
        and(
          eq(playbookRunSteps.runId, id),
          gte(playbookRunSteps.stepIndex, firstFailedIdx),
        ),
      );

    // Reset run status to running so the polling UI re-engages
    await db
      .update(playbookRuns)
      .set({
        status: "running",
        completedAt: null,
        stepsFailed: 0,
        durationMs: null,
      })
      .where(eq(playbookRuns.id, id));

    // Re-enqueue the first failed step — the step runner will execute
    // it, update status, then chain to the next step via the existing
    // playbook engine callback. We use dynamic import to avoid pulling
    // the job-queue code into routes that don't need it.
    const failedStep = steps[firstFailedIdx];
    const { enqueuePlaybookStep } = await import("@/lib/job-queue");
    await enqueuePlaybookStep({
      runId: id,
      stepIndex: failedStep.stepIndex,
      agent: failedStep.agentName,
      params: {}, // step runner re-reads params from inputs
      userId,
    });

    log.info("resumed playbook run", {
      runId: id,
      resumedFromStep: firstFailedIdx,
      totalSteps: steps.length,
    });

    return NextResponse.json({
      runId: id,
      resumed: true,
      resumedFromStep: firstFailedIdx,
      resumedAgent: failedStep.agentName,
      totalSteps: steps.length,
    });
  } catch (err: unknown) {
    const pgCode = (err as { code?: string })?.code;
    const msg = err instanceof Error ? err.message : String(err);
    if (pgCode === "42P01" || msg.includes("does not exist")) {
      return NextResponse.json(
        { error: "Database tables not ready", resumed: false },
        { status: 503 },
      );
    }
    log.error("resume failed", err as Record<string, unknown>);
    return NextResponse.json({ error: "Resume failed" }, { status: 500 });
  }
}
