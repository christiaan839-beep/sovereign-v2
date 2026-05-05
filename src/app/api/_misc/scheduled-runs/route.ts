import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { scheduledRuns } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-guard";

// GET — List all scheduled runs for the authenticated user
export async function GET() {
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

// POST — Create a new scheduled run
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const userId = auth.userId;

  const body = await req.json();
  const { agentType, agentName, prompt, schedule, timezone, projectId } = body;

  if (!agentType || !prompt || !schedule) {
    return NextResponse.json(
      { error: "Missing required fields: agentType, prompt, schedule" },
      { status: 400 },
    );
  }

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
      })
      .returning();

    return NextResponse.json({ run, success: true });
  } catch (err) {
    return NextResponse.json(
      {
        error: `Failed to create scheduled run: ${err instanceof Error ? err.message : "Unknown"}`,
      },
      { status: 500 },
    );
  }
}

// PUT — Update a scheduled run (enable/disable, change schedule) — scoped to user
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
      {
        error: `Failed to update: ${err instanceof Error ? err.message : "Unknown"}`,
      },
      { status: 500 },
    );
  }
}

// DELETE — Remove a scheduled run (scoped to authenticated user)
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
      {
        error: `Failed to delete: ${err instanceof Error ? err.message : "Unknown"}`,
      },
      { status: 500 },
    );
  }
}
