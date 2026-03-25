import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { db } from "@/db";
import { marketplaceAgents, customSkills } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { id } = await params;

  // Find the marketplace agent
  const [agent] = await db
    .select()
    .from(marketplaceAgents)
    .where(eq(marketplaceAgents.id, id))
    .limit(1);

  if (!agent) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  // Copy the agent to the user's custom skills
  const [skill] = await db
    .insert(customSkills)
    .values({
      userEmail: auth.email,
      name: agent.name,
      description: agent.description,
      systemPrompt: agent.systemPrompt,
    })
    .returning();

  // Increment install count
  await db
    .update(marketplaceAgents)
    .set({ installs: sql`${marketplaceAgents.installs} + 1` })
    .where(eq(marketplaceAgents.id, id));

  return NextResponse.json({ skill, message: "Agent installed successfully." });
}
