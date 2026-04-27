import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clientProjects } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-guard";

/**
 * CLIENT PROJECTS — agency-style project tracking, scoped to the
 * authenticated user.
 *
 * SECURITY: every handler authenticates via Clerk. Earlier versions
 * trusted an `x-user-id` request header (no middleware was setting it),
 * so any caller could read, mutate, or delete another user's projects
 * by spoofing that header. Fixed 2026-04-27.
 */

// GET — List the authenticated user's projects
export async function GET(_req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const userId = auth.userId;

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

// POST — Create a new project owned by the authenticated user
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const userId = auth.userId;

  const body = await req.json();
  const { name, clientName, industry, website, color, notes } = body;

  if (!name || !clientName) {
    return NextResponse.json(
      { error: "Missing required fields: name, clientName" },
      { status: 400 }
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
      { error: `Failed to create project: ${err instanceof Error ? err.message : "Unknown"}` },
      { status: 500 }
    );
  }
}

// PUT — Update one of the user's projects
export async function PUT(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const userId = auth.userId;

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
      { error: `Failed to update: ${err instanceof Error ? err.message : "Unknown"}` },
      { status: 500 }
    );
  }
}

// DELETE — Remove one of the user's projects
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const userId = auth.userId;

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
      { error: `Failed to delete: ${err instanceof Error ? err.message : "Unknown"}` },
      { status: 500 }
    );
  }
}
