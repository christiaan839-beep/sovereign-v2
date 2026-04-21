import { NextResponse } from "next/server";
import { sweepExpiredHolds } from "@/lib/credits";

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
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const swept = await sweepExpiredHolds();
  return NextResponse.json({
    ok: true,
    swept,
    ranAt: new Date().toISOString(),
  });
}
