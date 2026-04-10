import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { workflows } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("workflows");

/**
 * GET /api/workflows — List user's saved workflows
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rows = await db
      .select()
      .from(workflows)
      .where(eq(workflows.userId, userId))
      .orderBy(desc(workflows.updatedAt))
      .limit(50);

    return NextResponse.json({ workflows: rows });
  } catch (err: unknown) {
    const pgCode = (err as { code?: string })?.code;
    if (pgCode === "42P01") return NextResponse.json({ workflows: [] });
    log.error("Failed to list workflows", { error: (err as Error).message });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * POST /api/workflows — Create or update a workflow
 * Body: { id?, name, nodes (JSON string), status? }
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { id, name, nodes, status } = body;

    if (!name || !nodes) {
      return NextResponse.json(
        { error: "Missing name or nodes" },
        { status: 400 },
      );
    }

    if (id) {
      // Update existing — SECURITY: scope by userId to prevent cross-tenant
      // overwrite IDOR. Previously any authenticated user could overwrite
      // another user's workflow by supplying their workflow id.
      const [updated] = await db
        .update(workflows)
        .set({ name, nodes, status: status || "draft", updatedAt: new Date() })
        .where(and(eq(workflows.id, id), eq(workflows.userId, userId)))
        .returning();

      if (!updated)
        return NextResponse.json(
          { error: "Workflow not found" },
          { status: 404 },
        );
      log.info("Workflow updated", { id, name });
      return NextResponse.json({ workflow: updated });
    }

    // Create new
    const [created] = await db
      .insert(workflows)
      .values({ userId, name, nodes, status: status || "draft" })
      .returning();

    log.info("Workflow created", { id: created.id, name });
    return NextResponse.json({ workflow: created }, { status: 201 });
  } catch (err: unknown) {
    const pgCode = (err as { code?: string })?.code;
    if (pgCode === "42P01") {
      return NextResponse.json(
        { error: "Run migration 0004 first" },
        { status: 503 },
      );
    }
    log.error("Failed to save workflow", { error: (err as Error).message });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
