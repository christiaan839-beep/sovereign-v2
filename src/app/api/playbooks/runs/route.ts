import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { playbookRuns, playbookRunSteps } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

/**
 * GET /api/playbooks/runs
 *
 * Returns the last 30 playbook runs for the current user,
 * each including a summary of step statuses (no full results — keep payload lean).
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const runs = await db
    .select()
    .from(playbookRuns)
    .where(eq(playbookRuns.userId, userId))
    .orderBy(desc(playbookRuns.createdAt))
    .limit(30);

  // Attach step summaries for each run in parallel
  const withSteps = await Promise.all(
    runs.map(async (run) => {
      const steps = await db
        .select({
          stepIndex: playbookRunSteps.stepIndex,
          agentName: playbookRunSteps.agentName,
          reason: playbookRunSteps.reason,
          status: playbookRunSteps.status,
          durationMs: playbookRunSteps.durationMs,
          startedAt: playbookRunSteps.startedAt,
          completedAt: playbookRunSteps.completedAt,
        })
        .from(playbookRunSteps)
        .where(eq(playbookRunSteps.runId, run.id))
        .orderBy(playbookRunSteps.stepIndex);

      return { ...run, steps };
    })
  );

  return NextResponse.json({ runs: withSteps });
}
