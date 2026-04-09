import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/db";
import { marketplaceAgents, customSkills } from "@/db/schema";
import { eq, desc, sql, and, ilike } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("marketplace");

/**
 * GET /api/marketplace
 *
 * List marketplace agents with optional filtering.
 * Query params:
 *   - category: filter by category (sales, content, seo, etc.)
 *   - search: full-text search on name + description
 *   - limit: max results (default 50, max 200)
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const category = url.searchParams.get("category");
    const search = url.searchParams.get("search");
    const limitParam = parseInt(url.searchParams.get("limit") || "50", 10);
    const limit = Math.min(Math.max(1, limitParam), 200);

    const conditions = [eq(marketplaceAgents.isPublic, true)];

    if (category && category !== "all") {
      conditions.push(eq(marketplaceAgents.category, category.toLowerCase()));
    }

    if (search) {
      conditions.push(
        sql`(${ilike(marketplaceAgents.name, `%${search}%`)} OR ${ilike(marketplaceAgents.description, `%${search}%`)})`
      );
    }

    const agents = await db
      .select({
        id: marketplaceAgents.id,
        name: marketplaceAgents.name,
        description: marketplaceAgents.description,
        category: marketplaceAgents.category,
        authorName: marketplaceAgents.authorName,
        authorEmail: marketplaceAgents.authorEmail,
        installs: marketplaceAgents.installs,
        rating: marketplaceAgents.rating,
        createdAt: marketplaceAgents.createdAt,
      })
      .from(marketplaceAgents)
      .where(and(...conditions))
      .orderBy(desc(marketplaceAgents.installs))
      .limit(limit);

    return NextResponse.json({ agents, count: agents.length });
  } catch (err: unknown) {
    const pgCode = (err as { code?: string })?.code;
    const msg = err instanceof Error ? err.message : String(err);

    if (pgCode === "42P01" || msg.includes("does not exist")) {
      log.warn("marketplace_agents table not found — return empty list");
      return NextResponse.json({ agents: [], count: 0 });
    }

    log.error("Failed to list marketplace agents", { error: msg });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/marketplace
 *
 * Publish a new agent to the marketplace.
 * Body: { name, description, category, systemPrompt, skillId? }
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, description, category, systemPrompt, skillId } = body;

    if (!name || !description || !category || !systemPrompt) {
      return NextResponse.json(
        { error: "Missing required fields: name, description, category, systemPrompt" },
        { status: 400 }
      );
    }

    // Resolve email and name from Clerk
    let authorEmail = "unknown@sovereign.ai";
    let authorName = "Sovereign User";
    try {
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      authorEmail = user.emailAddresses?.[0]?.emailAddress || authorEmail;
      authorName = [user.firstName, user.lastName].filter(Boolean).join(" ") || authorName;
    } catch {
      log.warn("Could not resolve Clerk user for marketplace publish", { userId });
    }

    const [agent] = await db
      .insert(marketplaceAgents)
      .values({
        name: name.trim(),
        description: description.trim(),
        category: category.toLowerCase().trim(),
        systemPrompt,
        authorEmail,
        authorName,
        skillId: skillId || null,
        isPublic: true,
        installs: 0,
        rating: 0,
      })
      .returning();

    log.info("Agent published to marketplace", { agentId: agent.id, name, authorEmail });

    return NextResponse.json({ agent }, { status: 201 });
  } catch (err: unknown) {
    const pgCode = (err as { code?: string })?.code;
    const msg = err instanceof Error ? err.message : String(err);

    if (pgCode === "42P01" || msg.includes("does not exist")) {
      log.error("marketplace_agents table not found — run migration first");
      return NextResponse.json(
        { error: "Database tables not ready. Run the marketplace migration." },
        { status: 503 }
      );
    }

    log.error("Failed to publish agent", { error: msg });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
