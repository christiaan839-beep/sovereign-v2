/**
 * voice-billing.ts — settles a voice session hold to actual usage.
 *
 * Pricing (matches the session endpoint's hold):
 *   15¢ per minute (or partial minute — we bill on ceiling)
 *   $0.75 = 5-minute ceiling. Longer sessions get force-closed by
 *   the WS runner so we never need to bill above the hold cap.
 *
 * Settlement algorithm:
 *   chargeCents = min(ceil(secondsUsed / 60) * PRICE_PER_MINUTE, holdCents)
 *   if chargeCents == 0           → releaseHold  (free tier / zero-length call)
 *   if chargeCents == holdCents   → captureHold  (used full 5 minutes)
 *   else                          → captureHold + topUp(refund=diff, "refund")
 *
 * Why capture-then-refund instead of one "partial capture" primitive?
 * Reuses existing Plan 1 primitives — no schema change, no new
 * transaction type. The ledger shows the capture as the original
 * charge and the refund as a separate positive entry, which reads
 * cleanly in the user's billing history.
 */

import { captureHold, releaseHold, topUp } from "@/lib/credits";

export const VOICE_PRICE_CENTS_PER_MINUTE = 15;

/**
 * Compute how many cents a session used, capped by the hold ceiling.
 * Pure function — testable without touching the DB.
 */
export function computeVoiceCharge(
  secondsUsed: number,
  holdCents: number,
): number {
  if (secondsUsed <= 0) return 0;
  const minutes = Math.ceil(secondsUsed / 60);
  const raw = minutes * VOICE_PRICE_CENTS_PER_MINUTE;
  return Math.min(raw, holdCents);
}

export interface SettleVoiceOptions {
  holdId: string;
  userId: string;
  secondsUsed: number;
  holdCents: number;
}

/**
 * Close out a voice session hold. Returns the actual charge in cents
 * so the caller (or metrics) can log / emit analytics.
 *
 * Partial-capture failure mode: if captureHold succeeds but topUp
 * (refund) fails, the user is OVER-charged by up to 60¢. The failure
 * is logged and the user can request a refund — better than the
 * alternative (release everything on capture failure, then the user
 * got a free minute if capture partially succeeded).
 */
export async function settleVoiceSession(opts: SettleVoiceOptions): Promise<{
  charged: number;
  refunded: number;
}> {
  const { holdId, userId, secondsUsed, holdCents } = opts;
  const chargeCents = computeVoiceCharge(secondsUsed, holdCents);

  // Case 1: nothing used → full release.
  if (chargeCents === 0) {
    await releaseHold(holdId);
    return { charged: 0, refunded: holdCents };
  }

  // Case 2: used it all (or more — ceiling) → full capture.
  if (chargeCents >= holdCents) {
    await captureHold(holdId);
    return { charged: holdCents, refunded: 0 };
  }

  // Case 3: partial. Capture the full hold (money leaves the held
  // pile) then refund the unused portion to the user's balance.
  const refundCents = holdCents - chargeCents;
  await captureHold(holdId);
  await topUp(userId, refundCents, "refund", {
    stage: "voice_partial_refund",
    holdId,
    secondsUsed,
    chargeCents,
  });

  return { charged: chargeCents, refunded: refundCents };
}

/**
 * Builds the billOnClose callback consumed by handleVoiceWs.
 * Thin factory so the WS runner can plug it in one line.
 */
export function makeVoiceBillOnClose(holdCents: number) {
  return async function billOnClose(
    payload: { userId: string; holdId: string },
    secondsUsed: number,
  ): Promise<void> {
    await settleVoiceSession({
      holdId: payload.holdId,
      userId: payload.userId,
      secondsUsed,
      holdCents,
    });
  };
}
