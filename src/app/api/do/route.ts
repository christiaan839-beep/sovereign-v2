import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { executeGoal } from "@/lib/goal-executor";
import { sendTelegram, formatJobStarted } from "@/lib/telegram";
import { createLogger } from "@/lib/logger";

const log = createLogger("do-api");

/**
 * THE SIMPLEST API IN THE PLATFORM
 *
 * POST /api/do
 * Body: { "goal": "Find SaaS leads in London and draft outreach emails" }
 *
 * Optional: { "async": true }
 * → Returns immediately with a job ID instead of waiting for the result.
 *   Agent runs in the background; result arrives via Telegram.
 *
 * Behind the scenes:
 * 1. Smart router classifies the goal
 * 2. Coordinator plans the steps
 * 3. Agents execute in sequence (or parallel via swarm)
 * 4. Results returned with citations and metadata
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Sign in to use /api/do" }, { status: 401 });

    const body = await req.json();
    const { goal, async: runAsync } = body;

    if (!goal || typeof goal !== "string" || goal.trim().length < 5) {
      return NextResponse.json({
        error: "Tell me what you need",
        example: 'POST /api/do { "goal": "Find 10 SaaS leads in Austin" }',
      }, { status: 400 });
    }

    // ── Async mode ────────────────────────────────────────────────────────────
    // Return a job ID immediately — the cron runner picks it up within 30s–1min.
    if (runAsync) {
      const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_CHAT_ID || "";
      const hasTelegram = !!process.env.TELEGRAM_BOT_TOKEN && !!chatId;

      const [job] = await db
        .insert(jobs)
        .values({
          userId,
          goal: goal.trim(),
          status: "pending",
          notifyTelegram: hasTelegram,
          telegramChatId: chatId || null,
        })
        .returning();

      if (hasTelegram) {
        sendTelegram(chatId, formatJobStarted(goal.trim(), job.id)).catch(() => {});
      }

      log.info("async job queued", { jobId: job.id, userId });

      return NextResponse.json({
        jobId: job.id,
        status: "pending",
        goal: job.goal,
        pollUrl: `/api/jobs/${job.id}`,
        message: hasTelegram
          ? "Job queued. You'll get a Telegram notification when it's done."
          : "Job queued. Poll pollUrl for status.",
      }, { status: 202 });
    }

    // ── Synchronous mode (default) ────────────────────────────────────────────
    const baseUrl = req.headers.get("x-forwarded-proto") === "https"
      ? `https://${req.headers.get("host")}`
      : `http://${req.headers.get("host") || "localhost:3000"}`;

    const execution = await executeGoal(goal.trim(), baseUrl, userId);

    return NextResponse.json({
      goal,
      agent: execution.agent,
      result: execution.result,
      durationMs: execution.durationMs,
      tip: "Want to run this in the background? Add \"async\": true to your request.",
    });
  } catch (err) {
    log.error("/api/do error", { error: String(err) });
    return NextResponse.json({ error: "Something went wrong. Try a simpler goal." }, { status: 500 });
  }
}

// GET: show usage
export async function GET() {
  return NextResponse.json({
    endpoint: "POST /api/do",
    description: "The simplest API. One goal, one result.",
    usage: {
      method: "POST",
      body: {
        goal: "string — describe what you need in plain English",
        async: "boolean (optional) — run in background, get result via Telegram",
      },
      examples: [
        { goal: "Find 10 SaaS leads in London and draft cold emails" },
        { goal: "Audit SEO for stripe.com", async: true },
      ],
    },
    tips: [
      "Be specific: 'Find dental clinics in Cape Town' > 'Find leads'",
      "Add async: true for long-running tasks — result arrives on Telegram",
      "Chain tasks: 'Audit SEO for stripe.com and write 3 blog posts targeting their keyword gaps'",
    ],
  });
}
