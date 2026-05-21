import { NextResponse } from "next/server";

/**
 * PUBLIC VOICE ENDPOINT — Text-to-speech for landing page assistant.
 * No auth required. Rate limited to 10 requests per minute per IP.
 * Uses NVIDIA Magpie TTS (free tier) for voice synthesis.
 */

import { outboundFetchAsResponse } from "@/lib/outbound-fetch";

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export async function POST(req: Request) {
  // Rate limit: 10 req/min per IP
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (entry && entry.resetAt > now && entry.count >= 10) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }
  if (!entry || entry.resetAt <= now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60000 });
  } else {
    entry.count++;
  }

  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string" || text.length > 500) {
      return NextResponse.json({ error: "Invalid text" }, { status: 400 });
    }

    const nimKey = process.env.NVIDIA_NIM_API_KEY;
    if (!nimKey) {
      return NextResponse.json({ error: "TTS not configured" }, { status: 503 });
    }

    // Use NVIDIA Magpie TTS — free, low-latency
    const ttsRes = await outboundFetchAsResponse("https://integrate.api.nvidia.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${nimKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "nvidia/magpie-tts-flow",
        input: text.slice(0, 300), // Cap at 300 chars for speed
        voice: "English-US.Female-1",
        response_format: "mp3",
        speed: 1.05,
      }),
    }, { ruleId: "voice.speak.route.1", allowedHosts: ["integrate.api.nvidia.com"] });

    if (!ttsRes.ok) {
      return NextResponse.json({ error: "TTS generation failed" }, { status: 502 });
    }

    const audioBuffer = await ttsRes.arrayBuffer();
    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Voice synthesis failed" }, { status: 500 });
  }
}
