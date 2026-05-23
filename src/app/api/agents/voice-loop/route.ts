/**
 * SOVEREIGN MATRIX — /api/agents/voice-loop route (Cook 74)
 *
 * Wires the Cook 60 voice-loop orchestrator to an actual HTTP
 * surface. Accepts multipart/form-data with an `audio` blob and
 * optional `agentSlug` field, dispatches ASR → agent → TTS, and
 * returns the synthesized reply as audio/mpeg.
 *
 * Providers are configured via env:
 *   - GROQ_API_KEY (Whisper-Large-V3 via Groq) — primary ASR
 *   - ELEVENLABS_API_KEY                         — primary TTS
 *
 * Without those, the route returns structured failure outcomes
 * (asr-failed / tts-failed) so the client can fall back.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { createLogger } from "@/lib/logger";
import { runVoiceLoop, type VoiceLoopDeps } from "@/lib/voice-loop";

import { outboundFetchAsResponse } from "@/lib/outbound-fetch";

const log = createLogger("voice-loop-route");
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function asrViaGroq(audio: {
  mime: string;
  payload: Uint8Array;
}): Promise<{ text: string; confidence?: number }> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY not configured");
  const form = new FormData();
  form.append(
    "file",
    new Blob([audio.payload as BlobPart], { type: audio.mime }),
    "audio",
  );
  form.append("model", "whisper-large-v3");
  const res = await outboundFetchAsResponse("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    }, { ruleId: "agents.voice-loop.route.1", allowedHosts: ["api.groq.com"] });
  if (!res.ok) {
    throw new Error(`Groq ASR returned ${res.status}`);
  }
  const data = (await res.json()) as { text?: string };
  return { text: data.text ?? "" };
}

async function ttsViaElevenLabs(
  text: string,
): Promise<{ mime: string; payload: Uint8Array }> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY not configured");
  // Generic voice id. Production maps per-tenant.
  const voiceId = process.env.ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";
  const res = await outboundFetchAsResponse(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": key,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2_5",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    }, { ruleId: "agents.voice-loop.route.2", allowedHosts: ["api.elevenlabs.io"] });
  if (!res.ok) {
    throw new Error(`ElevenLabs TTS returned ${res.status}`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  return { mime: "audio/mpeg", payload: buf };
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 },
    );
  }

  const file = form.get("audio");
  if (!(file instanceof Blob)) {
    return NextResponse.json(
      { error: "Missing 'audio' file" },
      { status: 400 },
    );
  }
  const agentSlug = String(form.get("agentSlug") ?? "smart-router");

  const audio = {
    mime: file.type || "audio/wav",
    payload: new Uint8Array(await file.arrayBuffer()),
  };

  // Lazy import keeps the ai router out of the static bundle until
  // a voice loop actually runs.
  const { ai } = await import("@/lib/ai");

  const deps: VoiceLoopDeps = {
    asr: asrViaGroq,
    runAgent: async (text) => ai(text, { model: "nim", maxTokens: 800 }),
    tts: ttsViaElevenLabs,
  };

  const outcome = await runVoiceLoop({ audio }, deps);

  if (!outcome.ok) {
    log.warn("Voice loop failed", {
      failure: outcome.failure,
      slug: agentSlug,
    });
    return NextResponse.json(
      {
        ok: false,
        failure: outcome.failure,
        error: outcome.error,
        transcript: outcome.transcript,
        timings: outcome.timings,
      },
      { status: outcome.failure === "audio-too-large" ? 413 : 502 },
    );
  }

  // Return the audio reply directly + metadata in headers (client can
  // also call /transcript with the receipt id to read the text).
  return new Response(outcome.replyAudio!.payload as BlobPart, {
    headers: {
      "Content-Type": outcome.replyAudio!.mime,
      "X-Sovereign-Transcript": Buffer.from(outcome.transcript ?? "").toString(
        "base64",
      ),
      "X-Sovereign-Reply": Buffer.from(outcome.reply ?? "").toString("base64"),
      "X-Sovereign-ASR-Ms": String(outcome.timings.asrMs),
      "X-Sovereign-Agent-Ms": String(outcome.timings.agentMs),
      "X-Sovereign-TTS-Ms": String(outcome.timings.ttsMs),
    },
  });
}
