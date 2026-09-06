import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { playbookRuns, playbookRunSteps } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getPlaybook, resolvePlaybookSteps } from "@/lib/playbooks";
import { sendTelegram } from "@/lib/telegram";
import { getBaseUrl } from "@/lib/base-url";
import { checkPlanLimits, incrementUsage } from "@/lib/plan-enforcement";
import { createLogger } from "@/lib/logger";
import {
  buildPlaybookDag,
  executeDag,
  resolveStepParams,
  type StepOutcome,
} from "@/lib/playbook-dag";

const log = createLogger("playbooks:run");

/**
 * POST /api/playbooks/run
 *
 * Execute a playbook — each step is written to DB in real-time so the
 * frontend can poll /api/playbooks/runs/:id and watch steps light up live.
 *
 * Body: {
 *   playbook_id: string
 *   inputs: Record<string, string>   — user field values
 *   async?: boolean                  — return runId immediately, execute in background
 * }
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    playbook_id,
    inputs = {},
    async: runAsync = false,
  } = await req.json();

  const playbook = getPlaybook(playbook_id);
  if (!playbook)
    return NextResponse.json(
      { error: `Playbook "${playbook_id}" not found` },
      { status: 404 },
    );

  // ── Plan enforcement — check monthly run limits ──
  const planCheck = await checkPlanLimits(userId);
  if (!planCheck.allowed) {
    return NextResponse.json(
      {
        error: planCheck.message,
        usage: {
          used: planCheck.used,
          limit: planCheck.limit,
          plan: planCheck.planName,
        },
        upgradeUrl: planCheck.upgradeUrl,
      },
      { status: 429 },
    );
  }

  // Resolve template fields
  const steps = resolvePlaybookSteps(playbook, inputs);

  const chatId =
    process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_CHAT_ID || "";
  const hasTelegram = !!process.env.TELEGRAM_BOT_TOKEN && !!chatId;

  // Create run record (gracefully handle missing tables)
  let run: typeof playbookRuns.$inferSelect;
  try {
    [run] = await db
      .insert(playbookRuns)
      .values({
        userId,
        playbookId: playbook.id,
        playbookName: playbook.name,
        inputs: JSON.stringify(inputs),
        status: "running",
        stepCount: steps.length,
        notifyTelegram: hasTelegram,
        telegramChatId: chatId || null,
      })
      .returning();

    // Pre-create all step records as "pending"
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
          error:
            "Database tables not ready. Run migrations: drizzle/0003_playbook_runs.sql",
          hint: "Neon Console → SQL Editor → paste the migration file → Run",
        },
        { status: 503 },
      );
    }
    throw err; // Re-throw if it's a different error
  }

  log.info("playbook run started", {
    runId: run.id,
    playbookId: playbook.id,
    userId,
    steps: steps.length,
  });

  // Track usage for plan enforcement (logs warnings when approaching limits)
  incrementUsage(userId).catch(() => {});

  if (runAsync) {
    // Start execution in background, return immediately
    executePlaybook(run.id, steps, userId).catch((err) =>
      log.error("async playbook failed", { runId: run.id, error: String(err) }),
    );
    return NextResponse.json(
      {
        runId: run.id,
        status: "running",
        pollUrl: `/api/playbooks/runs/${run.id}`,
      },
      { status: 202 },
    );
  }

  // Synchronous — execute and wait
  await executePlaybook(run.id, steps, userId);
  const [finalRun] = await db
    .select()
    .from(playbookRuns)
    .where(eq(playbookRuns.id, run.id))
    .limit(1);
  return NextResponse.json({
    runId: run.id,
    status: finalRun.status,
    pollUrl: `/api/playbooks/runs/${run.id}`,
  });
}

/* ─── Core execution engine ─── */

async function executePlaybook(
  runId: string,
  steps: Array<{
    agent: string;
    params: Record<string, string>;
    reason?: string;
  }>,
  userId: string,
) {
  const baseUrl = getBaseUrl();
  const start = Date.now();

  // Pre-fetch step IDs so we can update by primary key (not by runId which hits ALL steps)
  const stepRows = await db
    .select({ id: playbookRunSteps.id, stepIndex: playbookRunSteps.stepIndex })
    .from(playbookRunSteps)
    .where(eq(playbookRunSteps.runId, runId))
    .orderBy(playbookRunSteps.stepIndex);
  const stepIdMap = new Map(stepRows.map((s) => [s.stepIndex, s.id]));

  // Wave 112 — the {{step_N}} references the playbook already declares
  // ARE the dependency graph. Independent steps now run concurrently
  // instead of queueing behind each other in a for-loop.
  const { nodes, warnings } = buildPlaybookDag(steps);
  for (const w of warnings)
    log.warn("playbook step reference dropped", { runId, detail: w });

  const runStep = async (
    i: number,
    depOutputs: Record<number, string>,
  ): Promise<StepOutcome> => {
    const step = steps[i];
    const stepId = stepIdMap.get(i);
    if (!stepId) {
      log.error(`step ${i} has no DB row`, { runId });
      return { status: "failed", error: "step row missing" };
    }

    await db
      .update(playbookRunSteps)
      .set({ status: "running", startedAt: new Date() })
      .where(eq(playbookRunSteps.id, stepId));

    const stepStart = Date.now();

    try {
      // Resolve {{step_N}} references against the steps this one declared.
      const params = resolveStepParams(step.params, depOutputs);

      // Steps that declare no inputs keep the historical implicit
      // "previous step becomes context" behaviour.
      const node = nodes[i];
      if (!node.explicit) {
        const prev = depOutputs[i - 1];
        if (prev) params.context = prev.slice(0, 1500);
      }

      // NOTE: deliberately a bare fetch(), not `outboundFetch`. This is a
      // loopback dispatch to this app's own API — outboundFetch always
      // enforces the SSRF guard, which blocks localhost/private hosts by
      // design, so routing this through it would break every playbook in
      // dev and any self-hosted deployment. The destination is
      // `getBaseUrl()` + a registry agent slug, never a user-supplied URL.
      // eslint-disable-next-line no-restricted-syntax -- internal self-call, not user-controlled egress
      const res = await fetch(`${baseUrl}/api/agents/${step.agent}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Sovereign-Internal": "playbook-runner",
          Authorization: `Bearer ${process.env.CRON_SECRET}`,
          "X-User-Id": userId,
        },
        body: JSON.stringify({ ...params, confirmed: true }),
        signal: AbortSignal.timeout(90_000),
      });

      const data = await res.json();
      const resultText = typeof data === "string" ? data : JSON.stringify(data);

      await db
        .update(playbookRunSteps)
        .set({
          status: "done",
          result: resultText.slice(0, 8000),
          durationMs: Date.now() - stepStart,
          completedAt: new Date(),
        })
        .where(eq(playbookRunSteps.id, stepId));

      log.info(`step ${i + 1}/${steps.length} done`, {
        agent: step.agent,
        runId,
      });
      return { status: "done", output: resultText };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      log.error(`step ${i + 1} failed`, {
        agent: step.agent,
        error: errorMsg,
        runId,
      });

      await db
        .update(playbookRunSteps)
        .set({
          status: "failed",
          error: errorMsg,
          durationMs: Date.now() - stepStart,
          completedAt: new Date(),
        })
        .where(eq(playbookRunSteps.id, stepId));

      return { status: "failed", error: errorMsg };
    }
  };

  // A step whose input never arrived is skipped rather than run against
  // an empty prompt — that used to cost a full model call to synthesise
  // nothing.
  const onSkip = async (i: number, reason: string) => {
    const stepId = stepIdMap.get(i);
    log.warn(`step ${i + 1} skipped`, {
      agent: steps[i]?.agent,
      reason,
      runId,
    });
    if (!stepId) return;
    await db
      .update(playbookRunSteps)
      .set({
        status: "skipped",
        error: `Skipped — ${reason}`,
        durationMs: 0,
        completedAt: new Date(),
      })
      .where(eq(playbookRunSteps.id, stepId));
  };

  const { succeeded, failed, skipped, maxParallelism } = await executeDag(
    nodes,
    runStep,
    { onSkip },
  );

  const totalMs = Date.now() - start;
  const unfinished = failed + skipped;
  const finalStatus = unfinished > 0 && succeeded === 0 ? "failed" : "done";

  await db
    .update(playbookRuns)
    .set({
      status: finalStatus,
      stepsSucceeded: succeeded,
      // No steps_skipped column — a skipped step didn't succeed, so it
      // counts here to keep succeeded + failed === stepCount.
      stepsFailed: unfinished,
      durationMs: totalMs,
      completedAt: new Date(),
    })
    .where(eq(playbookRuns.id, runId));

  // Telegram notification
  const [run] = await db
    .select()
    .from(playbookRuns)
    .where(eq(playbookRuns.id, runId))
    .limit(1);
  if (run.notifyTelegram && run.telegramChatId) {
    const emoji = finalStatus === "done" ? "✅" : "⚠️";
    const shortId = runId.slice(-8);
    await sendTelegram(
      run.telegramChatId,
      [
        `${emoji} *Playbook complete* \`${shortId}\``,
        ``,
        `*${run.playbookName}*`,
        `${succeeded}/${steps.length} steps succeeded · ${(totalMs / 1000).toFixed(1)}s`,
        ``,
        `View at /dashboard/autopilot`,
      ].join("\n"),
    );
  }

  log.info("playbook run complete", {
    runId,
    succeeded,
    failed,
    skipped,
    maxParallelism,
    totalMs,
  });
}
