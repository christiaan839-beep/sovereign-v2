import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/db";
import { marketplaceAgents, customSkills } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("marketplace-install");

/**
 * POST /api/marketplace/:id/install
 *
 * Install a marketplace agent into the user's custom skills.
 * - Copies the agent's systemPrompt into the customSkills table
 * - Increments the marketplace agent's install counter
 * - Returns the newly created custom skill
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: agentId } = await params;

  try {
    // Fetch the marketplace agent
    const [agent] = await db
      .select()
      .from(marketplaceAgents)
      .where(eq(marketplaceAgents.id, agentId))
      .limit(1);

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Resolve user email from Clerk
    let userEmail = "unknown@sovereign.ai";
    try {
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      userEmail = user.emailAddresses?.[0]?.emailAddress || userEmail;
    } catch {
      log.warn("Could not resolve Clerk user email for install", { userId });
    }

    // Copy agent into user's custom skills
    const [skill] = await db
      .insert(customSkills)
      .values({
        userEmail,
        name: agent.name,
        description: agent.description,
        systemPrompt: agent.systemPrompt,
      })
      .returning();

    // Increment install counter atomically
    await db
      .update(marketplaceAgents)
      .set({ installs: sql`${marketplaceAgents.installs} + 1` })
      .where(eq(marketplaceAgents.id, agentId));

    log.info("Agent installed", {
      agentId,
      agentName: agent.name,
      userId,
      skillId: skill.id,
    });

    return NextResponse.json({ skill, agentId });
  } catch (err: unknown) {
    const pgCode = (err as { code?: string })?.code;
    const msg = err instanceof Error ? err.message : String(err);

    if (pgCode === "42P01" || msg.includes("does not exist")) {
      log.error("Database tables not ready for marketplace install");
      return NextResponse.json(
        { error: "Database tables not ready. Run the marketplace migration." },
        { status: 503 }
      );
    }

    log.error("Failed to install agent", { error: msg, agentId });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
