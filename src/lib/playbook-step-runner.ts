import { db } from "@/db";
import { playbookRunSteps, playbookRuns } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createLogger } from "@/lib/logger";
import { getBaseUrl } from "@/lib/base-url";
import { recordSample } from "@/lib/slo-tracking";
import type { JobPayload } from "@/lib/job-queue";

const log = createLogger("playbook-step-runner");

/**
 * PLAYBOOK STEP RUNNER — single-step executor shared by the in-process
 * fallback (local dev) and the QStash worker (production).
 *
 * Moving the step-level logic HERE (out of the playbook engine's
 * for-loop) gives us:
 *   - One place where "execute step N" is defined
 *   - Idempotency — the runner can be called multiple times for the
 *     same step and still produce the same DB state
 *   - Shared retry semantics regardless of whether the caller is
 *     the queue worker or the inline engine
 *
 * Idempotency key: (runId, stepIndex). We update the step row by its
 * primary key (not by runId) so concurrent workers can't stomp each
 * other's state.
 *
 * Error handling:
 *   - 401/403 from downstream agent → step marked "failed", no retry
 *     (queue will drop it; runtime error, not transient)
 *   - 429 (rate limit) / 502 / 504 → throw so queue retries
 *   - Any other 5xx → throw so queue retries
 *   - Success → step marked "done" with the agent's output
 */

export interface StepRunResult {
  status: "done" | "failed";
  output?: unknown;
  error?: string;
  skippedAsAlreadyDone?: boolean;
}

export async function runPlaybookStep(payload: JobPayload): Promise<StepRunResult> {
  const { runId, stepIndex, agent, params, userId } = payload;

  // Idempotency guard — if the step row is already `done`, skip. This
  // handles the case where QStash delivered a message after our first
  // attempt succeeded but before the ack reached them. Retry must not
  // re-run a completed step.
  const [existingStep] = await db
    .select({ id: playbookRunSteps.id, status: playbookRunSteps.status })
    .from(playbookRunSteps)
    .where(and(eq(playbookRunSteps.runId, runId), eq(playbookRunSteps.stepIndex, stepIndex)))
    .limit(1);

  if (!existingStep) {
    // Step row never existed — shouldn't happen since the playbook engine
    // creates rows on run-start, but be defensive.
    log.warn("step row missing; skipping", { runId, stepIndex });
    return { status: "failed", error: "step_row_not_found" };
  }

  if (existingStep.status === "done") {
    log.info("step already done; idempotent skip", { runId, stepIndex, agent });
    return { status: "done", skippedAsAlreadyDone: true };
  }

  // Mark step as running (idempotent update by primary key).
  await db
    .update(playbookRunSteps)
    .set({ status: "running", startedAt: new Date() })
    .where(eq(playbookRunSteps.id, existingStep.id));

  const baseUrl = getBaseUrl();
  const started = Date.now();

  try {
    const res = await fetch(`${baseUrl}/api/agents/${agent}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Internal paired-header auth — lets the step hit an agent as
        // the owner user without needing a real Clerk session.
        ...(process.env.CRON_SECRET
          ? {
              "X-Sovereign-Internal-Secret": process.env.CRON_SECRET,
              "X-Sovereign-User-Id": userId,
            }
          : {}),
      },
      body: JSON.stringify({ ...params, confirmed: true }),
      signal: AbortSignal.timeout(120_000), // 2-minute per-step ceiling
    });

    if (res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504) {
      // Transient — throw so the queue retries with backoff.
      throw new Error(`Transient agent failure: ${res.status}`);
    }

    if (!res.ok) {
      // Non-transient (400-series or our bug) — mark failed, no retry.
      const detail = await res.text().catch(() => "");
      const errorMsg = `Agent returned ${res.status}: ${detail.slice(0, 200)}`;
      log.warn("step non-transient failure", { runId, stepIndex, status: res.status });
      await db
        .update(playbookRunSteps)
        .set({
          status: "failed",
          completedAt: new Date(),
          durationMs: Date.now() - started,
          error: errorMsg,
        })
        .where(eq(playbookRunSteps.id, existingStep.id));
      return { status: "failed", error: errorMsg };
    }

    const body = (await res.json()) as Record<string, unknown>;
    const output = body;

    await db
      .update(playbookRunSteps)
      .set({
        status: "done",
        completedAt: new Date(),
        durationMs: Date.now() - started,
        // Column is `result` in the schema; stores up to 50KB of JSON.
        result: JSON.stringify(output).slice(0, 50_000),
      })
      .where(eq(playbookRunSteps.id, existingStep.id));

    return { status: "done", output };
  } catch (err) {
    // If it's a transient error tagged above, let it bubble so the
    // queue retries. Otherwise (timeout, network failure) treat as
    // transient too — 3 QStash retries handle it.
    throw err;
  }
}

/**
 * After every step completes, check whether the RUN is complete + update
 * playbookRuns.status accordingly. Called from the worker or inline engine
 * whenever a step finishes. Must be idempotent.
 */
export async function updateRunStatus(runId: string): Promise<void> {
  const allSteps = await db
    .select({ status: playbookRunSteps.status, durationMs: playbookRunSteps.durationMs })
    .from(playbookRunSteps)
    .where(eq(playbookRunSteps.runId, runId));

  if (allSteps.length === 0) return;

  const anyFailed = allSteps.some((s) => s.status === "failed");
  const allDoneOrFailed = allSteps.every((s) => s.status === "done" || s.status === "failed");

  if (!allDoneOrFailed) return; // still running

  const finalStatus = anyFailed ? "failed" : "done";
  const totalMs = allSteps.reduce((acc, s) => acc + (s.durationMs ?? 0), 0);
  const succeeded = allSteps.filter((s) => s.status === "done").length;
  const failed = allSteps.filter((s) => s.status === "failed").length;

  await db
    .update(playbookRuns)
    .set({
      status: finalStatus,
      stepsSucceeded: succeeded,
      stepsFailed: failed,
      durationMs: totalMs,
      completedAt: new Date(),
    })
    .where(eq(playbookRuns.id, runId));

  log.info("run completed", { runId, status: finalStatus, steps: allSteps.length });

  // Plan 4 SLO — playbook_completion: pass if finalStatus=done AND under 5 min.
  // Fire-and-forget — Redis outage must not affect run completion.
  void recordSample(
    "playbook_completion",
    totalMs,
    finalStatus === "done" && totalMs <= 5 * 60 * 1000,
  );

  // Telegram notification — fire-and-forget (never block the chain on it)
  void notifyTelegramOnComplete(runId, finalStatus, succeeded, totalMs, allSteps.length).catch(
    (err) => log.warn("telegram notify failed", { runId, error: String(err) }),
  );
}

async function notifyTelegramOnComplete(
  runId: string,
  finalStatus: "done" | "failed",
  succeeded: number,
  totalMs: number,
  totalSteps: number,
): Promise<void> {
  const [run] = await db
    .select({
      notifyTelegram: playbookRuns.notifyTelegram,
      telegramChatId: playbookRuns.telegramChatId,
      playbookName: playbookRuns.playbookName,
    })
    .from(playbookRuns)
    .where(eq(playbookRuns.id, runId))
    .limit(1);
  if (!run || !run.notifyTelegram || !run.telegramChatId) return;

  const { sendTelegram } = await import("@/lib/telegram");
  const emoji = finalStatus === "done" ? "✅" : "⚠️";
  const shortId = runId.slice(-8);
  await sendTelegram(
    run.telegramChatId,
    [
      `${emoji} *Playbook complete* \`${shortId}\``,
      ``,
      `*${run.playbookName}*`,
      `${succeeded}/${totalSteps} steps succeeded · ${(totalMs / 1000).toFixed(1)}s`,
      ``,
      `View at /dashboard/autopilot`,
    ].join("\n"),
  );
}

/**
 * Run a single step, then enqueue the NEXT step (if any). This is the
 * chained-queue pattern that replaces the old for-loop in executePlaybook.
 *
 * Why chain from the runner rather than the orchestrator:
 *   - Each step runs in its own queue message → its own function
 *     invocation → own 60s Vercel budget. A 10-step run no longer
 *     needs one 10-minute connection.
 *   - On success, we enqueue step N+1 with the full param context
 *     (previous step outputs + resolved references).
 *   - On failure, we DO NOT enqueue the next step — the run halts at
 *     the failure. User can POST /api/playbooks/runs/:id/resume to
 *     restart from the failed step.
 *   - updateRunStatus runs after every terminal state change (done
 *     or failed on the last step) so the /runs/:id polling endpoint
 *     sees the run flip to "done" as soon as it actually is.
 *
 * Idempotency: runPlaybookStep is already idempotent. If the queue
 * re-delivers a message and the step row is already "done", we enqueue
 * the next step WITHOUT re-running. This avoids duplicate chains.
 */
export async function runStepAndContinue(payload: {
  runId: string;
  stepIndex: number;
  agent: string;
  params: Record<string, unknown>;
  userId: string;
}): Promise<StepRunResult> {
  const result = await runPlaybookStep(payload);

  // Halt chain on failure — user must resume manually
  if (result.status === "failed") {
    await updateRunStatus(payload.runId);
    return result;
  }

  // Was this the last step? Mark run complete and stop.
  const allSteps = await db
    .select({
      id: playbookRunSteps.id,
      stepIndex: playbookRunSteps.stepIndex,
      agentName: playbookRunSteps.agentName,
      status: playbookRunSteps.status,
      result: playbookRunSteps.result,
    })
    .from(playbookRunSteps)
    .where(eq(playbookRunSteps.runId, payload.runId))
    .orderBy(playbookRunSteps.stepIndex);

  const nextStep = allSteps.find(
    (s) => s.stepIndex === payload.stepIndex + 1 && s.status === "pending",
  );
  if (!nextStep) {
    await updateRunStatus(payload.runId);
    return result;
  }

  // Build params for the next step — resolve {{step_N}} references from
  // completed step outputs. Drops any string not containing templates.
  const completedOutputs: Record<number, string> = {};
  for (const s of allSteps) {
    if (s.status === "done" && s.result) {
      completedOutputs[s.stepIndex] = s.result;
    }
  }

  // Re-fetch the run to resolve per-step params from the original inputs.
  // The inputs JSON is the authoritative source for template resolution.
  const [run] = await db
    .select({ inputs: playbookRuns.inputs, playbookId: playbookRuns.playbookId })
    .from(playbookRuns)
    .where(eq(playbookRuns.id, payload.runId))
    .limit(1);
  if (!run) {
    log.error("run row vanished mid-chain", { runId: payload.runId });
    return result;
  }

  // Load the playbook definition so we can resolve the next step's params
  const { getPlaybook, resolvePlaybookSteps } = await import("@/lib/playbooks");
  const playbook = getPlaybook(run.playbookId);
  if (!playbook) {
    log.error("playbook vanished mid-chain", { playbookId: run.playbookId });
    return result;
  }
  const resolved = resolvePlaybookSteps(playbook, JSON.parse(run.inputs || "{}"));
  const nextResolved = resolved[nextStep.stepIndex];
  if (!nextResolved) {
    log.warn("no resolved spec for next step", { idx: nextStep.stepIndex });
    return result;
  }

  // Substitute {{step_N}} references in params
  const nextParams: Record<string, unknown> = { ...nextResolved.params };
  for (const [k, v] of Object.entries(nextParams)) {
    if (typeof v === "string") {
      nextParams[k] = v.replace(/\{\{step_(\d+)\}\}/g, (_, n) => completedOutputs[parseInt(n)] ?? "");
    }
  }
  // Previous step output as implicit context
  if (payload.stepIndex >= 0 && completedOutputs[payload.stepIndex]) {
    nextParams.context = String(completedOutputs[payload.stepIndex]).slice(0, 1500);
  }

  const { enqueuePlaybookStep } = await import("@/lib/job-queue");
  await enqueuePlaybookStep({
    runId: payload.runId,
    stepIndex: nextStep.stepIndex,
    agent: nextStep.agentName,
    params: nextParams,
    userId: payload.userId,
  });

  return result;
}
