/**
 * /api/cron/rollup-agent-stats — nightly stats rollup.
 *
 * Schedule: 0 4 * * *  (4 AM UTC daily — after midnight everywhere that
 *                      matters, giving us a full UTC day of activity).
 *
 * What it does:
 *   - Aggregates yesterday's rows from `agent_activity` by agent_name
 *     (runs, successes, uniqueUsers) into `agent_stats_daily`.
 *   - Aggregates yesterday's rows from `playbook_run_steps` by agent_name
 *     (avgDurationMs) into the same agent_stats_daily rows.
 *
 * Idempotency:
 *   - Both INSERTs use ON CONFLICT (agent_slug, day) DO UPDATE so re-runs
 *     overwrite rather than duplicate.
 *
 * Cost tracking:
 *   - totalCostCents stays 0 for now — per-agent cost isn't tracked at
 *     the credit_transactions level yet. This will be wired when the
 *     credits ledger learns to tag transactions with agent_slug.
 *
 * Auth: Bearer CRON_SECRET via verifyCron (timing-safe compare).
 *
 * Both GET and POST are supported because Vercel Cron fires GET by
 * default, but some external schedulers (and our own e2e tests) use POST.
 */

import { NextResponse } from "next/server";
import { verifyCron } from "@/lib/cron-auth";
import { db } from "@/db";
import { sql } from "drizzle-orm";

async function handle(request: Request): Promise<Response> {
  const unauthorized = verifyCron(request);
  if (unauthorized) return unauthorized;

  try {
    // Phase 1 — Counts rollup from agent_activity.
    //
    // Yesterday's window is [CURRENT_DATE - 1 day, CURRENT_DATE).
    // Filters to finished rows only ("completed"/"failed") since
    // in-progress ("executed") shouldn't count as a run.
    const counts = await db.execute(sql`
      INSERT INTO agent_stats_daily
        (agent_slug, day, runs, successes, unique_users, total_cost_cents)
      SELECT
        agent_name AS agent_slug,
        (created_at AT TIME ZONE 'UTC')::date AS day,
        COUNT(*) FILTER (WHERE action IN ('completed', 'failed'))::int AS runs,
        COUNT(*) FILTER (WHERE action = 'completed')::int AS successes,
        COUNT(DISTINCT user_id)::int AS unique_users,
        0 AS total_cost_cents
      FROM agent_activity
      WHERE created_at >= (CURRENT_DATE - INTERVAL '1 day')
        AND created_at <  CURRENT_DATE
        AND action IN ('completed', 'failed')
      GROUP BY agent_name, (created_at AT TIME ZONE 'UTC')::date
      ON CONFLICT (agent_slug, day) DO UPDATE SET
        runs = EXCLUDED.runs,
        successes = EXCLUDED.successes,
        unique_users = EXCLUDED.unique_users
    `);

    // Phase 2 — Duration rollup from playbook_run_steps.
    //
    // Uses INSERT...SELECT so that if an agent appears in steps but NOT
    // in activity, we still get a row (albeit runs=0). Then ON CONFLICT
    // UPDATE patches the duration on the existing row.
    const durations = await db.execute(sql`
      INSERT INTO agent_stats_daily
        (agent_slug, day, runs, successes, avg_duration_ms, total_cost_cents)
      SELECT
        agent_name AS agent_slug,
        (started_at AT TIME ZONE 'UTC')::date AS day,
        0 AS runs,
        0 AS successes,
        AVG(duration_ms)::int AS avg_duration_ms,
        0 AS total_cost_cents
      FROM playbook_run_steps
      WHERE started_at >= (CURRENT_DATE - INTERVAL '1 day')
        AND started_at <  CURRENT_DATE
        AND duration_ms IS NOT NULL
        AND status IN ('done', 'failed')
      GROUP BY agent_name, (started_at AT TIME ZONE 'UTC')::date
      ON CONFLICT (agent_slug, day) DO UPDATE SET
        avg_duration_ms = EXCLUDED.avg_duration_ms
    `);

    return NextResponse.json({
      ok: true,
      countsAffected: (counts as { rowCount?: number })?.rowCount ?? 0,
      durationsAffected: (durations as { rowCount?: number })?.rowCount ?? 0,
      rolledUpDay: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return handle(request);
}

export async function GET(request: Request) {
  return handle(request);
}
