import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { scheduledContent } from "@/db/schema";
import { requireAuth } from "@/lib/auth-guard";
import { createLogger } from "@/lib/logger";

const log = createLogger("content-schedule");

// Queues a content asset for publishing by writing it into the same
// scheduled_content table the cron publisher (src/app/api/_cron/
// content-publisher/route.ts) already polls and dispatches to
// N8N_WEBHOOK_URL. Previously this route validated the payload and
// returned a fake "QUEUED" success without persisting anything.

const scheduleSchema = z.object({
  campaignId: z.string().optional(),
  platform: z.enum(["linkedin", "twitter", "instagram"]),
  content: z.string().min(1).max(10_000),
  executeAt: z.string().datetime(),
});

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const payload = await req.json();
    const validated = scheduleSchema.parse(payload);

    const scheduledAt = new Date(validated.executeAt);

    const [row] = await db
      .insert(scheduledContent)
      .values({
        topic: validated.content,
        caption: validated.content,
        platform: validated.platform,
        scheduledAt,
        status: "scheduled",
      })
      .returning();

    return NextResponse.json({
      success: true,
      id: row.id,
      status: row.status,
      targetPlatform: validated.platform,
      scheduledFor: scheduledAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid schedule payload", details: error.issues },
        { status: 400 },
      );
    }
    log.error("Content schedule error", error as Record<string, unknown>);
    return NextResponse.json({ error: "TRANSMISSION_FAILED" }, { status: 500 });
  }
}
