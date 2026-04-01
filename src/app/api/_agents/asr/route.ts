import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * ASR (Automatic Speech Recognition) — Uses NVIDIA Nemotron ASR Streaming
 * for real-time speech-to-text transcription during Twilio voice calls.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { audioBase64, language = "en" } = await req.json();
    if (!audioBase64) return NextResponse.json({ error: "Missing audioBase64 payload." }, { status: 400 });

    const nimKey = process.env.NVIDIA_NIM_API_KEY;
    if (!nimKey) return NextResponse.json({ error: "NVIDIA_NIM_API_KEY not configured." }, { status: 500 });

    const res = await fetch("https://integrate.api.nvidia.com/v1/asr/transcriptions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${nimKey}`,
      },
      body: JSON.stringify({
        model: "nvidia/nemotron-asr-streaming",
        audio: audioBase64,
        language,
        response_format: "json",
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `ASR failed: ${res.status}`, details: errText }, { status: 500 });
    }

    const data = await res.json();
    return NextResponse.json({
      transcript: data.text || data.transcript || "",
      confidence: data.confidence || null,
      model: "nemotron-asr-streaming",
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
