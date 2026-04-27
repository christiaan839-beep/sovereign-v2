import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/cron-auth";
import { drainDLQ } from "@/lib/dlq-worker";
import { createLogger } from "@/lib/logger";

const log = createLogger("dlq-drain");

/**
 * Every-10-minutes DLQ drain. Picks up to 25 due jobs, retries each, and
 * either marks succeeded / reschedules with backoff / abandons after
 * MAX_ATTEMPTS. Vercel cron entry lives in vercel.json.
 *
 * Auth: CRON_SECRET via requireCronAuth (fail-closed when unset).
 */
export async function GET(request: Request) {
  const denied = requireCronAuth(request);
  if (denied) return denied;

  try {
    const result = await drainDLQ();
    log.info("dlq drain complete", { ...result });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    log.error("dlq drain failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Drain failed" }, { status: 500 });
  }
}
