/**
 * creator-payout.ts — resolve an agent's creator and credit them 80% of
 * a captured hold. Called from the agent-factory success path (L1.5).
 *
 * Decoupled from credits.ts because it needs to read agent_metadata,
 * which credits.ts shouldn't depend on.
 *
 * No-ops silently in these cases:
 *   - agent_metadata row missing for the slug
 *   - creator_user_id is null (first-party agent)
 *   - creator_user_id equals the runner (author using their own agent)
 *   - agent's pricingCents is 0 (free agents don't generate payouts)
 *
 * This is fire-and-forget — the caller MUST NOT await it or let a
 * failure surface to the user. The agent run already succeeded; a
 * missed payout is recoverable (we log; ops can reconcile from the
 * hold_capture ledger entries by slug).
 */

import { db } from "@/db";
import { agentMetadata } from "@/db/schema";
import { eq } from "drizzle-orm";
import { creditCreatorPayout } from "@/lib/credits";
import { createLogger } from "@/lib/logger";

const log = createLogger("creator-payout");

export const DEFAULT_CREATOR_SHARE_PCT = 0.8;

export interface PayoutOpts {
  agentSlug: string;
  capturedCents: number;
  holdId: string;
  sourceUserId: string;
  sharePct?: number;
}

export async function payoutCreatorIfApplicable(opts: PayoutOpts): Promise<number> {
  if (opts.capturedCents <= 0) return 0;

  let row:
    | {
        creatorUserId: string | null;
        pricingCents: number;
      }
    | undefined;

  try {
    const rows = await db
      .select({
        creatorUserId: agentMetadata.creatorUserId,
        pricingCents: agentMetadata.pricingCents,
      })
      .from(agentMetadata)
      .where(eq(agentMetadata.slug, opts.agentSlug))
      .limit(1);
    row = rows[0];
  } catch (err: unknown) {
    // Table missing during bootstrap or transient DB outage — skip payout,
    // log for reconciliation. Cheapest recovery: ops replays from ledger.
    const pgCode = (err as { code?: string })?.code;
    if (pgCode !== "42P01") {
      log.warn("agent_metadata read failed during payout", {
        agentSlug: opts.agentSlug,
        error: (err as Error).message,
      });
    }
    return 0;
  }

  if (!row) return 0;
  if (!row.creatorUserId) return 0; // first-party agents: no creator
  if (row.pricingCents <= 0) return 0; // free agents: no revenue to split
  if (row.creatorUserId === opts.sourceUserId) return 0; // self-run: no self-payout

  const payout = await creditCreatorPayout({
    creatorUserId: row.creatorUserId,
    capturedCents: opts.capturedCents,
    sharePct: opts.sharePct ?? DEFAULT_CREATOR_SHARE_PCT,
    agentSlug: opts.agentSlug,
    sourceHoldId: opts.holdId,
    sourceUserId: opts.sourceUserId,
  });

  if (payout > 0) {
    log.info("creator payout credited", {
      agentSlug: opts.agentSlug,
      creatorUserId: row.creatorUserId,
      payoutCents: payout,
    });
  }
  return payout;
}
