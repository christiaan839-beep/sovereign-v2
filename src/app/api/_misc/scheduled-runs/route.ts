import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { scheduledRuns } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { nextRun, validateCron } from "@/lib/cron-next";
import { requireAuth } from "@/lib/auth-guard";

/**
 * SCHEDULED RUNS — CRUD over a user's cron-scheduled agent invocations.
 *
 * SECURITY: every handler authenticates via Clerk (`requireAuth`) and
 * scopes all DB queries by the resolved `userId`. Earlier versions of
 * this file pulled `userId` from the `x-user-id` request header — that
 * was fully client-controlled (no middleware was setting it), so any
 * caller could spoof another user and create/edit/delete their
 * scheduled runs (and worse: the scheduler would later FIRE those
 * runs against the spoofed user's tenant + budget). Fixed 2026-04-27.
 */

// GET — List all scheduled runs for the authenticated user
export async function GET(_req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const userId = auth.userId;

  try {
    const runs = await db
      .select()
      .from(scheduledRuns)
      .where(eq(scheduledRuns.userId, userId))
      .orderBy(scheduledRuns.createdAt);

    return NextResponse.json({ runs, count: runs.length });
  } catch {
    return NextResponse.json({ runs: [], count: 0 });
  }
}

// POST — Create a new scheduled run owned by the authenticated user
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const userId = auth.userId;

  const body = await req.json();
  const { agentType, agentName, prompt, schedule, timezone, projectId } = body;

  if (!agentType || !prompt || !schedule) {
    return NextResponse.json(
      { error: "Missing required fields: agentType, prompt, schedule" },
      { status: 400 }
    );
  }

  // Validate the cron expression up-front so invalid schedules are rejected
  // at creation time, not silently failing in the scheduler tick.
  const cronError = validateCron(schedule);
  if (cronError) {
    return NextResponse.json({ error: `Invalid schedule: ${cronError}` }, { status: 400 });
  }

  // Pre-compute the first fire time so the scheduler cron knows exactly
  // when this row becomes due.
  const firstRun = nextRun(schedule, new Date());

  try {
    const [run] = await db
      .insert(scheduledRuns)
      .values({
        userId,
        projectId: projectId || null,
        agentType,
        agentName: agentName || agentType,
        prompt,
        schedule,
        timezone: timezone || "UTC",
        enabled: true,
        nextRunAt: firstRun,
      })
      .returning();

    return NextResponse.json({ run, success: true });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to create scheduled run: ${err instanceof Error ? err.message : "Unknown"}` },
      { status: 500 }
    );
  }
}

// PUT — Update one of the user's scheduled runs (enable/disable, change schedule)
export async function PUT(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const userId = auth.userId;

  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "Missing run id" }, { status: 400 });
  }

  try {
    const [updated] = await db
      .update(scheduledRuns)
      .set(updates)
      .where(and(eq(scheduledRuns.id, id), eq(scheduledRuns.userId, userId)))
      .returning();

    return NextResponse.json({ run: updated, success: true });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to update: ${err instanceof Error ? err.message : "Unknown"}` },
      { status: 500 }
    );
  }
}

// DELETE — Remove one of the user's scheduled runs
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const userId = auth.userId;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing run id" }, { status: 400 });
  }

  try {
    await db
      .delete(scheduledRuns)
      .where(and(eq(scheduledRuns.id, id), eq(scheduledRuns.userId, userId)));

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to delete: ${err instanceof Error ? err.message : "Unknown"}` },
      { status: 500 }
    );
  }
}
