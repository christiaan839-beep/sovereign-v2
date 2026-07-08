import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { agentActivity } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

// Identity comes ONLY from the verified Clerk session. Served publicly
// via [...catchall] (/api/inbox) and not gated by middleware, so the
// old `x-user-id` header trust let anyone read/write/mark-read another
// user's activity feed (BACKLOG idor-inbox).
async function requireUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId ?? null;
}

// GET — Get agent activity feed (Smart Inbox)
export async function GET(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") || "50");
  const unreadOnly = searchParams.get("unread") === "true";

  try {
    const conditions = [eq(agentActivity.userId, userId)];
    if (unreadOnly) {
      conditions.push(eq(agentActivity.isRead, false));
    }

    const activities = await db
      .select()
      .from(agentActivity)
      .where(and(...conditions))
      .orderBy(desc(agentActivity.createdAt))
      .limit(limit);

    const unreadCount = activities.filter((a) => !a.isRead).length;

    return NextResponse.json({
      activities,
      count: activities.length,
      unreadCount,
    });
  } catch {
    return NextResponse.json({ activities: [], count: 0, unreadCount: 0 });
  }
}

// POST — Log a new agent activity
export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();

  const { agentName, agentType, action, summary, result, projectId, metadata } =
    body;

  if (!agentName || !action || !summary) {
    return NextResponse.json(
      { error: "Missing required fields: agentName, action, summary" },
      { status: 400 },
    );
  }

  try {
    const [activity] = await db
      .insert(agentActivity)
      .values({
        userId,
        projectId: projectId || null,
        agentName,
        agentType: agentType || "general",
        action,
        summary,
        result: result || null,
        metadata: metadata ? JSON.stringify(metadata) : null,
      })
      .returning();

    return NextResponse.json({ activity, success: true });
  } catch (err) {
    return NextResponse.json(
      {
        error: `Failed to log activity: ${err instanceof Error ? err.message : "Unknown"}`,
      },
      { status: 500 },
    );
  }
}

// PUT — Mark activities as read
export async function PUT(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { ids, markAll } = body;

  try {
    if (markAll) {
      await db
        .update(agentActivity)
        .set({ isRead: true })
        .where(
          and(
            eq(agentActivity.userId, userId),
            eq(agentActivity.isRead, false),
          ),
        );
    } else if (ids?.length) {
      for (const id of ids) {
        await db
          .update(agentActivity)
          .set({ isRead: true })
          .where(
            and(eq(agentActivity.id, id), eq(agentActivity.userId, userId)),
          );
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      {
        error: `Failed to update: ${err instanceof Error ? err.message : "Unknown"}`,
      },
      { status: 500 },
    );
  }
}
