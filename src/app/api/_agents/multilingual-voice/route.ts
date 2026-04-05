import { auth } from "@clerk/nextjs/server";

import { NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/base-url";

/**
 * MULTILINGUAL VOICE PIPELINE — Chain translation + voice synthesis
 * for global deployment.
 * 
 * Input: text in any language → translate → synthesize speech
 * 
 * Supports 20+ languages via NIM translation + voice models.
 */

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { text, source_lang = "en", target_lang, voice = "en-US-1" } = await request.json();

    if (!text || !target_lang) {
      return NextResponse.json({ error: "text and target_lang required." }, { status: 400 });
    }

    const baseUrl = getBaseUrl();
    const start = Date.now();

    // Step 1: Translate
    let translatedText = text;
    if (source_lang !== target_lang) {
      try {
        const translateRes = await fetch(`${baseUrl}/api/agents/translate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, target_lang }),
        });
        const translateData = await translateRes.json();
        translatedText = translateData?.translated || translateData?.result || text;
      } catch {
        translatedText = text;
      }
    }

    // Step 2: Voice synthesis
    let voiceResult = null;
    try {
      const voiceRes = await fetch(`${baseUrl}/api/agents/voice-synth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: translatedText, voice }),
      });
      voiceResult = await voiceRes.json();
    } catch {
      voiceResult = { status: "Voice synthesis unavailable" };
    }

    return NextResponse.json({
      success: true,
      pipeline: "Multilingual Voice",
      source: { lang: source_lang, text },
      translated: { lang: target_lang, text: translatedText },
      voice_output: voiceResult,
      total_duration_ms: Date.now() - start,
    });
  } catch (error) {
    return NextResponse.json({ error: "Multilingual pipeline error", details: String(error) }, { status: 500 });
  }
}
