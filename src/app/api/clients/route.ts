import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { clientProjects } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/clients");

/**
 * GET /api/clients
 * List all client projects for the authenticated user.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const rows = await db
      .select()
      .from(clientProjects)
      .where(eq(clientProjects.userId, userId))
      .orderBy(desc(clientProjects.createdAt));

    return NextResponse.json(rows);
  } catch (err: unknown) {
    const pgCode = (err as { code?: string })?.code;
    const msg = err instanceof Error ? err.message : String(err);
    if (pgCode === "42P01" || msg.includes("does not exist")) {
      log.warn("client_projects table not found — returning empty list");
      return NextResponse.json([]);
    }
    log.error("Failed to list clients", { error: msg });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/clients
 * Create a new client project.
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { name, clientName, industry, website, status, color, notes } = body;

    if (!name || !clientName) {
      return NextResponse.json(
        { error: "name and clientName are required" },
        { status: 400 }
      );
    }

    const [project] = await db
      .insert(clientProjects)
      .values({
        userId,
        name,
        clientName,
        industry: industry || null,
        website: website || null,
        status: status || "active",
        color: color || "#10b981",
        notes: notes || null,
      })
      .returning();

    log.info("Client project created", { projectId: project.id, userId });
    return NextResponse.json(project, { status: 201 });
  } catch (err: unknown) {
    const pgCode = (err as { code?: string })?.code;
    const msg = err instanceof Error ? err.message : String(err);
    if (pgCode === "42P01" || msg.includes("does not exist")) {
      log.warn("client_projects table not found");
      return NextResponse.json(
        { error: "Database tables not ready. Run the client_projects migration first." },
        { status: 503 }
      );
    }
    log.error("Failed to create client project", { error: msg });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
