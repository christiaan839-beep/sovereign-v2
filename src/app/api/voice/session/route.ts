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

  // Place the hold. This is a real DB write — atomic debit + credit_holds
  // row. Insufficient funds throws InsufficientCreditsError.
  let holdId: string;
  try {
    holdId = await placeHold(
      userId,
      HOLD_AMOUNT_CENTS,
      `voice_${persona.id}_${Date.now()}`, // agentRunId tag
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
      holdAmountCents: HOLD_AMOUNT_CENTS,
      sessionMaxMinutes: VOICE_SESSION_MAX_MINUTES,
    },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
