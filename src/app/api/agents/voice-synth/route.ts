import { getNimKey } from "@/lib/nvidia";
import { NextResponse } from "next/server";

/**
 * VOICE SYNTHESIS API — Uses NVIDIA Magpie TTS for expressive text-to-speech.
 * Powers the Sentinel Dialer with realistic AI voice, and generates audio
 * content for the Podcast module.
 */

export async function POST(request: Request) {
  try {
    const { text, voice = "flow", speed = 1.0 } = await request.json();

    if (!text) {
      return NextResponse.json({ error: "Text is required." }, { status: 400 });
    }

    const modelId = voice === "zeroshot"
      ? "nvidia/magpie-tts-zeroshot"
      : "nvidia/magpie-tts-flow";

    const nimRes = await fetch("https://integrate.api.nvidia.com/v1/audio/speech", {
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

    if (!nimRes.ok) {
      const errText = await nimRes.text();
      return NextResponse.json({
        error: `TTS generation failed: ${nimRes.status}`,
        details: errText,
      }, { status: nimRes.status });
    }

    // Stream audio response back
    const audioBuffer = await nimRes.arrayBuffer();

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audioBuffer.byteLength),
        "X-Model": modelId,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Voice synthesis error", details: String(error) }, { status: 500 });
  }
}
