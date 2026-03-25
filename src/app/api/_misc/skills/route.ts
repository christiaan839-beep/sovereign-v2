import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { db } from "@/db";
import { customSkills } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const skills = await db
    .select()
    .from(customSkills)
    .where(eq(customSkills.userEmail, auth.email))
    .orderBy(desc(customSkills.createdAt));

  return NextResponse.json({ skills });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const body = await req.json();
  const { name, description, systemPrompt } = body;

  if (!name || !systemPrompt) {
    return NextResponse.json(
      { error: "Name and system prompt are required." },
      { status: 400 }
    );
  }

  const [skill] = await db
    .insert(customSkills)
    .values({
      userEmail: auth.email,
      name,
      description: description || null,
      systemPrompt,
    })
    .returning();

  return NextResponse.json({ skill }, { status: 201 });
}
