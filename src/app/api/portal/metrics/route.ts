import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { leads, generations, bookings, agentActivity } from "@/db/schema";
import { eq, desc, sql, count } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

// Edge runtime is fine — Clerk's auth() works on Edge.
export const runtime = "edge";

const log = createLogger("portal/metrics");

/**
 * GET /api/portal/metrics?clientId=<email-or-userId>
 *
 * Returns aggregated metrics for a client portal dashboard.
 * The `clientId` parameter maps to userEmail / userId across tables.
 *
 * SECURITY MODEL
 * ──────────────
 * Earlier versions of this route declared "No auth required — the
 * clientId itself acts as the access token." That was wrong: clientId
 * is just the user's email, which is NOT a secret. Anyone who knew
 * any user's email could call:
 *
 *     GET /api/portal/metrics?clientId=victim@example.com
 *
 * …and get back their lead count, generation count, recent agent
 * activity (with summary text), and revenue-by-agent. Cross-tenant
 * data leak.
 *
 * The fix: require a Clerk-authenticated caller AND the caller's
 * email/userId must match the requested clientId. If you need
 * cross-account access (e.g., agency admin viewing a client's
 * portal), the right primitive is a signed HMAC share link with a
 * server-side secret — that's tracked as a follow-up. For now the
 * route fails closed.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId") || searchParams.get("tenantId");

  if (!clientId) {
    return NextResponse.json(
      { success: false, error: "clientId is required" },
      { status: 400 }
    );
  }

  // Auth + ownership check. Caller must be signed in AND requesting
  // their own metrics. We accept either a userId match OR an email
  // match because different tables key by different columns and the
  // clientId is provided by the front-end which doesn't always know
  // which one to use.
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const user = await currentUser();
  const callerEmail = user?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? "";
  const requested = clientId.toLowerCase();
  const ownsThisPortal =
    requested === userId.toLowerCase() || requested === callerEmail;

  if (!ownsThisPortal) {
    log.warn("portal access denied — caller does not own clientId", {
      callerUserId: userId,
      callerEmail,
      requestedClientId: clientId,
    });
    // Return 404 instead of 403 so the URL doesn't leak whether the
    // clientId exists. An attacker probing emails can't tell apart
    // "this user exists but isn't you" vs "this user doesn't exist".
    return NextResponse.json(
      { success: false, error: "Not found" },
      { status: 404 }
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
    const seoScore = Math.min(100, Math.round((contentCount * 3 + leadsCount) * 1.5));

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
      .groupBy(generations.tool, sql`to_char(${generations.createdAt}, 'YYYY-MM')`)
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
      { status: 200 }
    );
  }
}
