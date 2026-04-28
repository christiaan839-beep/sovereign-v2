import { NextResponse } from "next/server";
import { sweepExpiredHolds } from "@/lib/credits";
import { verifyCron } from "@/lib/cron-auth";

/**
 * GET /api/cron/sweep-expired-holds
 *
 * Vercel cron endpoint — runs every minute. Releases credit holds
 * whose `expiresAt` has passed so crashed-mid-run holds don't keep a
 * user's balance artificially low forever.
 *
 * Auth: Bearer CRON_SECRET. Vercel injects this header; local dev
 * hitting the endpoint must include it too.
 *
 * Idempotent — running it twice in the same minute is safe (the second
 * run will find no active expired holds to sweep because the first
 * already released them).
 */
export async function GET(req: Request) {
  // Round 25 — was string-compare `===` (timing-attack vector) AND
  // missing the timing-safe pad. verifyCron handles both.
  const cronErr = verifyCron(req);
  if (cronErr) return cronErr;

  const swept = await sweepExpiredHolds();
  return NextResponse.json({
    ok: true,
    swept,
    ranAt: new Date().toISOString(),
  });
}
