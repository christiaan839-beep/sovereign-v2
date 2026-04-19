import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { playbookRuns, playbookRunSteps } from "@/db/schema";
import { eq, desc, inArray, asc } from "drizzle-orm";

/**
 * GET /api/playbooks/runs
 *
 * Returns the last 30 playbook runs for the current user,
 * each including a summary of step statuses (no full results — keep payload lean).
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const runs = await db
      .select()
      .from(playbookRuns)
      .where(eq(playbookRuns.userId, userId))
      .orderBy(desc(playbookRuns.createdAt))
      .limit(30);

    // Fetch all steps for all 30 runs in a SINGLE query, then group in memory.
    // This replaces the prior N+1 pattern (31 DB round-trips per poll).
    const runIds = runs.map((r) => r.id);
    const allSteps = runIds.length
      ? await db
          .select({
            runId: playbookRunSteps.runId,
            stepIndex: playbookRunSteps.stepIndex,
            agentName: playbookRunSteps.agentName,
            reason: playbookRunSteps.reason,
            status: playbookRunSteps.status,
            durationMs: playbookRunSteps.durationMs,
            startedAt: playbookRunSteps.startedAt,
            completedAt: playbookRunSteps.completedAt,
          })
          .from(playbookRunSteps)
          .where(inArray(playbookRunSteps.runId, runIds))
          .orderBy(asc(playbookRunSteps.stepIndex))
      : [];

    const stepsByRun = new Map<string, typeof allSteps>();
    for (const step of allSteps) {
      const arr = stepsByRun.get(step.runId) ?? [];
      arr.push(step);
      stepsByRun.set(step.runId, arr);
    }

    const withSteps = runs.map((run) => ({
      ...run,
      steps: (stepsByRun.get(run.id) ?? []).map(({ runId: _runId, ...rest }) => rest),
    }));

    return NextResponse.json({ runs: withSteps });
  } catch (err: unknown) {
    const pgCode = (err as { code?: string })?.code;
    const msg = err instanceof Error ? err.message : String(err);
    if (pgCode === "42P01" || msg.includes("does not exist")) {
      // Tables not created yet — return empty state instead of crashing
      return NextResponse.json({ runs: [] });
    }
    throw err;
  }
}
