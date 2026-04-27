import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { leads, generations, bookings, agentActivity } from "@/db/schema";
import { eq, desc, sql, count } from "drizzle-orm";
import { createLogger } from "@/lib/logger";
import { verifyShareToken } from "@/lib/portal-share-link";

// node:crypto (used by verifyShareToken via portal-share-link) requires
// the Node runtime — declared explicitly so the build doesn't trace
// the route into Edge bundles. The route was previously `runtime = "edge"`,
// which only worked because nothing in it touched Node APIs.
export const runtime = "nodejs";

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
 * Two valid auth paths:
 *
 *   1. Clerk-authenticated caller AND caller.userId/email matches
 *      the requested clientId. Supports the common case where the
 *      user logs into Sovereign and views their own portal.
 *
 *   2. A signed HMAC share token (?token=<HMAC>) from
 *      src/lib/portal-share-link.ts. Lets agencies hand out a
 *      share URL to a client who doesn't have a Sovereign account.
 *      The token is HMAC-SHA256 over clientId + PORTAL_SHARE_SECRET,
 *      so it can't be forged. Rotating PORTAL_SHARE_SECRET kills
 *      every outstanding share link.
 *
 * Anything else returns 404 (not 403) so the URL doesn't leak
 * whether the clientId exists. An attacker probing emails can't
 * tell "this user exists but isn't you" from "this user doesn't
 * exist".
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId") || searchParams.get("tenantId");
  const token = searchParams.get("token");

  if (!clientId) {
    return NextResponse.json(
      { success: false, error: "clientId is required" },
      { status: 400 }
    );
  }

  // Path 2 first: a valid HMAC token is sufficient on its own.
  // The token IS the proof of authorization (the agency vouched
  // for the client by minting it).
  if (token && verifyShareToken(clientId, token)) {
    // Token verified — fall through to the metrics computation.
  } else {
    // Path 1: Clerk auth + ownership match.
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
      log.warn("portal access denied — caller does not own clientId and no valid token", {
        callerUserId: userId,
        callerEmail,
        requestedClientId: clientId,
        tokenProvided: Boolean(token),
      });
      return NextResponse.json(
        { success: false, error: "Not found" },
        { status: 404 }
      );
    }
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
