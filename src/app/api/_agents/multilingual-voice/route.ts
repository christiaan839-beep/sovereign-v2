import { createAgentRoute } from "@/lib/agent-factory";

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

export const POST = createAgentRoute({
  name: "multilingual-voice",
  handler: async ({ input, email, userId }) => {

    const { text, source_lang = "en", target_lang, voice = "en-US-1" } = input as Record<string, unknown>;

    if (!text || !target_lang) {
      return ({ error: "text and target_lang required." });
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

    return ({
      success: true,
      pipeline: "Multilingual Voice",
      source: { lang: source_lang, text },
      translated: { lang: target_lang, text: translatedText },
      voice_output: voiceResult,
      total_duration_ms: Date.now() - start,
    });
  
  },
});

