/**
 * SOVEREIGN MATRIX — /api/replay/[receiptId] (Cook 75 wires Cook 48)
 *
 * Receipt-driven replay endpoint with pay-per-replay metering.
 *
 *   - INTERNAL callers (same tenant as the receipt owner) never charged.
 *   - EXTERNAL callers under the free-tier daily replay count: free.
 *   - EXTERNAL callers beyond the free tier: charged base or
 *     volume-discount per Cook 48.
 *
 * Returns the meter decision in headers so the client can render
 * "this replay cost N cents" UX.
 *
 * Auth: requireAuth — anonymous replays are not metered, they're
 * rejected. The platform's economic model is "you can replay any
 * receipt you have access to, but external consumers pay a micro-fee".
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { getRun } from "@/lib/agent-runs";
import { meterReplay } from "@/lib/pay-per-replay";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/replay");

export const dynamic = "force-dynamic";

const RECEIPT_RE = /^[0-9a-f-]{32,40}$/i;

/**
 * Stub for "daily replay count by consumer" — production reads from
 * a usage counter. Until that's wired we return 0, which means every
 * external caller stays in the free tier. Safe by default.
 */
async function dailyReplayCountFor(_consumerId: string): Promise<number> {
  return 0;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ receiptId: string }> },
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const userId = auth.userId || "";

  const { receiptId } = await params;
  if (!receiptId || !RECEIPT_RE.test(receiptId)) {
    return NextResponse.json({ error: "Invalid receipt id" }, { status: 400 });
  }

  const original = await getRun(receiptId);
  if (!original) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Relation: internal if same owner / tenant as the receipt; external otherwise.
  const relation: "internal" | "external" =
    original.userId === userId ? "internal" : "external";

  const meter = meterReplay({
    consumerId: userId,
    receiptId,
    relation,
    occurredAt: Date.now(),
    dailyReplayCountSoFar: await dailyReplayCountFor(userId),
  });

  // Log the decision so the usage table can persist + bill async.
  log.info("Replay meter decision", {
    receiptId,
    consumerId: userId,
    chargeable: meter.chargeable,
    ...(meter.chargeable
      ? { cents: meter.cents, tier: meter.tier, key: meter.idempotencyKey }
      : { reason: meter.reason }),
  });

  // Surface meter + receipt metadata. Re-running the agent itself is
  // delegated to the owner-only /api/agent-runs/[id]/replay route —
  // this endpoint is the AUDIT-readable "show me the receipt + drift
  // report" surface. The two work together: owner replays cheaply via
  // agent-runs; external consumers verify here.
  return new Response(
    JSON.stringify({
      ok: true,
      receiptId,
      meter,
      receipt: {
        id: original.id,
        agentSlug: original.agentName,
        committedAt: original.createdAt,
        userId: original.userId,
      },
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-Sovereign-Charge-Cents": String(meter.chargeable ? meter.cents : 0),
        "X-Sovereign-Charge-Reason": meter.chargeable
          ? meter.tier
          : meter.reason,
      },
    },
  );
}
