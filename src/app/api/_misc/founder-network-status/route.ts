import { NextResponse } from "next/server";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { count, isNotNull } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("founder-network-status");

/**
 * GET /api/_misc/founder-network-status
 *
 * Public aggregate: how many Founder Network seats have been claimed
 * out of the 100-seat cohort. Powers the spatial "seats" visualization
 * on the landing page.
 *
 * No PII, no userIds, just a counter. Cached 5 min at edge.
 */

export const revalidate = 300;

export async function GET() {
  try {
    const claimed = await db
      .select({ value: count() })
      .from(subscriptions)
      .where(isNotNull(subscriptions.founderNetworkJoinedAt))
      .catch(() => [{ value: 0 }]);

    return NextResponse.json(
      {
        claimed: Number(claimed[0]?.value ?? 0),
        total: 100,
        lastUpdated: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch (err) {
    log.warn("founder-network-status failed", { error: String(err) });
    return NextResponse.json({ claimed: 0, total: 100, lastUpdated: new Date().toISOString() });
  }
}
