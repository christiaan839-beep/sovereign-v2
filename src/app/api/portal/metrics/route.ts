import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads, generations, bookings, agentActivity } from "@/db/schema";
import { eq, desc, sql, count } from "drizzle-orm";
import { createLogger } from "@/lib/logger";
import { verifyPortalToken } from "@/lib/portal-tokens";
import { rateLimit } from "@/lib/rate-limit";

// Node runtime (was edge): portal-token HMAC verification and the shared
// rate limiter both need node:crypto.

const log = createLogger("portal/metrics");

const limiter = rateLimit({ interval: 60, limit: 30 });

/**
 * GET /api/portal/metrics?clientId=<id>&token=<signed portal token>
 *
 * Returns aggregated metrics for a client portal dashboard.
 * The clientId maps to userEmail or userId across tables.
 *
 * AUTH (wave 122, closes BACKLOG H4): requires a signed portal token
 * (query `token` or `Authorization: Bearer`) whose `sub` matches the
 * requested clientId. Previously the clientId — a guessable customer
 * email — was itself the credential, exposing per-tenant leads/bookings/
 * activity telemetry to anyone. Tokens are minted via POST
 * /api/portal/link (agency, Clerk-authed) or auto-onboard.
 */
export async function GET(req: NextRequest) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId") || searchParams.get("tenantId");

  if (!clientId) {
    return NextResponse.json(
      { success: false, error: "clientId is required" },
      { status: 400 },
    );
  }

  const bearer = req.headers.get("authorization");
  const token =
    searchParams.get("token") ||
    (bearer?.startsWith("Bearer ") ? bearer.slice(7) : null);

  if (!token) {
    return NextResponse.json(
      { success: false, error: "Portal token required", code: "unauthorized" },
      { status: 401 },
    );
  }

  const verdict = verifyPortalToken(token, clientId);
  if (!verdict.ok) {
    log.warn("Portal token rejected", {
      reason: verdict.reason,
      clientId: clientId.slice(0, 3) + "…", // never log the full identifier
    });
    return NextResponse.json(
      {
        success: false,
        error: "Invalid or expired link",
        code: "unauthorized",
      },
      { status: 401 },
    );
  }

  try {
    // Run all queries in parallel
    const [leadRows, genRows, bookingRows, activityRows, recentActivityRows] =
      await Promise.all([
        // Total leads for this client
        db
          .select({ total: count() })
          .from(leads)
          .where(eq(leads.userEmail, clientId)),

        // Total content generations
        db
          .select({ total: count() })
          .from(generations)
          .where(eq(generations.userEmail, clientId)),

        // Total bookings (tasks completed)
        db
          .select({ total: count() })
          .from(bookings)
          .where(eq(bookings.userEmail, clientId)),

        // Agent activity count (completed tasks)
        db
          .select({ total: count() })
          .from(agentActivity)
          .where(eq(agentActivity.userId, clientId)),

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
          .where(eq(agentActivity.userId, clientId))
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
      .where(eq(generations.userEmail, clientId))
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
