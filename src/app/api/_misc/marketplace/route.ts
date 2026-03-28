import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { db } from "@/db";
import { marketplaceAgents } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const offset = (page - 1) * limit;

  const conditions = [eq(marketplaceAgents.isPublic, true)];
  if (category && category !== "all") {
    conditions.push(eq(marketplaceAgents.category, category));
  }

  const agents = await db
    .select()
    .from(marketplaceAgents)
    .where(and(...conditions))
    .orderBy(desc(marketplaceAgents.installs))
    .limit(limit)
    .offset(offset);

  return NextResponse.json({ agents, page, limit });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const body = await req.json();
  const { skillId, name, description, category, systemPrompt, authorName } = body;

  if (!name || !description || !category || !systemPrompt) {
    return NextResponse.json(
      { error: "Name, description, category, and system prompt are required." },
      { status: 400 }
    );
  }

  // Check if already published (by skillId if provided)
  if (skillId) {
    const existing = await db
      .select()
      .from(marketplaceAgents)
      .where(
        and(
          eq(marketplaceAgents.skillId, skillId),
          eq(marketplaceAgents.authorEmail, auth.email)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "This agent is already published to the marketplace." },
        { status: 409 }
      );
    }
  }

  const [agent] = await db
    .insert(marketplaceAgents)
    .values({
      skillId: skillId || null,
      authorEmail: auth.email,
      authorName: authorName || auth.email.split("@")[0],
      name,
      description,
      category,
      systemPrompt,
    })
    .returning();

  return NextResponse.json({ agent }, { status: 201 });
}
