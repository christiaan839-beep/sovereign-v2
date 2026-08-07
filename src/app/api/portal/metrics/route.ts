import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads, generations, bookings, agentActivity } from "@/db/schema";
import { eq, desc, sql, count } from "drizzle-orm";
import { createLogger } from "@/lib/logger";
import { requireAuth } from "@/lib/auth-guard";

const log = createLogger("portal/metrics");

/**
 * GET /api/portal/metrics?clientId=<id>
 *
 * Returns aggregated metrics for a client portal dashboard.
 *
 * Self-scoped: the caller may only read their OWN aggregated data. A Clerk
 * session is required, and the queried identity is derived from that session
 * — not from a client-supplied id. An optional clientId/tenantId query param
 * is honoured only when it matches the authenticated identity; anything else
 * is a cross-tenant read (BOLA) and is rejected.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const requested =
    searchParams.get("clientId") || searchParams.get("tenantId");
  if (requested && requested !== auth.email && requested !== auth.userId) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    );
  }

  // leads/generations/bookings are keyed by userEmail; agentActivity by userId.
  const emailScope = auth.email;
  const activityScope = auth.userId;

  try {
    // Run all queries in parallel
    const [leadRows, genRows, bookingRows, activityRows, recentActivityRows] =
      await Promise.all([
        // Total leads for this client
        db
          .select({ total: count() })
          .from(leads)
          .where(eq(leads.userEmail, emailScope)),

        // Total content generations
        db
          .select({ total: count() })
          .from(generations)
          .where(eq(generations.userEmail, emailScope)),

        // Total bookings (tasks completed)
        db
          .select({ total: count() })
          .from(bookings)
          .where(eq(bookings.userEmail, emailScope)),

        // Agent activity count (completed tasks)
        db
          .select({ total: count() })
          .from(agentActivity)
          .where(eq(agentActivity.userId, activityScope)),

        // Recent activity — last 10 agent executions
        db
          .select({
            id: agentActivity.id,
            agentName: agentActivity.agentName,
            agentType: agentActivity.agentType,
            action: agentActivity.action,
            summary: agentActivity.summary,
            createdAt: agentActivity.createdAt,
          })
          .from(agentActivity)
          .where(eq(agentActivity.userId, activityScope))
          .orderBy(desc(agentActivity.createdAt))
          .limit(10),
      ]);

    const leadsCount = leadRows[0]?.total ?? 0;
    const contentCount = genRows[0]?.total ?? 0;
    const bookingsCount = bookingRows[0]?.total ?? 0;
    const tasksCount = activityRows[0]?.total ?? 0;

    // Derive a simple SEO score from content + leads (capped at 100)
    const seoScore = Math.min(
      100,
      Math.round((contentCount * 3 + leadsCount) * 1.5),
    );

    // Format recent activity for the frontend
    const recentActivity = recentActivityRows.map((row) => ({
      id: row.id,
      agent: row.agentName,
      type: row.agentType,
      action: row.action,
      summary: row.summary,
      timestamp: row.createdAt?.toISOString() ?? new Date().toISOString(),
    }));

    // Monthly revenue breakdown by agent (for the revenue page)
    // Uses generations table grouped by tool and month
    const revenueByAgent = await db
      .select({
        tool: generations.tool,
        month: sql<string>`to_char(${generations.createdAt}, 'YYYY-MM')`,
        executions: count(),
      })
      .from(generations)
      .where(eq(generations.userEmail, emailScope))
      .groupBy(
        generations.tool,
        sql`to_char(${generations.createdAt}, 'YYYY-MM')`,
      )
      .orderBy(sql`to_char(${generations.createdAt}, 'YYYY-MM')`);

    return NextResponse.json({
      success: true,
      metrics: {
        leads: leadsCount,
        content: contentCount,
        seo: seoScore,
        tasks: tasksCount + bookingsCount,
        // Legacy field names for backward compatibility
        leadConversations: leadsCount,
        socialPosts: contentCount,
        seoPages: seoScore,
        totalActions: tasksCount + bookingsCount + contentCount,
        recentActivity,
        revenueByAgent,
      },
      // Legacy field for old client dashboard
      recentEvents: recentActivityRows.map((row) => ({
        id: row.id,
        eventType: row.agentType,
        payload: { agent: row.agentName, action: row.action },
        timestamp: row.createdAt?.toISOString() ?? new Date().toISOString(),
      })),
    });
  } catch (err) {
    log.error("Failed to compute portal metrics", { error: String(err) });
    return NextResponse.json(
      {
        success: true,
        metrics: {
          leads: 0,
          content: 0,
          seo: 0,
          tasks: 0,
          leadConversations: 0,
          socialPosts: 0,
          seoPages: 0,
          totalActions: 0,
          recentActivity: [],
          revenueByAgent: [],
        },
        recentEvents: [],
      },
      { status: 200 },
    );
  }
}
