import { NextResponse } from "next/server";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { executeGoal } from "@/lib/goal-executor";
import { sendTelegram, formatJobDone, formatJobFailed } from "@/lib/telegram";
import { createLogger } from "@/lib/logger";

const log = createLogger("cron:job-runner");

// Max jobs to process per tick — keeps response times predictable
const BATCH_SIZE = 5;

/**
 * GET /api/cron/job-runner
 *
 * Processes up to BATCH_SIZE pending jobs per invocation.
 * On Vercel: triggered every minute via vercel.json crons.
 * On Railway: triggered every 30s via instrumentation.ts interval.
 *
 * Protected by CRON_SECRET — do not expose publicly.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
    (request.headers.get("x-forwarded-proto") === "https"
      ? `https://${request.headers.get("host")}`
      : `http://${request.headers.get("host") || "localhost:3000"}`);

  // Claim pending jobs atomically — mark as running before fetching
  // to prevent duplicate processing if multiple cron ticks overlap
  const claimed = await db
    .update(jobs)
    .set({ status: "running", startedAt: new Date(), progress: 10 })
    .where(
      and(
        eq(jobs.status, "pending"),
        // Only claim jobs older than 2 seconds (avoid race on just-inserted jobs)
        sql`${jobs.createdAt} < now() - interval '2 seconds'`
      )
    )
    .returning({ id: jobs.id, userId: jobs.userId, goal: jobs.goal, telegramChatId: jobs.telegramChatId, notifyTelegram: jobs.notifyTelegram })
    // Drizzle doesn't support LIMIT on UPDATE in PG — select first, then update
    ;

  if (claimed.length === 0) {
    return NextResponse.json({ processed: 0, message: "No pending jobs" });
  }

  // Cap to BATCH_SIZE — extra claimed jobs get re-queued below
  const batch = claimed.slice(0, BATCH_SIZE);
  const overflow = claimed.slice(BATCH_SIZE);

  // Re-queue overflow back to pending
  if (overflow.length > 0) {
    await Promise.all(
      overflow.map(j =>
        db.update(jobs).set({ status: "pending", startedAt: null, progress: 0 }).where(eq(jobs.id, j.id))
      )
    );
  }

  let processed = 0;
  let failed = 0;

  await Promise.all(
    batch.map(async (job) => {
      try {
        log.info("executing job", { jobId: job.id, goal: job.goal.slice(0, 60) });

        await db.update(jobs).set({ progress: 30 }).where(eq(jobs.id, job.id));

        const execution = await executeGoal(job.goal, baseUrl, job.userId);

        await db.update(jobs).set({
          status: "done",
          progress: 100,
          result: JSON.stringify(execution.result),
          agentsUsed: JSON.stringify(execution.agents),
          completedAt: new Date(),
          durationMs: execution.durationMs,
        }).where(eq(jobs.id, job.id));

        if (job.notifyTelegram && job.telegramChatId) {
          await sendTelegram(
            job.telegramChatId,
            formatJobDone(job.goal, job.id, execution.durationMs, execution.agents)
          );
        }

        processed++;
        log.info("job done", { jobId: job.id, durationMs: execution.durationMs });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        log.error("job failed", { jobId: job.id, error: errorMsg });

        await db.update(jobs).set({
          status: "failed",
          error: errorMsg,
          completedAt: new Date(),
        }).where(eq(jobs.id, job.id));

        if (job.notifyTelegram && job.telegramChatId) {
          await sendTelegram(
            job.telegramChatId,
            formatJobFailed(job.goal, job.id, errorMsg)
          );
        }

        failed++;
      }
    })
  );

  return NextResponse.json({ processed, failed, batch: batch.length });
}
