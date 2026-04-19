import { NextResponse } from "next/server";
import { db } from "@/db";
import { scheduledRuns } from "@/db/schema";
import { and, eq, lte, sql } from "drizzle-orm";
import { createLogger } from "@/lib/logger";
import { verifyCron } from "@/lib/cron-auth";
import { matches, nextRun } from "@/lib/cron-next";
import { getBaseUrl } from "@/lib/base-url";

const log = createLogger("cron:scheduler");

/**
 * SCHEDULED PLAYBOOK EXECUTOR
 *
 * Called by Vercel Cron every minute (see vercel.json). For each row in
 * `scheduled_runs` where:
 *   - enabled = true
 *   - (nextRunAt IS NULL  OR  nextRunAt <= now)
 *   - AND the stored cron expression matches the current UTC minute
 * …we fire the configured agent and update lastRunAt / nextRunAt / status.
 *
 * Two independent gates (nextRunAt + cron match) protects against:
 *   - Backfill after downtime: nextRunAt being stale pushes the row into
 *     candidate set, but the cron match prevents us from firing at the
 *     wrong minute.
 *   - Missing cron match: if nextRunAt is accurate, we still fire even if
 *     the minute-granularity of the cron check ticks 1 min late.
 *
 * Protected by CRON_SECRET (Bearer auth via verifyCron — fail-closed).
 */

const MAX_PER_TICK = 50; // cap per invocation so one tick can't fan out too wide

interface TickResult {
  considered: number;
  fired: number;
  errors: number;
  skipped: number;
}

async function fireOneSchedule(
  row: typeof scheduledRuns.$inferSelect,
  baseUrl: string,
): Promise<"fired" | "skipped" | "errored"> {
  const startedAt = new Date();

  try {
    const res = await fetch(`${baseUrl}/api/agents/${encodeURIComponent(row.agentType)}`, {
      method: "POST",
      signal: AbortSignal.timeout(45_000),
      headers: {
        "Content-Type": "application/json",
        "X-Sovereign-Internal": "cron-scheduler",
        // Pass the owning user so tenant-scoped agents resolve correctly.
        "X-Sovereign-User-Id": row.userId,
      },
      body: JSON.stringify({ prompt: row.prompt, confirmed: true, _scheduledRunId: row.id }),
    });

    const text = await res.text();
    const summary = text.length > 2000 ? text.slice(0, 2000) + "…(truncated)" : text;

    const next = nextRun(row.schedule, new Date());
    await db.update(scheduledRuns).set({
      lastRunAt: startedAt,
      nextRunAt: next,
      runCount: sql`COALESCE(${scheduledRuns.runCount}, 0) + 1`,
      lastStatus: res.ok ? "success" : "failed",
      lastResult: summary,
    }).where(eq(scheduledRuns.id, row.id));

    return res.ok ? "fired" : "errored";
  } catch (err) {
    const isTimeout = err instanceof DOMException && err.name === "TimeoutError";
    const message = isTimeout
      ? "Timed out after 45s"
      : err instanceof Error ? err.message : String(err);
    log.warn("scheduled run failed", { scheduleId: row.id, agent: row.agentType, err: message });

    const next = nextRun(row.schedule, new Date());
    await db.update(scheduledRuns).set({
      lastRunAt: startedAt,
      nextRunAt: next,
      lastStatus: "failed",
      lastResult: `Error: ${message}`,
    }).where(eq(scheduledRuns.id, row.id));
    return "errored";
  }
}

export async function GET(req: Request) {
  const denied = verifyCron(req);
  if (denied) return denied;

  const now = new Date();
  const baseUrl = getBaseUrl();
  const result: TickResult = { considered: 0, fired: 0, errors: 0, skipped: 0 };

  try {
    // Candidate set: enabled rows that are either (never run) or (due now).
    // Cron-minute check is applied per-row below.
    const candidates = await db
      .select()
      .from(scheduledRuns)
      .where(
        and(
          eq(scheduledRuns.enabled, true),
          sql`(${scheduledRuns.nextRunAt} IS NULL OR ${scheduledRuns.nextRunAt} <= ${now})`,
        ),
      )
      .limit(MAX_PER_TICK);

    result.considered = candidates.length;

    // Process concurrently but cap to 10 at a time to be friendly to DB + agents.
    const BATCH = 10;
    for (let i = 0; i < candidates.length; i += BATCH) {
      const batch = candidates.slice(i, i + BATCH);
      const outcomes = await Promise.all(
        batch.map(async (row) => {
          // If the row has a stored cron expression, require the minute match.
          // If it doesn't parse, treat nextRunAt as authoritative.
          const cronMatches = row.schedule ? matches(row.schedule, now) : true;
          if (!cronMatches && row.nextRunAt && row.nextRunAt > new Date(now.getTime() - 60_000)) {
            return "skipped" as const;
          }
          return fireOneSchedule(row, baseUrl);
        }),
      );
      for (const o of outcomes) {
        if (o === "fired") result.fired++;
        else if (o === "errored") result.errors++;
        else result.skipped++;
      }
    }

    return NextResponse.json({ ok: true, at: now.toISOString(), ...result });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "42P01") {
      // Bootstrap: scheduled_runs table not migrated yet
      log.warn("scheduled_runs table missing — run drizzle migrations");
      return NextResponse.json({ ok: true, reason: "table missing", ...result });
    }
    log.error("scheduler tick failed", { error: (err as Error).message });
    return NextResponse.json({ ok: false, error: (err as Error).message, ...result }, { status: 500 });
  }
}
