import { NextResponse } from "next/server";
import { db } from "@/db";
import { scheduledContent } from "@/db/schema";
import { eq, lte, and } from "drizzle-orm";

/**
 * Cron Content Publisher
 * 
 * Called on a schedule (e.g., every 5 minutes via Vercel Cron).
 * Checks for content items with status "scheduled" and scheduledAt <= now.
 * Fires the Social Media Swarm for each due item and updates status.
 */
export async function GET() {
  try {
    const now = new Date();

    // Find all content that is due for publishing
    const dueItems = await db
      .select()
      .from(scheduledContent)
      .where(
        and(
          eq(scheduledContent.status, "scheduled"),
          lte(scheduledContent.scheduledAt, now)
        )
      )
      .limit(10);

    if (dueItems.length === 0) {
      return NextResponse.json({ success: true, message: "No content due for publishing", published: 0 });
    }

    let published = 0;

    for (const item of dueItems) {
      try {
        // Trigger the external n8n workflow directly
        const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || "https://n8n.your-agency.com/webhook/omnidirector";
        
        await fetch(n8nWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "cron_publish",
            topic: item.topic,
            platform: item.platform,
          }),
        });

        // Update status to published
        await db
          .update(scheduledContent)
          .set({ status: "published" })
          .where(eq(scheduledContent.id, item.id));

        published++;
      } catch (err) {
        // Mark as failed if dispatch errors
        await db
          .update(scheduledContent)
          .set({ status: "failed" })
          .where(eq(scheduledContent.id, item.id));

        console.error(`[Content Publisher] Failed to publish "${item.topic}":`, err);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Published ${published} of ${dueItems.length} scheduled items`,
      published,
    });
  } catch (error) {
    console.error("[Content Publisher Error]:", error);
    return NextResponse.json({ error: "Content publisher failed" }, { status: 500 });
  }
}
