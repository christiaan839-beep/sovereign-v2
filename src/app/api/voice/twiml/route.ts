import { NextResponse } from "next/server";
import twilio from "twilio";
import { db } from "@/db";
import { voiceCalls } from "@/db/schema";
import { eq } from "drizzle-orm";
import { nimChat, NIM_MODELS } from "@/lib/nvidia";
import { elevenLabsTTS } from "@/lib/elevenlabs";
import { createLogger } from "@/lib/logger";

const log = createLogger("voice-twiml");

/**
 * Verify Twilio webhook signature using the SDK helper.
 * Fails closed: returns false if TWILIO_AUTH_TOKEN is unset.
 *
 * SECURITY: Without this check, any attacker who guesses or learns a
 * `vcId` can POST arbitrary `SpeechResult` values to this endpoint,
 * corrupting transcripts, burning NIM+ElevenLabs tokens, and injecting
 * attacker-controlled content into the LLM system prompt (prompt injection
 * against the operator's voice agent).
 */
async function verifyTwilioWebhook(req: Request): Promise<boolean> {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    log.error("TWILIO_AUTH_TOKEN not configured — rejecting webhook");
    return false;
  }
  const signature = req.headers.get("x-twilio-signature");
  if (!signature) return false;

  // Twilio signs: URL + sorted-key form params concatenated.
  // twilio.validateRequest handles the canonical form for us.
  const url = req.url;
  let params: Record<string, string> = {};
  try {
    // Clone so we don't consume the original body for downstream handlers.
    const cloned = req.clone();
    const contentType = cloned.headers.get("content-type") || "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await cloned.formData();
      formData.forEach((v, k) => {
        params[k] = v.toString();
      });
    } else if (contentType.includes("application/json")) {
      params = (await cloned.json()) as Record<string, string>;
    }
  } catch (e) {
    log.error("Failed to read Twilio body for signature check", {
      error: (e as Error).message,
    });
    return false;
  }

  return twilio.validateRequest(authToken, signature, url, params);
}

// ─── AI Disclosure (TCPA Compliance) ─────────────────────────
const AI_DISCLOSURE =
  "Hi, this is an AI assistant calling on behalf of Sovereign Matrix. This call may be recorded for quality purposes.";

// ─── Helpers ─────────────────────────────────────────────────

function twimlResponse(twiml: string): NextResponse {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response>${twiml}</Response>`,
    {
      headers: { "Content-Type": "text/xml; charset=utf-8" },
    },
  );
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function generateAIResponse(
  context: string,
  userSpeech: string | null,
  transcript: string,
): Promise<string> {
  const systemPrompt = `You are Sovereign, a professional AI voice assistant making a phone call.
Your objective: ${context}

RULES:
- Be concise — phone conversations demand brevity (2-3 sentences max per turn).
- Sound natural and conversational, not scripted.
- Ask one question at a time.
- If the person is not interested, thank them politely and end the call.
- Never be aggressive, pushy, or deceptive.
- You already disclosed that you are an AI at the start of the call.

CONVERSATION SO FAR:
${transcript || "(This is the start of the call.)"}`;

  const messages = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: userSpeech
        ? `The person said: "${userSpeech}"`
        : "The call just connected. Greet the person (after the AI disclosure that was already played) and begin the conversation.",
    },
  ];

  try {
    const response = await nimChat(NIM_MODELS.fast, messages, {
      maxTokens: 150,
      temperature: 0.4,
    });
    return response.trim();
  } catch (error) {
    log.warn("AI generation failed, using fallback", {
      error: String(error),
    });
    return userSpeech
      ? "I appreciate your time. Could you tell me a bit more about that?"
      : "Thank you for taking my call. I'm reaching out to discuss a brief opportunity. Do you have a moment?";
  }
}

async function buildSpeechTwiml(
  text: string,
  voiceId: string | null,
  gatherAction: string,
): Promise<string> {
  // Try ElevenLabs first for premium voice quality
  const ttsResult = await elevenLabsTTS(text, {
    voice: voiceId || "rachel",
    model: "eleven_turbo_v2_5", // Low latency for phone calls
    stability: 0.6,
    similarity: 0.8,
  });

  if (ttsResult) {
    // Encode audio as base64 data URI for inline playback
    // Twilio supports <Play> with a URL — we need to serve the audio
    // For production: upload to a CDN or use a signed URL
    // For now: fall through to Twilio <Say> with the generated text
    // since Twilio <Play> requires a publicly accessible URL
    log.info("ElevenLabs TTS generated, using Twilio Say as delivery method");
  }

  // Use Twilio's built-in TTS with Polly voice as reliable fallback
  // This always works without external dependencies
  const escapedText = escapeXml(text);

  return `<Gather input="speech" timeout="5" speechTimeout="auto" action="${escapeXml(gatherAction)}" method="POST"><Say voice="Polly.Joanna">${escapedText}</Say></Gather><Say voice="Polly.Joanna">I didn't catch that. Thank you for your time. Goodbye.</Say><Hangup/>`;
}

// ─── Status Callback Handler ─────────────────────────────────

async function handleStatusCallback(
  req: Request,
  vcId: string,
): Promise<NextResponse> {
  let formData: URLSearchParams;
  try {
    const text = await req.text();
    formData = new URLSearchParams(text);
  } catch {
    return new NextResponse("OK", { status: 200 });
  }

  const callStatus = formData.get("CallStatus");
  const callDuration = formData.get("CallDuration");

  log.info("Call status update", { vcId, callStatus, callDuration });

  try {
    const updates: Record<string, unknown> = {};

    if (callStatus) {
      // Map Twilio statuses to our schema
      const statusMap: Record<string, string> = {
        initiated: "initiated",
        ringing: "ringing",
        "in-progress": "connected",
        completed: "completed",
        busy: "failed",
        "no-answer": "failed",
        canceled: "failed",
        failed: "failed",
      };
      updates.status = statusMap[callStatus] || callStatus;
    }

    if (callDuration) {
      updates.durationSeconds = parseInt(callDuration, 10);
    }

    if (Object.keys(updates).length > 0) {
      await db.update(voiceCalls).set(updates).where(eq(voiceCalls.id, vcId));
    }
  } catch (error) {
    log.warn("Failed to update call status", {
      vcId,
      error: String(error),
    });
  }

  return new NextResponse("OK", { status: 200 });
}

// ─── Main TwiML Handler ─────────────────────────────────────

async function handleTwiml(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const vcId = url.searchParams.get("vcId");
  const voiceId = url.searchParams.get("voiceId") || null;
  const isStatusEvent = url.searchParams.get("event") === "status";

  if (!vcId) {
    log.warn("TwiML called without vcId");
    return twimlResponse(
      '<Say voice="Polly.Joanna">An error occurred. Goodbye.</Say><Hangup/>',
    );
  }

  // ── Status callback (separate flow) ────────────────────────
  if (isStatusEvent) {
    return handleStatusCallback(req, vcId);
  }

  // ── Load the voice call record ─────────────────────────────
  let voiceCall:
    | {
        id: string;
        context: string | null;
        transcript: string | null;
        status: string;
      }
    | undefined;

  try {
    const rows = await db
      .select({
        id: voiceCalls.id,
        context: voiceCalls.context,
        transcript: voiceCalls.transcript,
        status: voiceCalls.status,
      })
      .from(voiceCalls)
      .where(eq(voiceCalls.id, vcId))
      .limit(1);
    voiceCall = rows[0];
  } catch (error) {
    log.error("DB lookup failed for voice call", {
      vcId,
      error: String(error),
    });
    return twimlResponse(
      '<Say voice="Polly.Joanna">A system error occurred. Please try again later. Goodbye.</Say><Hangup/>',
    );
  }

  if (!voiceCall) {
    log.warn("Voice call record not found", { vcId });
    return twimlResponse(
      '<Say voice="Polly.Joanna">An error occurred. Goodbye.</Say><Hangup/>',
    );
  }

  // ── Extract user speech from Twilio POST body ──────────────
  let userSpeech: string | null = null;
  try {
    const text = await req.text();
    const formData = new URLSearchParams(text);
    userSpeech = formData.get("SpeechResult");
  } catch {
    // First call — no speech input yet
  }

  const currentTranscript = voiceCall.transcript || "";

  // ── First turn: play AI disclosure + generate greeting ─────
  if (!userSpeech && voiceCall.status === "initiated") {
    // Update status to connected
    try {
      await db
        .update(voiceCalls)
        .set({ status: "connected" })
        .where(eq(voiceCalls.id, vcId));
    } catch {
      // Non-critical — continue
    }

    const greeting = await generateAIResponse(
      voiceCall.context || "Have a professional conversation.",
      null,
      "",
    );

    const fullGreeting = `${AI_DISCLOSURE} ${greeting}`;

    // Save to transcript
    const newTranscript = `AI: ${fullGreeting}`;
    try {
      await db
        .update(voiceCalls)
        .set({ transcript: newTranscript })
        .where(eq(voiceCalls.id, vcId));
    } catch {
      // Non-critical
    }

    const actionUrl = `/api/voice/twiml?vcId=${vcId}${voiceId ? `&voiceId=${voiceId}` : ""}`;
    const speechTwiml = await buildSpeechTwiml(
      fullGreeting,
      voiceId,
      actionUrl,
    );
    return twimlResponse(speechTwiml);
  }

  // ── Conversation turn: respond to user speech ──────────────
  if (userSpeech) {
    const updatedTranscript = currentTranscript
      ? `${currentTranscript}\nHuman: ${userSpeech}`
      : `Human: ${userSpeech}`;

    const aiResponse = await generateAIResponse(
      voiceCall.context || "Have a professional conversation.",
      userSpeech,
      updatedTranscript,
    );

    // Check for conversation end signals
    const endSignals = [
      "goodbye",
      "thank you for your time",
      "have a great day",
      "end the call",
    ];
    const isEnding = endSignals.some((signal) =>
      aiResponse.toLowerCase().includes(signal),
    );

    const finalTranscript = `${updatedTranscript}\nAI: ${aiResponse}`;

    // Update transcript in DB
    try {
      await db
        .update(voiceCalls)
        .set({
          transcript: finalTranscript,
          ...(isEnding ? { status: "completed" } : {}),
        })
        .where(eq(voiceCalls.id, vcId));
    } catch {
      // Non-critical
    }

    if (isEnding) {
      return twimlResponse(
        `<Say voice="Polly.Joanna">${escapeXml(aiResponse)}</Say><Hangup/>`,
      );
    }

    const actionUrl = `/api/voice/twiml?vcId=${vcId}${voiceId ? `&voiceId=${voiceId}` : ""}`;
    const speechTwiml = await buildSpeechTwiml(aiResponse, voiceId, actionUrl);
    return twimlResponse(speechTwiml);
  }

  // ── Fallback: no speech detected, re-prompt ────────────────
  const actionUrl = `/api/voice/twiml?vcId=${vcId}${voiceId ? `&voiceId=${voiceId}` : ""}`;
  return twimlResponse(
    `<Gather input="speech" timeout="8" speechTimeout="auto" action="${escapeXml(actionUrl)}" method="POST"><Say voice="Polly.Joanna">Are you still there? I'm happy to continue if you have a moment.</Say></Gather><Say voice="Polly.Joanna">It seems like this isn't a good time. Thank you. Goodbye.</Say><Hangup/>`,
  );
}

// ─── Route Exports ───────────────────────────────────────────
// No Clerk auth — Twilio calls this endpoint directly.
// Instead, every POST is verified against the Twilio signature.

function rejectedResponse(): NextResponse {
  return twimlResponse(
    '<Say voice="Polly.Joanna">Unauthorized.</Say><Hangup/>',
  );
}

export async function POST(req: Request) {
  if (!(await verifyTwilioWebhook(req))) {
    log.error("Rejected unsigned/invalid Twilio POST");
    return rejectedResponse();
  }
  return handleTwiml(req);
}

// GET requests aren't signed by Twilio the same way; Twilio primarily
// uses POST for webhooks. Keep GET for manual testing / status polls,
// but it should only work when an auth token is present and the caller
// is inside Vercel (rare) — for safety we require the signature too.
export async function GET(req: Request) {
  if (!(await verifyTwilioWebhook(req))) {
    log.error("Rejected unsigned/invalid Twilio GET");
    return rejectedResponse();
  }
  return handleTwiml(req);
}
