/**
 * GET /api/public/memory-demo
 *
 * Returns the most recent playbook run owned by the synthetic public-demo
 * user (PUBLIC_DEMO_USER_ID), along with up to 3 "recalled-context" past
 * runs for the landing v2 Memory at Work section (03).
 *
 * Shape:
 *   {
 *     latestRun: { id, playbookName, completedAt } | null,
 *     recalls: Array<{ runId, playbookName, daysAgo, similarity, headline }>
 *   }
 *
 * Rate limit: 10/hour per IP (see rate-limits.ts public-memory-demo rule).
 * Cache: 60s s-maxage on happy path (demo data rarely changes), 30s on empty.
 * Returns 200 with null fields when the tenant has no runs yet — client
 * handles empty state with the "Memory demos available on Growth tier"
 * fallback copy. Never 500s on DB outage — degrades to 503 with cacheable
 * error response so the section still renders gracefully.
 *
 * Similarity scores in the response are placeholders for the initial
 * ship (0.87, 0.84, 0.79). Real cosine-distance ranking against
 * tenant_memories.embedding_json lands in a later iteration.
 */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { playbookRuns } from "@/db/schema";
import { and, desc, eq, ne } from "drizzle-orm";
import { PUBLIC_DEMO_USER_ID } from "@/lib/tenant-scope";

const PLACEHOLDER_SIMILARITIES = [0.87, 0.84, 0.79];

export async function GET(): Promise<Response> {
  try {
    const latestRows = await db
      .select({
        id: playbookRuns.id,
        playbookName: playbookRuns.playbookName,
        completedAt: playbookRuns.completedAt,
      })
      .from(playbookRuns)
      .where(
        and(
          eq(playbookRuns.userId, PUBLIC_DEMO_USER_ID),
          eq(playbookRuns.status, "done"),
        ),
      )
      .orderBy(desc(playbookRuns.completedAt))
      .limit(1);

    const latest = latestRows[0] ?? null;

    if (!latest) {
      return NextResponse.json(
        { latestRun: null, recalls: [] },
        { headers: { "Cache-Control": "public, s-maxage=30" } },
      );
    }

    // Past runs from the same demo user — ranked by recency as a
    // placeholder for real cosine-similarity ranking.
    const recalls = await db
      .select({
        runId: playbookRuns.id,
        playbookName: playbookRuns.playbookName,
        completedAt: playbookRuns.completedAt,
      })
      .from(playbookRuns)
      .where(
        and(
          eq(playbookRuns.userId, PUBLIC_DEMO_USER_ID),
          eq(playbookRuns.status, "done"),
          ne(playbookRuns.id, latest.id),
        ),
      )
      .orderBy(desc(playbookRuns.completedAt))
      .limit(3);

    const now = Date.now();
    const recallsShaped = recalls.map((r, i) => ({
      runId: r.runId,
      playbookName: r.playbookName,
      daysAgo: r.completedAt
        ? Math.max(1, Math.floor((now - new Date(r.completedAt).getTime()) / 86_400_000))
        : 0,
      similarity: PLACEHOLDER_SIMILARITIES[i] ?? 0.75,
      headline: `${r.playbookName} · past run`,
    }));

    return NextResponse.json(
      { latestRun: latest, recalls: recallsShaped },
      { headers: { "Cache-Control": "public, s-maxage=60" } },
    );
  } catch (err) {
    console.error("[api/public/memory-demo] failed", err);
    return NextResponse.json(
      { latestRun: null, recalls: [], error: "memory demo temporarily unavailable" },
      {
        status: 503,
        headers: { "Cache-Control": "public, s-maxage=30" },
      },
    );
  }
}
