/**
 * GET /api/public/recent-runs — public landing-page ticker feed.
 *
 * Returns the last N completed playbook runs across all users with
 * PII-free, anonymized fields:
 *
 *   { runs: Array<{
 *       playbookId, playbookName,
 *       stepCount, stepsSucceeded, stepsFailed,
 *       durationMs, completedAt
 *     }>
 *   }
 *
 * Explicitly excluded:
 *   - userId / user hashes (even indirectly)
 *   - inputs (user-provided, could contain PII)
 *   - step results
 *   - location, IP, request meta
 *
 * Cache: 60s browser + 60s edge. Stats feel "live" but we don't hammer
 * the DB on every landing-page view.
 *
 * Empty-state behavior: returns { runs: [] } on DB error or zero rows.
 * The client's RecentRunsTicker renders null when runs.length === 0 —
 * no "fake activity" placeholder.
 */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { playbookRuns } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

const LIMIT = 10;

export async function GET(): Promise<Response> {
  try {
    const rows = await db
      .select({
        playbookId: playbookRuns.playbookId,
        playbookName: playbookRuns.playbookName,
        stepCount: playbookRuns.stepCount,
        stepsSucceeded: playbookRuns.stepsSucceeded,
        stepsFailed: playbookRuns.stepsFailed,
        durationMs: playbookRuns.durationMs,
        completedAt: playbookRuns.completedAt,
      })
      .from(playbookRuns)
      .where(eq(playbookRuns.status, "done"))
      .orderBy(desc(playbookRuns.completedAt))
      .limit(LIMIT);

    return NextResponse.json(
      { runs: rows, count: rows.length },
      {
        headers: {
          "Cache-Control": "public, max-age=60, s-maxage=60",
        },
      },
    );
  } catch {
    // Table missing (pre-migration bootstrap) or transient outage →
    // empty result. The client's ticker will hide itself on empty.
    return NextResponse.json(
      { runs: [], count: 0 },
      {
        headers: { "Cache-Control": "public, max-age=30, s-maxage=30" },
      },
    );
  }
}
