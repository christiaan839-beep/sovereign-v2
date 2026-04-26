import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { db } from "@/db";
import { customSkills } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { ai } from "@/lib/ai";
import {
  checkFreeUsage,
  incrementUsage,
  getSmartUpgradeInfo,
} from "@/lib/free-tier";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  // Plan limit gate
  const userId = auth.userId || "";
  if (userId) {
    const usage = await checkFreeUsage(userId);
    if (!usage.allowed) {
      const upgrade = await getSmartUpgradeInfo(userId);
      return NextResponse.json(
        {
          error: "Usage limit reached",
          message: `You've used all ${upgrade.currentLimit} runs this month.`,
          upgrade,
          code: "USAGE_LIMIT_REACHED",
        },
        { status: 429 },
      );
    }
  }

  const { id } = await params;
  const body = await req.json();
  const { prompt } = body;

  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
  }

  const [skill] = await db
    .select()
    .from(customSkills)
    .where(
      and(eq(customSkills.id, id), eq(customSkills.userEmail, auth.email)),
    );

  if (!skill) {
    return NextResponse.json({ error: "Skill not found." }, { status: 404 });
  }

  const start = performance.now();
  const result = await ai(prompt, {
    system: skill.systemPrompt,
  });
  const responseTimeMs = Math.round(performance.now() - start);

  // Increment usage for the run
  if (userId) incrementUsage(userId, `skill:${id}`).catch(() => {});

  return NextResponse.json({
    result,
    model: "auto",
    responseTimeMs,
  });
}
