import { NextResponse } from "next/server";
import { db } from "@/db";
import { generations } from "@/db/schema";
import { eq, desc, sql, and, gte } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-guard";

const DAILY_LIMIT_FREE = 20;

export async function POST(req: Request) {
  const auth = await requireAuth(); if (auth.error) return auth.error;
  try {
    const { action, ...data } = await req.json();
    const userEmail = auth.email || "admin@umbra.ai";

    // Save a new generation
    if (action === "save") {
      const { tool, toolAction, inputSummary, output } = data;
      if (!tool || !output) {
        return NextResponse.json({ error: "Missing tool or output" }, { status: 400 });
      }

      // Estimate tokens (~4 chars per token)
      const tokens = Math.ceil(output.length / 4);

      await db.insert(generations).values({
        userEmail,
        tool: tool,
        action: toolAction || "default",
        inputSummary: inputSummary || "",
        output: output,
        tokens: tokens,
      });

      return NextResponse.json({ success: true, tokens });
    }

    // List user's history
    if (action === "list") {
      const { page = 1, tool: filterTool } = data;
      const limit = 20;
      const offset = (page - 1) * limit;

      const conditions = [eq(generations.userEmail, userEmail)];
      if (filterTool) {
        conditions.push(eq(generations.tool, filterTool));
      }

      const results = await db
        .select({
          id: generations.id,
          tool: generations.tool,
          action: generations.action,
          inputSummary: generations.inputSummary,
          tokens: generations.tokens,
          createdAt: generations.createdAt,
          // Don't load full output in list view — too heavy
        })
        .from(generations)
        .where(and(...conditions))
        .orderBy(desc(generations.createdAt))
        .limit(limit)
        .offset(offset);

      return NextResponse.json({ success: true, results });
    }

    // Get a single generation's full output
    if (action === "get") {
      const { id } = data;
      if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

      const result = await db
        .select()
        .from(generations)
        .where(and(eq(generations.id, id), eq(generations.userEmail, userEmail)))
        .limit(1);

      if (result.length === 0) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      return NextResponse.json({ success: true, result: result[0] });
    }

    // Usage stats for today
    if (action === "usage") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [{ count: todayCount }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(generations)
        .where(
          and(
            eq(generations.userEmail, userEmail),
            gte(generations.createdAt, today)
          )
        );

      const [{ count: totalCount }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(generations)
        .where(eq(generations.userEmail, userEmail));

      return NextResponse.json({
        success: true,
        today: todayCount || 0,
        total: totalCount || 0,
        limit: DAILY_LIMIT_FREE,
        remaining: Math.max(0, DAILY_LIMIT_FREE - (todayCount || 0)),
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[Generations API Error]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
