import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { creditTransactions } from "@/db/schema";
import { and, desc, eq, lt } from "drizzle-orm";

/**
 * GET /api/credits/history?limit=20&cursor=<tx_id>
 *
 * Paginated ledger view for the billing page. Cursor is the ID of the
 * last entry from the previous page — simple keyset pagination.
 *
 * Returns at most 100 rows per request. The widget asks for 5; the
 * billing page asks for 20; anything over 100 is clamped.
 *
 * Response shape:
 *   { entries: Array<{id, deltaCents, reason, agentId, runId, createdAt}>, nextCursor: string | null }
 */
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const rawLimit = Number(url.searchParams.get("limit") ?? "20");
  const limit = Math.min(100, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 20));
  const cursor = url.searchParams.get("cursor");

  const whereClauses = cursor
    ? and(eq(creditTransactions.userId, userId), lt(creditTransactions.id, cursor))
    : eq(creditTransactions.userId, userId);

  const rows = await db
    .select()
    .from(creditTransactions)
    .where(whereClauses)
    .orderBy(desc(creditTransactions.createdAt))
    .limit(limit);

  const nextCursor = rows.length === limit ? rows[rows.length - 1].id : null;

  return NextResponse.json({
    entries: rows.map((r) => ({
      id: r.id,
      deltaCents: r.deltaCents,
      reason: r.reason,
      agentId: r.agentId,
      runId: r.runId,
      createdAt: r.createdAt,
    })),
    nextCursor,
  });
}
