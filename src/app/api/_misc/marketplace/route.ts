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

  // ── AGENT QUALITY GATE — prevent slop/harmful agents ──
  const VALID_CATEGORIES = ["sales", "content", "seo", "code", "automation", "research", "voice", "analytics"];
  if (!VALID_CATEGORIES.includes(category)) {
    return NextResponse.json(
      { error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}` },
      { status: 400 }
    );
  }

  if (name.length < 3 || name.length > 60) {
    return NextResponse.json({ error: "Agent name must be 3-60 characters." }, { status: 400 });
  }

  if (description.length < 20 || description.length > 500) {
    return NextResponse.json({ error: "Description must be 20-500 characters." }, { status: 400 });
  }

  if (systemPrompt.length < 50) {
    return NextResponse.json({ error: "System prompt must be at least 50 characters (quality requirement)." }, { status: 400 });
  }

  // Block harmful content in system prompts
  const BLOCKED_PATTERNS = [
    /ignore.*previous.*instructions/i,
    /jailbreak/i,
    /bypass.*safety/i,
    /pretend.*you.*are.*not/i,
    /act.*as.*if.*no.*rules/i,
    /generate.*malware/i,
    /create.*weapon/i,
    /illegal/i,
  ];

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(systemPrompt) || pattern.test(description)) {
      return NextResponse.json(
        { error: "Agent submission rejected by safety review. System prompt contains blocked content." },
        { status: 403 }
      );
    }
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
