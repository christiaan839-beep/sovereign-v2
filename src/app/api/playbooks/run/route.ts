import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { playbookRuns, playbookRunSteps } from "@/db/schema";
import { getPlaybook, resolvePlaybookSteps } from "@/lib/playbooks";
import { checkPlanLimits, incrementUsage } from "@/lib/plan-enforcement";
import { enqueuePlaybookStep } from "@/lib/job-queue";
import { createLogger } from "@/lib/logger";

const log = createLogger("playbooks:run");

/**
 * POST /api/playbooks/run
 *
 * Kick off a playbook execution. Returns {runId, pollUrl} immediately
 * — the actual steps run asynchronously via the QStash-backed queue.
 * Clients poll /api/playbooks/runs/:id to watch progress in real time.
 *
 * Body:
 *   playbook_id: string                — required
 *   inputs:      Record<string, string> — optional user field values
 *
 * The legacy `async` flag is ignored — all runs are async now. Holding
 * an HTTP connection for multi-minute playbook chains hit Vercel's 60s
 * ceiling and silently killed runs mid-chain (fixed in phase 2.1).
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    playbook_id,
    inputs = {},
    // scheduled_id is sent by the dispatcher cron when the run is
    // triggered by a scheduled_playbooks row. NULL for user-triggered
    // runs. We only trust this when the call is internal (the factory
    // already gates internal-auth, but defense-in-depth: we validate
    // the shape here and silently drop garbage).
    scheduled_id,
  } = body as { playbook_id?: string; inputs?: Record<string, unknown>; scheduled_id?: string };

  const playbook = getPlaybook(playbook_id ?? "");
  if (!playbook) return NextResponse.json({ error: `Playbook "${playbook_id}" not found` }, { status: 404 });

  // UUID v4 shape check so a malformed scheduled_id can't corrupt the column.
  const validScheduledId =
    typeof scheduled_id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(scheduled_id)
      ? scheduled_id
      : null;

  // Plan enforcement — check monthly run limits
  const planCheck = await checkPlanLimits(userId);
  if (!planCheck.allowed) {
    return NextResponse.json(
      {
        error: planCheck.message,
        usage: { used: planCheck.used, limit: planCheck.limit, plan: planCheck.planName },
        upgradeUrl: planCheck.upgradeUrl,
      },
      { status: 429 },
    );
  }

  // Coerce inputs to Record<string,string> — resolvePlaybookSteps is
  // string-typed; anything non-string in the body gets stringified.
  const stringInputs: Record<string, string> = {};
  for (const [k, v] of Object.entries(inputs ?? {})) {
    stringInputs[k] = typeof v === "string" ? v : String(v ?? "");
  }
  const steps = resolvePlaybookSteps(playbook, stringInputs);
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_CHAT_ID || "";
  const hasTelegram = !!process.env.TELEGRAM_BOT_TOKEN && !!chatId;

  // Create run + all step rows as "pending". The worker flips each to
  // "running" → "done" / "failed" as it picks them up off the queue.
  let run: typeof playbookRuns.$inferSelect;
  try {
    [run] = await db
      .insert(playbookRuns)
      .values({
        userId,
        playbookId: playbook.id,
        playbookName: playbook.name,
        inputs: JSON.stringify(stringInputs),
        status: "running",
        stepCount: steps.length,
        notifyTelegram: hasTelegram,
        telegramChatId: chatId || null,
        scheduledId: validScheduledId,
      })
      .returning();

    await db.insert(playbookRunSteps).values(
      steps.map((step, i) => ({
        runId: run.id,
        stepIndex: i,
        agentName: step.agent,
        reason: step.reason || "",
        status: "pending" as const,
      })),
    );
  } catch (err: unknown) {
    const pgCode = (err as { code?: string })?.code;
    const msg = err instanceof Error ? err.message : String(err);
    if (pgCode === "42P01" || msg.includes("does not exist")) {
      log.error("DB table missing — run migrations", { error: msg });
      return NextResponse.json(
        {
          error: "Database tables not ready. Run migrations: drizzle/0003_playbook_runs.sql",
          hint: "Neon Console → SQL Editor → paste the migration file → Run",
        },
        { status: 503 },
      );
    }
    throw err;
  }

  log.info("playbook run queued", {
    runId: run.id,
    playbookId: playbook.id,
    userId,
    steps: steps.length,
  });

  // Track usage for plan enforcement (fire-and-forget)
  incrementUsage(userId).catch(() => {});

  // Enqueue ONLY step 0. The worker enqueues subsequent steps as each
  // one completes — keeps every step inside its own 60s budget.
  const enqueue = await enqueuePlaybookStep({
    runId: run.id,
    stepIndex: 0,
    agent: steps[0].agent,
    params: steps[0].params,
    userId,
  });

  return NextResponse.json(
    {
      runId: run.id,
      status: "running",
      pollUrl: `/api/playbooks/runs/${run.id}`,
      queueMode: enqueue.mode,
      jobId: enqueue.jobId,
    },
    { status: 202 },
  );
}

