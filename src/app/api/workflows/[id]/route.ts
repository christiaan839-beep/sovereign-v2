import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { workflows } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("workflows");

/**
 * GET /api/workflows/:id — Get a single workflow
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const [workflow] = await db
      .select()
      .from(workflows)
      .where(and(eq(workflows.id, id), eq(workflows.userId, userId)))
      .limit(1);

    if (!workflow) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ workflow });
  } catch (err: unknown) {
    const pgCode = (err as { code?: string })?.code;
    if (pgCode === "42P01") return NextResponse.json({ error: "Not found" }, { status: 404 });
    log.error("Failed to get workflow", { error: (err as Error).message });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * DELETE /api/workflows/:id — Delete a workflow
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const [deleted] = await db
      .delete(workflows)
      .where(and(eq(workflows.id, id), eq(workflows.userId, userId)))
      .returning({ id: workflows.id });

    if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

    log.info("Workflow deleted", { id });
    return NextResponse.json({ deleted: true });
  } catch (err: unknown) {
    const pgCode = (err as { code?: string })?.code;
    if (pgCode === "42P01") return NextResponse.json({ error: "Not found" }, { status: 404 });
    log.error("Failed to delete workflow", { error: (err as Error).message });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
