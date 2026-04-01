import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { workflows } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("workflows-api");

/**
 * GET    /api/_misc/workflows/[id] — Load a specific workflow
 * DELETE /api/_misc/workflows/[id] — Delete a workflow
 */

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { id } = await params;

    const rows = await db
      .select()
      .from(workflows)
      .where(and(eq(workflows.id, id), eq(workflows.userId, userId)));

    if (rows.length === 0) {
      return NextResponse.json({ error: "Workflow not found." }, { status: 404 });
    }

    return NextResponse.json({ workflow: rows[0] });
  } catch (err) {
    log.error("Failed to load workflow", { error: (err as Error).message });
    return NextResponse.json({ error: "Failed to load workflow" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { id } = await params;

    const rows = await db
      .select()
      .from(workflows)
      .where(and(eq(workflows.id, id), eq(workflows.userId, userId)));

    if (rows.length === 0) {
      return NextResponse.json({ error: "Workflow not found." }, { status: 404 });
    }

    await db.delete(workflows).where(eq(workflows.id, id));

    return NextResponse.json({ success: true });
  } catch (err) {
    log.error("Failed to delete workflow", { error: (err as Error).message });
    return NextResponse.json({ error: "Failed to delete workflow" }, { status: 500 });
  }
}
