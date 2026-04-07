import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { playbookRuns, playbookRunSteps } from "@/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * GET /api/playbooks/runs/:id
 *
 * Returns a single playbook run with all steps — full results included.
 * Used by the autopilot dashboard to show live step-by-step progress.
 * Frontend polls this every 2s while status === "running".
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const [run] = await db
      .select()
      .from(playbookRuns)
      .where(and(eq(playbookRuns.id, id), eq(playbookRuns.userId, userId)))
      .limit(1);

    if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const steps = await db
      .select()
      .from(playbookRunSteps)
      .where(eq(playbookRunSteps.runId, id))
      .orderBy(playbookRunSteps.stepIndex);

    const currentStep = steps.findIndex(s => s.status === "running");
    const completedSteps = steps.filter(s => s.status === "done").length;
    const progress = run.stepCount > 0
      ? Math.round((completedSteps / run.stepCount) * 100)
      : 0;

    return NextResponse.json({
      ...run,
      steps,
      currentStep,
      progress,
      done: run.status === "done" || run.status === "failed",
    });
  } catch (err: unknown) {
    const pgCode = (err as { code?: string })?.code;
    const msg = err instanceof Error ? err.message : String(err);
    if (pgCode === "42P01" || msg.includes("does not exist")) {
      return NextResponse.json({ error: "Database tables not ready", done: true, steps: [] }, { status: 503 });
    }
    throw err;
  }
}
