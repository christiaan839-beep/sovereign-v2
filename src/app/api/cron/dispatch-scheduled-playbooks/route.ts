import { NextResponse } from "next/server";
import { listDueNow, markDispatched, markFailed } from "@/lib/scheduled-playbooks";
import { getBaseUrl } from "@/lib/base-url";
import { createLogger } from "@/lib/logger";
import { verifyCron } from "@/lib/cron-auth";

const log = createLogger("dispatch-scheduled-playbooks");

/**
 * GET /api/cron/dispatch-scheduled-playbooks
 *
 * Runs every minute. Selects schedules where next_run_at <= now() AND
 * active = true, kicks off each playbook via an internal HTTP call to
 * /api/playbooks/run (which already handles the QStash enqueueing),
 * then recomputes next_run_at.
 *
 * Why an HTTP self-call instead of direct queue enqueue?
 *   - The same pipeline runs for user-triggered + scheduled playbooks
 *     (paywall, credits, safety, memory — all consistent)
 *   - A broken scheduled playbook fails the same way a user one does
 *   - Cost: one extra HTTP hop (~50ms), dwarfed by the LLM call itself
 *
 * Failure handling:
 *   - HTTP error → markFailed() increments failure_count; auto-pauses
 *     after 5 consecutive failures (prevents runaway credit burn)
 *   - Network error / 5xx → treated as failure (same path)
 *   - 402 Insufficient credits → also a failure, but the cadence stays
 *     intact; user tops up and the next tick reactivates
 *
 * Batch size = 100 per tick so a large surge (1000 users all set for
 * "every Monday 9am") gets smoothed across 10 minutes rather than
 * flooding the agent API.
 */

const BATCH_SIZE = 100;

export async function GET(req: Request) {
  // Round 25 — was string-compare without timingSafeEqual. verifyCron
  // is the canonical helper.
  const cronErr = verifyCron(req);
  if (cronErr) return cronErr;

  const due = await listDueNow(BATCH_SIZE);
  if (due.length === 0) {
    return NextResponse.json({ ok: true, dispatched: 0, failed: 0 });
  }

  let dispatched = 0;
  let failed = 0;
  const baseUrl = getBaseUrl();

  // Process sequentially — we'd rather be slow + reliable than fast +
  // overwhelming the agent API. If 100 schedules fire in one minute,
  // that's ~100 × 200ms = 20s to enqueue all of them, which fits
  // inside Vercel's default 60s function ceiling.
  for (const schedule of due) {
    try {
      const inputs = safeParseInputs(schedule.inputs);
      const res = await fetch(`${baseUrl}/api/playbooks/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // verifyCron above ensures CRON_SECRET is set; the `?? ""`
          // is a no-op at runtime but pleases the type system after
          // we removed the local CRON_SECRET const.
          "X-Sovereign-Internal-Secret": process.env.CRON_SECRET ?? "",
          "X-Sovereign-User-Id": schedule.userId,
        },
        body: JSON.stringify({
          playbook_id: schedule.playbookId,
          inputs,
          // Link the run back to this schedule so the dashboard can
          // show "ran via scheduled 'Monday SEO audit'".
          scheduled_id: schedule.id,
        }),
        signal: AbortSignal.timeout(20_000),
      });

      if (!res.ok) {
        log.warn("Scheduled playbook dispatch failed", {
          scheduleId: schedule.id,
          userId: schedule.userId,
          playbookId: schedule.playbookId,
          status: res.status,
        });
        await markFailed(schedule.id);
        failed++;
        continue;
      }

      const body = (await res.json().catch(() => ({}))) as { runId?: string };
      const runId = typeof body.runId === "string" ? body.runId : "";
      await markDispatched(schedule.id, runId);
      dispatched++;
    } catch (err) {
      log.error("Dispatcher error", {
        scheduleId: schedule.id,
        error: (err as Error).message,
      });
      await markFailed(schedule.id);
      failed++;
    }
  }

  log.info("Dispatch tick complete", { dispatched, failed, total: due.length });
  return NextResponse.json({
    ok: true,
    dispatched,
    failed,
    ranAt: new Date().toISOString(),
  });
}

/** Defensive parse — a malformed inputs column shouldn't break the whole tick. */
function safeParseInputs(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
    return {};
  } catch {
    return {};
  }
}
