/**
 * Voice Clone — zero-shot TTS in a user-provided voice.
 *
 * Takes a short reference audio clip (URL) + the text to speak, uses
 * Resemble AI Chatterbox on NIM to clone the voice, and returns MP3
 * audio bytes.
 *
 * Closes the registered-but-unused gap: `resemble-ai/chatterbox`
 * has lived in NIM_MODELS since the registry shipped but no agent
 * called it. Shipping this route makes the platform's "zero-shot
 * voice cloning" claim a real capability anyone can invoke.
 *
 * Privacy posture:
 *   - Reference audio is fetched once, sent to Chatterbox, discarded
 *   - No audio is stored server-side (stateless route)
 *   - Rate limited 5/min per IP (voice cloning is expensive + can be
 *     abused for deepfake generation — the cap is intentionally tight)
 *
 * Ethical note: creators submitting voice-clone agents via the SAM
 * pipeline should declare consent attestation in their manifest.
 * The platform does not itself verify consent for reference audio;
 * that's the creator's responsibility. A future SAM extension could
 * carry a `consentProof` field that the deep-safety layer verifies.
 */

import { NextResponse } from "next/server";
import {
  checkIpRateLimit,
  extractClientIp,
} from "@/lib/api-guard";
import { getNimKey } from "@/lib/nvidia";
import { createLogger } from "@/lib/logger";

const log = createLogger("voice-clone");
const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";

interface RequestBody {
  text?: unknown;
  referenceAudioUrl?: unknown;
  voiceName?: unknown;
}

export async function POST(request: Request): Promise<Response> {
  const ip = extractClientIp(request.headers);
  const gate = checkIpRateLimit(ip, {
    bucket: "voice-clone",
    windowMs: 60_000,
    max: 5,
  });
  if (!gate.allowed) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(Math.ceil(gate.resetIn / 1000)),
        },
      },
    );
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "bad_json" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const referenceAudioUrl =
    typeof body.referenceAudioUrl === "string"
      ? body.referenceAudioUrl.trim()
      : "";
  const voiceName =
    typeof body.voiceName === "string" && body.voiceName.trim().length > 0
      ? body.voiceName.trim().slice(0, 50)
      : "custom-voice";

  if (!text) {
    return NextResponse.json(
      { ok: false, error: "text_required" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (text.length > 2000) {
    return NextResponse.json(
      { ok: false, error: "text_too_long", limit: 2000 },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!referenceAudioUrl || !/^https?:\/\//.test(referenceAudioUrl)) {
    return NextResponse.json(
      { ok: false, error: "reference_audio_url_required" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const apiKey = await getNimKey();
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "nim_key_not_configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const res = await fetch(`${NVIDIA_BASE_URL}/audio/speech`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "resemble-ai/chatterbox",
        input: text,
        voice: voiceName,
        reference_audio: referenceAudioUrl,
        response_format: "mp3",
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      log.warn("chatterbox returned non-OK", { status: res.status, body: errText.slice(0, 300) });
      return NextResponse.json(
        { ok: false, error: "upstream_failed", status: res.status },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    const audioBuffer = await res.arrayBuffer();
    return new Response(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
        // Surface the voice name so the caller can confirm what was
        // used — useful when the UI later supports voice presets.
        "X-Voice-Name": voiceName,
      },
    });
  } catch (err) {
    log.error("voice-clone threw", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { ok: false, error: "internal_error" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
