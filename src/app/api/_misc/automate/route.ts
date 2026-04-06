import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { scheduledRuns } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("automate");

/**
 * AUTOMATION API — Schedule agents to run automatically.
 *
 * POST /api/_misc/automate
 * { "goal": "Find SaaS leads in Austin", "schedule": "daily" }
 *
 * Schedules:
 *   "daily"   → Every day at 9am
 *   "weekly"  → Every Monday at 9am
 *   "monthly" → 1st of every month at 9am
 *   Custom cron: "0 9 * * 1-5" (weekdays at 9am)
 *
 * Combined with /api/do, this creates full automation:
 *   1. POST /api/do → immediate result
 *   2. POST /api/_misc/automate → same thing, recurring
 */

const SCHEDULE_MAP: Record<string, string> = {
  daily: "0 9 * * *",
  weekdays: "0 9 * * 1-5",
  weekly: "0 9 * * 1",
  biweekly: "0 9 * * 1", // Every Monday (same as weekly — biweekly needs custom logic)
  monthly: "0 9 1 * *",
};

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  try {
    const { goal, schedule, agent, enabled = true } = await req.json();

    if (!goal) {
      return NextResponse.json({ error: "goal is required" }, { status: 400 });
    }

    const cronExpression = SCHEDULE_MAP[schedule] || schedule || SCHEDULE_MAP.weekly;

    // Validate cron (basic check)
    if (cronExpression.split(" ").length !== 5) {
      return NextResponse.json({ error: "Invalid schedule. Use: daily, weekly, monthly, or a cron expression" }, { status: 400 });
    }

    // Save to database
    const [run] = await db.insert(scheduledRuns).values({
      userId,
      agentType: agent || "auto", // "auto" = /api/do picks the agent
      agentName: agent || "auto-scheduler",
      prompt: goal,
      schedule: cronExpression,
      enabled,
    }).returning();

    log.info("Automation created", { userId, goal: goal.slice(0, 100), schedule: cronExpression });

    return NextResponse.json({
      success: true,
      automation: {
        id: run.id,
        goal,
        schedule: cronExpression,
        scheduleHuman: Object.entries(SCHEDULE_MAP).find(([, v]) => v === cronExpression)?.[0] || cronExpression,
        enabled,
        nextRun: "On next cron trigger",
      },
      message: `Automation created. This goal will run ${schedule || "weekly"}.`,
    });
  } catch (err) {
    log.error("Automation create error", { error: String(err) });
    return NextResponse.json({ error: "Failed to create automation" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  try {
    const runs = await db
      .select()
      .from(scheduledRuns)
      .where(eq(scheduledRuns.userId, userId))
      .limit(50);

    return NextResponse.json({
      automations: runs.map(r => ({
        id: r.id,
        goal: r.prompt,
        agent: r.agentName,
        schedule: r.schedule,
        enabled: r.enabled,
        lastRun: r.lastRunAt,
        lastStatus: r.lastStatus,
        runCount: r.runCount,
      })),
      total: runs.length,
    });
  } catch (err) {
    log.error("Automation list error", { error: String(err) });
    return NextResponse.json({ error: "Failed to list automations" }, { status: 500 });
  }
}
