import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { scheduledRuns } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/scheduled-workflows");

/**
 * GET /api/scheduled-workflows
 * List all scheduled workflows for the authenticated user.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const rows = await db
      .select()
      .from(scheduledRuns)
      .where(eq(scheduledRuns.userId, userId))
      .orderBy(desc(scheduledRuns.createdAt));

    return NextResponse.json(rows);
  } catch (err: unknown) {
    const pgCode = (err as { code?: string })?.code;
    const msg = err instanceof Error ? err.message : String(err);
    if (pgCode === "42P01" || msg.includes("does not exist")) {
      log.warn("scheduled_runs table not found — returning empty list");
      return NextResponse.json([]);
    }
    log.error("Failed to list scheduled workflows", { error: msg });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/scheduled-workflows
 * Create a new scheduled workflow.
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { agentType, agentName, prompt, schedule, timezone, enabled } = body;

    if (!agentType || !agentName || !prompt || !schedule) {
      return NextResponse.json(
        { error: "agentType, agentName, prompt, and schedule are required" },
        { status: 400 },
      );
    }

    // Basic cron validation (5 or 6 fields)
    const cronParts = schedule.trim().split(/\s+/);
    if (cronParts.length < 5 || cronParts.length > 6) {
      return NextResponse.json(
        { error: "Invalid cron expression. Expected 5 or 6 fields." },
        { status: 400 },
      );
    }

    // SECURITY: reject sub-5-minute cron intervals to prevent LLM cost runaway.
    // A "* * * * *" (every minute) schedule on a paid plan with 10K/month
    // budget burns through the entire budget in ~7 days; on free tier it's
    // worse. Users can still create frequent schedules via the factory.
    //
    // Minute field positions: 5-field cron = index 0; 6-field cron (with seconds) = index 1.
    const minuteField = cronParts.length === 6 ? cronParts[1] : cronParts[0];
    const isEveryMinuteOrSubMinute =
      minuteField === "*" || /^\*\/[1-4]$/.test(minuteField);
    if (isEveryMinuteOrSubMinute) {
      return NextResponse.json(
        {
          error:
            "Minimum allowed interval is 5 minutes. Use '*/5 * * * *' or less frequent schedules.",
        },
        { status: 400 },
      );
    }

    const [row] = await db
      .insert(scheduledRuns)
      .values({
        userId,
        agentType,
        agentName,
        prompt,
        schedule: schedule.trim(),
        timezone: timezone || "UTC",
        enabled: enabled !== false,
      })
      .returning();

    log.info("Scheduled workflow created", { id: row.id, userId });
    return NextResponse.json(row, { status: 201 });
  } catch (err: unknown) {
    const pgCode = (err as { code?: string })?.code;
    const msg = err instanceof Error ? err.message : String(err);
    if (pgCode === "42P01" || msg.includes("does not exist")) {
      log.warn("scheduled_runs table not found");
      return NextResponse.json(
        {
          error:
            "Database tables not ready. Run the scheduled_runs migration first.",
        },
        { status: 503 },
      );
    }
    log.error("Failed to create scheduled workflow", { error: msg });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/scheduled-workflows
 * Toggle enabled status. Body: { id, enabled }
 */
export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { id, enabled } = body;

    if (!id || typeof enabled !== "boolean") {
      return NextResponse.json(
        { error: "id and enabled (boolean) are required" },
        { status: 400 },
      );
    }

    const [updated] = await db
      .update(scheduledRuns)
      .set({ enabled })
      .where(and(eq(scheduledRuns.id, id), eq(scheduledRuns.userId, userId)))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 },
      );
    }

    log.info("Scheduled workflow toggled", { id, enabled, userId });
    return NextResponse.json(updated);
  } catch (err: unknown) {
    const pgCode = (err as { code?: string })?.code;
    const msg = err instanceof Error ? err.message : String(err);
    if (pgCode === "42P01" || msg.includes("does not exist")) {
      return NextResponse.json(
        { error: "Database tables not ready" },
        { status: 503 },
      );
    }
    log.error("Failed to toggle scheduled workflow", { error: msg });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/scheduled-workflows
 * Remove a scheduled workflow. Body: { id }
 */
export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const [deleted] = await db
      .delete(scheduledRuns)
      .where(and(eq(scheduledRuns.id, id), eq(scheduledRuns.userId, userId)))
      .returning();

    if (!deleted) {
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 },
      );
    }

    log.info("Scheduled workflow deleted", { id, userId });
    return NextResponse.json({ deleted: true, id });
  } catch (err: unknown) {
    const pgCode = (err as { code?: string })?.code;
    const msg = err instanceof Error ? err.message : String(err);
    if (pgCode === "42P01" || msg.includes("does not exist")) {
      return NextResponse.json(
        { error: "Database tables not ready" },
        { status: 503 },
      );
    }
    log.error("Failed to delete scheduled workflow", { error: msg });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
