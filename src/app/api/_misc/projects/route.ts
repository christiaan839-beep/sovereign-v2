import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { clientProjects } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// Identity comes ONLY from the verified Clerk session. Served publicly
// via [...catchall] (/api/projects) and not covered by the middleware's
// protected matchers, so the old `x-user-id` header trust let anyone
// read, overwrite, or delete another user's client projects by sending
// `x-user-id: <victim>` (BACKLOG idor-projects). The `|| "anonymous"`
// fallback additionally pooled every signed-out caller into one shared
// tenancy bucket.
async function requireUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId ?? null;
}

const unauthorized = () =>
  NextResponse.json({ error: "Unauthorized" }, { status: 401 });

// GET — List all client projects
export async function GET(_req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

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
  if (!userId) return unauthorized();

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
  if (!userId) return unauthorized();

  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "Missing project id" }, { status: 400 });
  }

  // Never let a caller move a row to another owner, or rewrite its id.
  delete (updates as Record<string, unknown>).userId;
  delete (updates as Record<string, unknown>).id;

  try {
    const [updated] = await db
      .update(clientProjects)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(clientProjects.id, id), eq(clientProjects.userId, userId)))
      .returning();

    // No row matched — the project either doesn't exist or isn't this
    // user's. Reporting success:true there hid both cases.
    if (!updated) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

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
  if (!userId) return unauthorized();

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing project id" }, { status: 400 });
  }

  try {
    const deleted = await db
      .delete(clientProjects)
      .where(and(eq(clientProjects.id, id), eq(clientProjects.userId, userId)))
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

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
