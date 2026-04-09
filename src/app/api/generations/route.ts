import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { generations } from "@/db/schema";
import { eq, desc, and, gte, count } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/generations");

const DAILY_LIMIT = 20;

/**
 * GET /api/generations
 * List all generations for the authenticated user (by email).
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress;
  if (!email) {
    return NextResponse.json({ error: "No email found for user" }, { status: 400 });
  }

  try {
    const rows = await db
      .select()
      .from(generations)
      .where(eq(generations.userEmail, email))
      .orderBy(desc(generations.createdAt))
      .limit(100);

    return NextResponse.json(rows);
  } catch (err: unknown) {
    const pgCode = (err as { code?: string })?.code;
    const msg = err instanceof Error ? err.message : String(err);
    if (pgCode === "42P01" || msg.includes("does not exist")) {
      log.warn("generations table not found — returning empty list");
      return NextResponse.json([]);
    }
    log.error("Failed to list generations", { error: msg });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/generations
 * With { action: "usage" }: return usage stats for today.
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress;
  if (!email) {
    return NextResponse.json({ error: "No email found for user" }, { status: 400 });
  }

  try {
    const body = await req.json();

    if (body.action === "usage") {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [todayResult] = await db
        .select({ value: count() })
        .from(generations)
        .where(
          and(
            eq(generations.userEmail, email),
            gte(generations.createdAt, todayStart)
          )
        );

      const [totalResult] = await db
        .select({ value: count() })
        .from(generations)
        .where(eq(generations.userEmail, email));

      const today = todayResult?.value ?? 0;
      const total = totalResult?.value ?? 0;

      return NextResponse.json({
        today,
        total,
        limit: DAILY_LIMIT,
        remaining: Math.max(0, DAILY_LIMIT - today),
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: unknown) {
    const pgCode = (err as { code?: string })?.code;
    const msg = err instanceof Error ? err.message : String(err);
    if (pgCode === "42P01" || msg.includes("does not exist")) {
      log.warn("generations table not found — returning zero usage");
      return NextResponse.json({
        today: 0,
        total: 0,
        limit: DAILY_LIMIT,
        remaining: DAILY_LIMIT,
      });
    }
    log.error("Failed to get generation usage", { error: msg });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
