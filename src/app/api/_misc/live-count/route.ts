import { NextResponse } from "next/server";
import { db } from "@/db";
import { playbookRuns } from "@/db/schema";
import { gte, count, and, eq } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("live-count");

/**
 * GET /api/_misc/live-count
 *
 * Public, aggregate-only endpoint for the hero "N playbooks running
 * right now" pill. Counts active playbook runs in the last 5 minutes.
 *
 * Response is intentionally minimal to keep it edge-cacheable at 30s:
 *   { running: number, totalToday: number, lastUpdated: ISO8601 }
 *
 * No PII, no userIds, no per-tenant leak. Just a global counter.
 *
 * Studying: vercel.com shows a live deploy counter; stripe.com has
 * a live transaction counter. The key design is that the NUMBER
 * updates — not with a flashy animation, but with quiet truth.
 */

export const revalidate = 30;

export async function GET() {
  const nowActive = new Date(Date.now() - 5 * 60 * 1000); // active in last 5 min
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  try {
    const [running, totalToday] = await Promise.all([
      db
        .select({ value: count() })
        .from(playbookRuns)
        .where(
          and(
            gte(playbookRuns.createdAt, nowActive),
            eq(playbookRuns.status, "running"),
          ),
        ),
      db
        .select({ value: count() })
        .from(playbookRuns)
        .where(gte(playbookRuns.createdAt, todayStart)),
    ]);

    return NextResponse.json(
      {
        running: Number(running[0]?.value ?? 0),
        totalToday: Number(totalToday[0]?.value ?? 0),
        lastUpdated: new Date().toISOString(),
      },
      {
        headers: {
          // Edge-cache for 30s; keeps the live feel without hammering DB.
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      },
    );
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "42P01") {
      // Pre-migration schema — return a plausible zero state, not an error.
      return NextResponse.json({ running: 0, totalToday: 0, lastUpdated: new Date().toISOString() });
    }
    log.error("live-count query failed", { error: String(err) });
    // Never fail the hero pill — return zeroes so the page stays clean.
    return NextResponse.json({ running: 0, totalToday: 0, lastUpdated: new Date().toISOString() });
  }
}
