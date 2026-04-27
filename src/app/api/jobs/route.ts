import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { sendTelegram, formatJobStarted } from "@/lib/telegram";
import { createLogger } from "@/lib/logger";
import { handleDBError, isPgTableMissing } from "@/lib/db-error";
import { loggedFireForget } from "@/lib/safe-async";

const log = createLogger("jobs-api");

/**
 * POST /api/jobs
 * Create an async job — returns immediately with a job ID.
 * Agent runs in the background; result arrives via Telegram.
 *
 * Body: {
 *   goal: string           — plain English goal
 *   notifyTelegram?: bool  — send Telegram when done (default: true if BOT_TOKEN set)
 *   telegramChatId?: string — override chat ID (defaults to TELEGRAM_ADMIN_CHAT_ID)
 * }
 *
 * Returns: { jobId, status: "pending", pollUrl: "/api/jobs/<id>" }
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { goal, notifyTelegram, telegramChatId } = body;

  if (!goal || typeof goal !== "string" || goal.trim().length < 5) {
    return NextResponse.json(
      { error: "goal is required (5+ chars)" },
      { status: 400 },
    );
  }

  const hasTelegram = !!process.env.TELEGRAM_BOT_TOKEN;
  const shouldNotify = notifyTelegram ?? hasTelegram;
  const chatId =
    telegramChatId ||
    process.env.TELEGRAM_ADMIN_CHAT_ID ||
    process.env.TELEGRAM_CHAT_ID ||
    "";

  let job;
  try {
    [job] = await db
      .insert(jobs)
      .values({
        userId,
        goal: goal.trim(),
        status: "pending",
        notifyTelegram: shouldNotify && !!chatId,
        telegramChatId: chatId || null,
      })
      .returning();
  } catch (err: unknown) {
    if (isPgTableMissing(err)) {
      return handleDBError(err, { route: "/api/jobs" });
    }
    throw err;
  }

  log.info("job created", { jobId: job.id, userId });

  // Fire-and-forget Telegram acknowledgment
  if (shouldNotify && chatId) {
    loggedFireForget(
      sendTelegram(chatId, formatJobStarted(goal.trim(), job.id)),
      { source: "jobs:start", meta: { jobId: job.id } },
    );
  }

  return NextResponse.json(
    {
      jobId: job.id,
      status: "pending",
      goal: job.goal,
      pollUrl: `/api/jobs/${job.id}`,
      tip: "Poll pollUrl every few seconds, or wait for your Telegram notification.",
    },
    { status: 202 },
  );
}

/**
 * GET /api/jobs
 * List the current user's last 20 jobs.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const userJobs = await db
      .select({
        id: jobs.id,
        goal: jobs.goal,
        status: jobs.status,
        progress: jobs.progress,
        agentsUsed: jobs.agentsUsed,
        durationMs: jobs.durationMs,
        createdAt: jobs.createdAt,
        completedAt: jobs.completedAt,
      })
      .from(jobs)
      .where(eq(jobs.userId, userId))
      .orderBy(desc(jobs.createdAt))
      .limit(20);

    return NextResponse.json({ jobs: userJobs });
  } catch (err: unknown) {
    return handleDBError(err, {
      route: "/api/jobs",
      // Read-only list endpoint: when the migration hasn't run yet, render
      // an empty list rather than 503 the dashboard.
      emptyOnMissing: { jobs: [] },
    });
  }
}
