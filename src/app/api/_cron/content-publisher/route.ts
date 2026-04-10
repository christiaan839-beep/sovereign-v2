import { NextResponse } from "next/server";
import { db } from "@/db";
import { scheduledContent } from "@/db/schema";
import { eq, lte, and } from "drizzle-orm";
import { createLogger } from "@/lib/logger";
import { requireCronAuth } from "@/lib/cron-auth";
const log = createLogger("content-publisher");

/**
 * Cron Content Publisher
 *
 * Called on a schedule (e.g., every 5 minutes via Vercel Cron).
 * Checks for content items with status "scheduled" and scheduledAt <= now.
 * Fires the Social Media Swarm for each due item and updates status.
 */
export async function GET(req: Request) {
  const authErr = requireCronAuth(req);
  if (authErr) return authErr;

  try {
    const now = new Date();

    // Find all content that is due for publishing
    const dueItems = await db
      .select()
      .from(scheduledContent)
      .where(
        and(
          eq(scheduledContent.status, "scheduled"),
          lte(scheduledContent.scheduledAt, now),
        ),
      )
      .limit(10);

    if (dueItems.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No content due for publishing",
        published: 0,
      });
    }

    let published = 0;

    for (const item of dueItems) {
      try {
        // Trigger the external n8n workflow directly
        const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
        if (!n8nWebhookUrl) {
          log.warn("N8N_WEBHOOK_URL not set — skipping publish");
          continue;
        }

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

        log.error(
          `Failed to publish "${item.topic}"`,
          err as Record<string, unknown>,
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: `Published ${published} of ${dueItems.length} scheduled items`,
      published,
    });
  } catch (error) {
    log.error("Content publisher error", error as Record<string, unknown>);
    return NextResponse.json(
      { error: "Content publisher failed" },
      { status: 500 },
    );
  }
}
