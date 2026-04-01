import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { desc, eq, and, gte, sql, count, countDistinct } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const since = searchParams.get("since") || "7d";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = 20;
  const offset = (page - 1) * limit;

  // Calculate since date
  const sinceDate = new Date();
  if (since === "24h") sinceDate.setHours(sinceDate.getHours() - 24);
  else if (since === "7d") sinceDate.setDate(sinceDate.getDate() - 7);
  else if (since === "30d") sinceDate.setDate(sinceDate.getDate() - 30);
  else if (since === "all") sinceDate.setFullYear(2020);

  // CRITICAL: Scope audit logs to the authenticated user.
  // Without this filter, any authenticated user could read ALL audit logs.
  const conditions = [
    eq(auditLogs.userId, userId),
    gte(auditLogs.createdAt, sinceDate),
  ];
  if (action) conditions.push(eq(auditLogs.action, action));

  const [logs, totalResult, uniqueUsersResult, topActionResult] = await Promise.all([
    db
      .select()
      .from(auditLogs)
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ value: count() })
      .from(auditLogs)
      .where(and(...conditions)),
    db
      .select({ value: countDistinct(auditLogs.userId) })
      .from(auditLogs)
      .where(and(...conditions)),
    db
      .select({ action: auditLogs.action, value: count() })
      .from(auditLogs)
      .where(and(...conditions))
      .groupBy(auditLogs.action)
      .orderBy(desc(sql`count(*)`))
      .limit(1),
  ]);

  const total = totalResult[0]?.value ?? 0;
  const uniqueUsers = uniqueUsersResult[0]?.value ?? 0;
  const topAction = topActionResult[0]?.action ?? "N/A";

  return NextResponse.json({
    logs,
    page,
    limit,
    total,
    totalPages: Math.ceil(Number(total) / limit),
    summary: {
      totalEvents: Number(total),
      uniqueUsers: Number(uniqueUsers),
      topAction,
    },
  });
}
