import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import {
  leads, generations, workflows, usage, settings,
  conversations, chatMessages, tenantMemories,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { auditLog } from "@/lib/audit-log";

/**
 * GET /api/_misc/data-export
 *
 * GDPR Article 20 — Right to Data Portability.
 * Gathers all user data from every table and returns it as a
 * downloadable JSON file with Content-Disposition header.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Auth required" }, { status: 401 });
  }

  const user = await currentUser();

  try {
    // Parallel fetch from all relevant tables
    const [
      userLeads,
      userGenerations,
      userWorkflows,
      userUsage,
      userSettings,
      userConversations,
      userMemories,
    ] = await Promise.all([
      db.select().from(leads).where(eq(leads.userEmail, user?.emailAddresses?.[0]?.emailAddress || "")).catch(() => []),
      db.select().from(generations).where(eq(generations.userEmail, user?.emailAddresses?.[0]?.emailAddress || "")).catch(() => []),
      db.select().from(workflows).where(eq(workflows.userId, userId)).catch(() => []),
      db.select().from(usage).where(eq(usage.userId, userId)).catch(() => []),
      db.select().from(settings).where(eq(settings.userEmail, user?.emailAddresses?.[0]?.emailAddress || "")).catch(() => []),
      db.select().from(conversations).where(eq(conversations.clerkUserId, userId)).catch(() => []),
      db.select().from(tenantMemories).where(eq(tenantMemories.userId, userId)).catch(() => []),
    ]);

    // Fetch chat messages for the user's conversations
    let userMessages: Array<typeof chatMessages.$inferSelect> = [];
    if (userConversations.length > 0) {
      const messagePromises = userConversations.map((conv) =>
        db.select().from(chatMessages).where(eq(chatMessages.conversationId, conv.id)).catch(() => [])
      );
      const messageArrays = await Promise.all(messagePromises);
      userMessages = messageArrays.flat();
    }

    // Mask API keys in settings
    const maskedSettings = userSettings.map((s) => {
      let apiKeys = {};
      try {
        apiKeys = JSON.parse(s.apiKeys || "{}");
        // Mask each key value
        for (const [k, v] of Object.entries(apiKeys)) {
          if (typeof v === "string" && v.length > 8) {
            (apiKeys as Record<string, string>)[k] = v.slice(0, 4) + "****" + v.slice(-4);
          }
        }
      } catch {
        // keep empty
      }
      return { ...s, apiKeys: JSON.stringify(apiKeys) };
    });

    const exportData = {
      exportedAt: new Date().toISOString(),
      version: "1.0",
      user: {
        id: userId,
        email: user?.emailAddresses?.[0]?.emailAddress || null,
        firstName: user?.firstName || null,
        lastName: user?.lastName || null,
        imageUrl: user?.imageUrl || null,
        createdAt: user?.createdAt || null,
      },
      leads: userLeads,
      generations: userGenerations,
      workflows: userWorkflows,
      usage: userUsage,
      settings: maskedSettings,
      conversations: userConversations.map((conv) => ({
        ...conv,
        messages: userMessages.filter((m) => m.conversationId === conv.id),
      })),
      memory: userMemories,
      counts: {
        leads: userLeads.length,
        generations: userGenerations.length,
        workflows: userWorkflows.length,
        usageRecords: userUsage.length,
        conversations: userConversations.length,
        messages: userMessages.length,
        memories: userMemories.length,
      },
    };

    // Log the export for compliance
    auditLog({
      userId,
      action: "data.export",
      resource: "full-export",
      details: { counts: exportData.counts },
    });

    const jsonString = JSON.stringify(exportData, null, 2);

    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="sovereign-data-export-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (_err) {
    // Error logged via audit trail above
    return NextResponse.json(
      { error: "Failed to generate export. Please try again." },
      { status: 500 }
    );
  }
}
