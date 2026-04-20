import { db } from "@/db";
import { playbookRunSteps, playbookRuns } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createLogger } from "@/lib/logger";
import { getBaseUrl } from "@/lib/base-url";
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
    .select({ status: playbookRunSteps.status })
    .from(playbookRunSteps)
    .where(eq(playbookRunSteps.runId, runId));

  if (allSteps.length === 0) return;

  const anyFailed = allSteps.some((s) => s.status === "failed");
  const allDoneOrFailed = allSteps.every((s) => s.status === "done" || s.status === "failed");

  if (!allDoneOrFailed) return; // still running

  const finalStatus = anyFailed ? "failed" : "done";
  await db
    .update(playbookRuns)
    .set({
      status: finalStatus,
      completedAt: new Date(),
    })
    .where(eq(playbookRuns.id, runId));

  log.info("run completed", { runId, status: finalStatus, steps: allSteps.length });
}
