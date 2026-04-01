import { auth } from "@clerk/nextjs/server";
import { getNimKey } from "@/lib/nvidia";
import { elevenLabsTTS, isElevenLabsConfigured } from "@/lib/elevenlabs";
import { NextResponse } from "next/server";

/**
 * VOICE SYNTHESIS API — Multi-provider text-to-speech.
 *
 * Providers:
 *   - "magpie" (default, free) — NVIDIA Magpie TTS via NIM
 *   - "elevenlabs" (premium)   — ElevenLabs studio-grade voices
 *
 * If ElevenLabs is requested but the API key isn't configured,
 * falls back to Magpie automatically with a note in the response headers.
 */

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const {
      text,
      voice = "flow",
      speed = 1.0,
      provider = "magpie",
      // ElevenLabs-specific options
      elevenLabsVoice,
      elevenLabsModel,
      stability,
      similarity,
    } = await request.json();

    if (!text) {
      return NextResponse.json({ error: "Text is required." }, { status: 400 });
    }

    // ─── ElevenLabs Premium Path ───
    if (provider === "elevenlabs") {
      if (!isElevenLabsConfigured()) {
        // Fall back to Magpie with a note
        const fallbackAudio = await magpieTTS(text, voice, speed);
        if (!fallbackAudio.ok) {
          const errText = await fallbackAudio.text();
          return NextResponse.json({
            error: `TTS generation failed: ${fallbackAudio.status}`,
            details: errText,
          }, { status: fallbackAudio.status });
        }

        const audioBuffer = await fallbackAudio.arrayBuffer();
        return new NextResponse(audioBuffer, {
          status: 200,
          headers: {
            "Content-Type": "audio/mpeg",
            "Content-Length": String(audioBuffer.byteLength),
            "X-Model": "nvidia/magpie-tts-flow",
            "X-Provider": "magpie",
            "X-Fallback": "elevenlabs-not-configured",
          },
        });
      }

      const result = await elevenLabsTTS(text, {
        voice: elevenLabsVoice,
        model: elevenLabsModel,
        stability,
        similarity,
      });

      if (!result) {
        // ElevenLabs call failed — fall back to Magpie
        const fallbackAudio = await magpieTTS(text, voice, speed);
        if (!fallbackAudio.ok) {
          const errText = await fallbackAudio.text();
          return NextResponse.json({
            error: `TTS generation failed: ${fallbackAudio.status}`,
            details: errText,
          }, { status: fallbackAudio.status });
        }

        const audioBuffer = await fallbackAudio.arrayBuffer();
        return new NextResponse(audioBuffer, {
          status: 200,
          headers: {
            "Content-Type": "audio/mpeg",
            "Content-Length": String(audioBuffer.byteLength),
            "X-Model": "nvidia/magpie-tts-flow",
            "X-Provider": "magpie",
            "X-Fallback": "elevenlabs-api-error",
          },
        });
      }

      return new NextResponse(result.audio, {
        status: 200,
        headers: {
          "Content-Type": result.contentType,
          "Content-Length": String(result.audio.byteLength),
          "X-Provider": "elevenlabs",
        },
      });
    }

    // ─── Magpie (Default / Free) Path ───
    const nimRes = await magpieTTS(text, voice, speed);

    if (!nimRes.ok) {
      const errText = await nimRes.text();
      return NextResponse.json({
        error: `TTS generation failed: ${nimRes.status}`,
        details: errText,
      }, { status: nimRes.status });
    }

    const audioBuffer = await nimRes.arrayBuffer();
    const modelId = voice === "zeroshot"
      ? "nvidia/magpie-tts-zeroshot"
      : "nvidia/magpie-tts-flow";

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audioBuffer.byteLength),
        "X-Model": modelId,
        "X-Provider": "magpie",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Voice synthesis error", details: String(error) }, { status: 500 });
  }
}

/** NVIDIA Magpie TTS via NIM — extracted for reuse in fallback paths */
async function magpieTTS(text: string, voice: string, speed: number): Promise<Response> {
  const modelId = voice === "zeroshot"
    ? "nvidia/magpie-tts-zeroshot"
    : "nvidia/magpie-tts-flow";

  return fetch("https://integrate.api.nvidia.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${await getNimKey()}`,
    },
    body: JSON.stringify({
      model: modelId,
      input: text,
      voice: "alloy",
      speed,
    }),
  });
}
