/**
 * GET /api/cron/drain-usage-outbox
 *
 * Vercel Cron — runs every minute. Drains pending rows from
 * `usage_outbox` back into the canonical `usage` table.
 *
 * Round 26. Pre-R26 a transient DB failure on the usage-counter
 * insert was silently swallowed; the user's run never landed in
 * their monthly count, which meant free-tier customers got more
 * runs than they paid for. Post-R26 the failure path writes to
 * `usage_outbox`; this cron replays those entries.
 *
 * Auth: verifyCron (timing-safe, fail-closed).
 *
 * Bounded: drains up to 200 rows per tick. A 50K backlog gets
 * cleared in ~4 hours of cron ticks rather than overwhelming a
 * single function execution.
 *
 * Idempotent: each outbox row gets one canonical insert (or stays
 * pending if the insert fails). Replays after a drainer crash
 * are safe.
 */

import { NextResponse } from "next/server";
import { drainUsageOutbox } from "@/lib/usage-outbox";
import { verifyCron } from "@/lib/cron-auth";
import { createLogger } from "@/lib/logger";

const log = createLogger("cron:drain-usage-outbox");

export const runtime = "nodejs";

export async function GET(req: Request) {
  const cronErr = verifyCron(req);
  if (cronErr) return cronErr;

  const result = await drainUsageOutbox({ limit: 200 });

  log.info("Usage outbox drain tick", {
    drained: result.drained,
    retried: result.retried,
    permanentlyFailed: result.permanentlyFailed,
  });

  return NextResponse.json({
    ok: true,
    ...result,
    ranAt: new Date().toISOString(),
  });
}
