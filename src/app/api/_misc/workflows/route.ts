import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { workflows } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("workflows-api");

/**
 * GET  /api/_misc/workflows — List all workflows for the current user
 * POST /api/_misc/workflows — Create or update a workflow
 */

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const rows = await db
      .select()
      .from(workflows)
      .where(eq(workflows.userId, userId))
      .orderBy(desc(workflows.updatedAt));

    return NextResponse.json({ workflows: rows });
  } catch (err) {
    log.error("Failed to list workflows", { error: (err as Error).message });
    return NextResponse.json({ error: "Failed to list workflows" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = await req.json();
    const { id, name, nodes, status } = body;

    if (!name || !nodes) {
      return NextResponse.json({ error: "name and nodes are required." }, { status: 400 });
    }

    const nodesStr = typeof nodes === "string" ? nodes : JSON.stringify(nodes);

    // Upsert — if id is provided, update; otherwise create
    if (id) {
      const existing = await db
        .select()
        .from(workflows)
        .where(eq(workflows.id, id));

      if (existing.length === 0 || existing[0].userId !== userId) {
        return NextResponse.json({ error: "Workflow not found." }, { status: 404 });
      }

      const updated = await db
        .update(workflows)
        .set({
          name,
          nodes: nodesStr,
          status: status || existing[0].status,
          updatedAt: new Date(),
        })
        .where(eq(workflows.id, id))
        .returning();

      return NextResponse.json({ workflow: updated[0] });
    }

    // Create new
    const created = await db
      .insert(workflows)
      .values({
        userId,
        name,
        nodes: nodesStr,
        status: status || "draft",
      })
      .returning();

    return NextResponse.json({ workflow: created[0] }, { status: 201 });
  } catch (err) {
    log.error("Failed to save workflow", { error: (err as Error).message });
    return NextResponse.json({ error: "Failed to save workflow" }, { status: 500 });
  }
}
