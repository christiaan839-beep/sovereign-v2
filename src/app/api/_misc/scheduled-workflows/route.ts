import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { scheduledRuns } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("scheduled-workflows-api");

/**
 * GET  /api/_misc/scheduled-workflows — List scheduled workflows for the current user
 * POST /api/_misc/scheduled-workflows — Create or update a scheduled workflow
 */

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const rows = await db
      .select()
      .from(scheduledRuns)
      .where(
        and(
          eq(scheduledRuns.userId, userId),
          eq(scheduledRuns.agentType, "workflow")
        )
      )
      .orderBy(desc(scheduledRuns.createdAt));

    return NextResponse.json({ scheduledWorkflows: rows });
  } catch (err) {
    log.error("Failed to list scheduled workflows", { error: (err as Error).message });
    return NextResponse.json({ error: "Failed to list scheduled workflows" }, { status: 500 });
  }
}

// ─── Cron presets for validation ──────────────────────────────────

const CRON_PRESETS: Record<string, string> = {
  "every-hour": "0 * * * *",
  "daily-9am": "0 9 * * *",
  "weekly-monday": "0 9 * * 1",
};

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = await req.json();
    const { workflowId, workflowName, cronExpression, enabled, id } = body;

    if (!workflowId || !cronExpression) {
      return NextResponse.json(
        { error: "workflowId and cronExpression are required." },
        { status: 400 }
      );
    }

    // Resolve preset or use raw cron expression
    const resolvedCron = CRON_PRESETS[cronExpression] || cronExpression;

    // Basic cron validation (5 fields)
    const cronParts = resolvedCron.trim().split(/\s+/);
    if (cronParts.length !== 5) {
      return NextResponse.json(
        { error: "Invalid cron expression. Expected 5 fields (minute hour day month weekday)." },
        { status: 400 }
      );
    }

    // If id is provided, update existing scheduled run
    if (id) {
      const existing = await db
        .select()
        .from(scheduledRuns)
        .where(eq(scheduledRuns.id, id));

      if (existing.length === 0 || existing[0].userId !== userId) {
        return NextResponse.json({ error: "Scheduled workflow not found." }, { status: 404 });
      }

      const [updated] = await db
        .update(scheduledRuns)
        .set({
          schedule: resolvedCron,
          enabled: enabled ?? true,
          agentName: workflowName || existing[0].agentName,
        })
        .where(eq(scheduledRuns.id, id))
        .returning();

      return NextResponse.json({ scheduledWorkflow: updated });
    }

    // Create new scheduled run for the workflow
    const [created] = await db
      .insert(scheduledRuns)
      .values({
        userId,
        agentType: "workflow",
        agentName: workflowName || "Workflow",
        prompt: workflowId, // Store the workflow ID in the prompt field for reference
        schedule: resolvedCron,
        enabled: enabled ?? true,
      })
      .returning();

    return NextResponse.json({ scheduledWorkflow: created });
  } catch (err) {
    log.error("Failed to save scheduled workflow", { error: (err as Error).message });
    return NextResponse.json({ error: "Failed to save scheduled workflow" }, { status: 500 });
  }
}
