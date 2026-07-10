import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { clientProjects } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// Identity comes ONLY from the verified Clerk session. This route is served
// publicly via the [...catchall] router (/api/projects) and is NOT covered by
// middleware isProtectedRoute, so trusting the spoofable `x-user-id` header
// was a cross-user IDOR on read/write/delete (BACKLOG idor-projects).
async function requireUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId ?? null;
}

// GET — List all client projects
export async function GET() {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const projects = await db
      .select()
      .from(clientProjects)
      .where(eq(clientProjects.userId, userId))
      .orderBy(clientProjects.createdAt);

    return NextResponse.json({ projects, count: projects.length });
  } catch {
    return NextResponse.json({ projects: [], count: 0 });
  }
}

// POST — Create a new client project
export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();

  const { name, clientName, industry, website, color, notes } = body;

  if (!name || !clientName) {
    return NextResponse.json(
      { error: "Missing required fields: name, clientName" },
      { status: 400 },
    );
  }

  try {
    const [project] = await db
      .insert(clientProjects)
      .values({
        userId,
        name,
        clientName,
        industry: industry || null,
        website: website || null,
        color: color || "#10b981",
        notes: notes || null,
      })
      .returning();

    return NextResponse.json({ project, success: true });
  } catch (err) {
    return NextResponse.json(
      {
        error: `Failed to create project: ${err instanceof Error ? err.message : "Unknown"}`,
      },
      { status: 500 },
    );
  }
}

// PUT — Update a project
export async function PUT(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "Missing project id" }, { status: 400 });
  }

  try {
    const [updated] = await db
      .update(clientProjects)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(clientProjects.id, id), eq(clientProjects.userId, userId)))
      .returning();

    return NextResponse.json({ project: updated, success: true });
  } catch (err) {
    return NextResponse.json(
      {
        error: `Failed to update: ${err instanceof Error ? err.message : "Unknown"}`,
      },
      { status: 500 },
    );
  }
}

// DELETE — Remove a project
export async function DELETE(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing project id" }, { status: 400 });
  }

  try {
    await db
      .delete(clientProjects)
      .where(and(eq(clientProjects.id, id), eq(clientProjects.userId, userId)));

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
