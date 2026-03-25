import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { db } from "@/db";
import { customSkills } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { ai } from "@/lib/ai";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = await req.json();
  const { prompt } = body;

  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
  }

  const [skill] = await db
    .select()
    .from(customSkills)
    .where(and(eq(customSkills.id, id), eq(customSkills.userEmail, auth.email)));

  if (!skill) {
    return NextResponse.json({ error: "Skill not found." }, { status: 404 });
  }

  const start = performance.now();
  const result = await ai(prompt, {
    system: skill.systemPrompt,
  });
  const responseTimeMs = Math.round(performance.now() - start);

  return NextResponse.json({
    result,
    model: "auto",
    responseTimeMs,
  });
}
