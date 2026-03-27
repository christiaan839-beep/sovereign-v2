import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { scheduledRuns } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// GET — List all scheduled runs for a user
export async function GET(req: NextRequest) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = clerkUserId;

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
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = clerkUserId;
  const body = await req.json();

  const { agentType, agentName, prompt, schedule, timezone, projectId } = body;

  if (!agentType || !prompt || !schedule) {
    return NextResponse.json(
      { error: "Missing required fields: agentType, prompt, schedule" },
      { status: 400 }
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
      { error: `Failed to create scheduled run: ${err instanceof Error ? err.message : "Unknown"}` },
      { status: 500 }
    );
  }
}

// PUT — Update a scheduled run (enable/disable, change schedule)
export async function PUT(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = clerkId;
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

// DELETE — Remove a scheduled run
export async function DELETE(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = clerkId;
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
