/**
 * POST /api/voice/session — start a voice session.
 *
 * Flow:
 *   1. Clerk auth → 401 otherwise.
 *   2. Parse { personaId }. Unknown IDs fall back to "default" via
 *      getPersona(); we don't 400 on unknown personas so the client
 *      can safely send legacy/future IDs.
 *   3. Place a 5-minute credit hold for 75¢ (= 15¢/min × 5 min).
 *      Insufficient balance → 402 with topUpUrl.
 *   4. Sign a 60-second voice-session token carrying userId, personaId,
 *      and holdId. The WebSocket route verifies this on connection.
 *   5. Return { token, wsUrl }.
 *
 * The session is billed on actual duration at WebSocket close (Plan 3.8):
 *   captureHold(holdId, ceil(secondsUsed / 60) * 15)
 *   releaseHold(holdId)  // the unused portion
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { placeHold, InsufficientCreditsError } from "@/lib/credits";
import { getPersona } from "@/lib/voice-personas";
import { signVoiceToken } from "@/lib/voice-token";
import { getUserPlan } from "@/lib/plan-enforcement";
import {
  isUnlimitedVoicePlan,
  getVoiceMinutesThisMonth,
  FREE_TIER_MINUTES_PER_MONTH,
} from "@/lib/voice-billing";

const BodySchema = z.object({
  personaId: z.string().min(1).max(40),
});

const VOICE_PRICE_CENTS_PER_MINUTE = 15;
const VOICE_SESSION_MAX_MINUTES = 5;
const HOLD_AMOUNT_CENTS = VOICE_PRICE_CENTS_PER_MINUTE * VOICE_SESSION_MAX_MINUTES; // 75
const HOLD_TTL_MS = VOICE_SESSION_MAX_MINUTES * 60 * 1000;
const TOKEN_TTL_SECONDS = 60;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secret = process.env.VOICE_SESSION_SECRET;
  if (!secret || secret.length < 16) {
    return NextResponse.json(
      { error: "VOICE_SESSION_SECRET not configured" },
      { status: 500 },
    );
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // Resolve persona (falls back to default on unknown — forward-compatible
  // for future persona IDs the client may know about).
  const persona = getPersona(parsed.data.personaId);

  // Plan-aware hold policy:
  //  - unlimited (founder, enterprise): no hold, sentinel hold id
  //  - free tier with remaining allowance: no hold (covers up to 5 min)
  //  - free tier over allowance OR paid tier: 75¢ hold
  const plan = await getUserPlan(userId);
  let holdId: string;
  let freeMinutesRemaining = 0;

  if (isUnlimitedVoicePlan(plan)) {
    // Skip credits entirely.
    holdId = "none";
    freeMinutesRemaining = VOICE_SESSION_MAX_MINUTES;
  } else if (plan === "free") {
    // Figure out remaining free minutes. If the user still has all 5 min,
    // place NO hold (a free-tier user shouldn't need credits at all).
    // If they've used any, place a partial hold for the paid overflow.
    const minutesUsed = await getVoiceMinutesThisMonth(userId);
    freeMinutesRemaining = Math.max(0, FREE_TIER_MINUTES_PER_MONTH - minutesUsed);

    if (freeMinutesRemaining >= VOICE_SESSION_MAX_MINUTES) {
      // Entire session would fit in free allowance — no hold needed.
      holdId = "none";
    } else {
      // Hold covers only the paid minutes that might overflow.
      const paidMinutes = VOICE_SESSION_MAX_MINUTES - freeMinutesRemaining;
      const holdAmount = paidMinutes * VOICE_PRICE_CENTS_PER_MINUTE;
      try {
        holdId = await placeHold(
          userId,
          holdAmount,
          `voice_${persona.id}_${Date.now()}`,
          HOLD_TTL_MS,
        );
      } catch (err) {
        if (err instanceof InsufficientCreditsError) {
          return NextResponse.json(
            {
              error: "Insufficient credits",
              required: err.required,
              available: err.available,
              freeMinutesRemaining,
              topUpUrl: "/dashboard/billing?topup=true",
            },
            { status: 402 },
          );
        }
        throw err;
      }
    }
  } else {
    // Paid tier (starter/growth/node/pay_per_run) — full 75¢ hold.
    try {
      holdId = await placeHold(
        userId,
        HOLD_AMOUNT_CENTS,
        `voice_${persona.id}_${Date.now()}`,
        HOLD_TTL_MS,
      );
    } catch (err) {
      if (err instanceof InsufficientCreditsError) {
        return NextResponse.json(
          {
            error: "Insufficient credits",
            required: err.required,
            available: err.available,
            topUpUrl: "/dashboard/billing?topup=true",
          },
          { status: 402 },
        );
      }
      throw err;
    }
  }

  // Sign a short-lived session token. 60s is plenty — the client hits
  // the WS route immediately after this response.
  const token = signVoiceToken(
    {
      userId,
      personaId: persona.id,
      holdId,
      exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    },
    secret,
  );

  return NextResponse.json(
    {
      token,
      wsUrl: "/api/voice/ws",
      personaId: persona.id,
      voice: persona.voice,
      plan,
      // Clients can show "N min free" before the session starts.
      freeMinutesRemaining,
      holdAmountCents: holdId === "none" ? 0 : HOLD_AMOUNT_CENTS,
      sessionMaxMinutes: VOICE_SESSION_MAX_MINUTES,
    },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
