import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { voiceCalls } from "@/db/schema";
import { createLogger } from "@/lib/logger";
import twilio from "twilio";

const log = createLogger("voice-call");

// ─── Phone Validation ────────────────────────────────────────
// E.164 format: +{country code}{number}, 8-15 digits total
const E164_REGEX = /^\+[1-9]\d{7,14}$/;

function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !phoneNumber) {
    return null;
  }

  return { client: twilio(accountSid, authToken), phoneNumber };
}

/**
 * POST /api/voice/call
 *
 * Initiate an outbound AI voice call via Twilio.
 *
 * Body: {
 *   targetPhone: string   — E.164 phone number (e.g., "+14155551234")
 *   context: string       — What the AI should discuss on the call
 *   voiceId?: string      — ElevenLabs voice name (default: "rachel")
 * }
 *
 * Returns: { callSid, voiceCallId, status: "initiated" }
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await currentUser();
  const userEmail =
    user?.emailAddresses?.[0]?.emailAddress || `${userId}@clerk`;

  // ── Parse & validate body ──────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { targetPhone, context, voiceId } = body as {
    targetPhone?: string;
    context?: string;
    voiceId?: string;
  };

  if (!targetPhone || typeof targetPhone !== "string") {
    return NextResponse.json(
      { error: "targetPhone is required" },
      { status: 400 }
    );
  }

  if (!E164_REGEX.test(targetPhone)) {
    return NextResponse.json(
      {
        error:
          "Invalid phone number format. Use E.164 (e.g., +14155551234).",
      },
      { status: 400 }
    );
  }

  if (!context || typeof context !== "string" || context.length < 5) {
    return NextResponse.json(
      { error: "context is required (min 5 characters)" },
      { status: 400 }
    );
  }

  if (context.length > 5000) {
    return NextResponse.json(
      { error: "context too long (max 5000 characters)" },
      { status: 400 }
    );
  }

  // ── Verify Twilio is configured ────────────────────────────
  const tw = getTwilioClient();
  if (!tw) {
    log.warn("Twilio not configured — missing env vars");
    return NextResponse.json(
      { error: "Voice calling not configured. Contact support." },
      { status: 503 }
    );
  }

  try {
    // ── Create DB record ───────────────────────────────────
    const [voiceCall] = await db
      .insert(voiceCalls)
      .values({
        userEmail,
        targetPhone,
        context,
        status: "initiated",
      })
      .returning({ id: voiceCalls.id });

    log.info("Voice call record created", {
      voiceCallId: voiceCall.id,
      targetPhone: targetPhone.slice(0, -4) + "****",
    });

    // ── Build TwiML webhook URL ────────────────────────────
    // Use the app's public URL for the webhook callback
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : null;

    if (!baseUrl) {
      log.error("No public URL configured for TwiML webhook");
      return NextResponse.json(
        { error: "Server misconfigured — no public URL for webhook" },
        { status: 503 }
      );
    }

    const twimlUrl = new URL("/api/voice/twiml", baseUrl);
    twimlUrl.searchParams.set("vcId", voiceCall.id);
    if (voiceId) twimlUrl.searchParams.set("voiceId", voiceId);

    // ── Initiate Twilio call ───────────────────────────────
    const call = await tw.client.calls.create({
      to: targetPhone,
      from: tw.phoneNumber,
      url: twimlUrl.toString(),
      method: "POST",
      statusCallback: `${baseUrl}/api/voice/twiml?vcId=${voiceCall.id}&event=status`,
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      statusCallbackMethod: "POST",
      machineDetection: "DetectMessageEnd",
      timeout: 30,
    });

    log.info("Twilio call initiated", {
      callSid: call.sid,
      voiceCallId: voiceCall.id,
    });

    return NextResponse.json({
      callSid: call.sid,
      voiceCallId: voiceCall.id,
      status: "initiated",
    });
  } catch (error) {
    log.error("Voice call initiation failed", {
      error: String(error),
    });
    return NextResponse.json(
      { error: "Failed to initiate call" },
      { status: 500 }
    );
  }
}
