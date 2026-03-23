/**
 * SOVEREIGN MATRIX — ElevenLabs Premium Voice Integration
 *
 * Optional premium TTS provider alongside free Nemotron Voicechat.
 * Users can bring their own ElevenLabs API key for studio-grade voices.
 *
 * Free tier: 10,000 characters/month
 * Paid: starts at $5/month for 30K characters
 *
 * Usage:
 *   import { elevenLabsTTS } from "@/lib/elevenlabs";
 *   const audio = await elevenLabsTTS("Hello world", { voice: "rachel" });
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("elevenlabs");

const VOICES: Record<string, string> = {
  rachel: "21m00Tcm4TlvDq8ikWAM",    // Calm, professional female
  drew: "29vD33N1CtxCmqQRPOHJ",       // Warm, confident male
  clyde: "2EiwWnXFnvU5JabPnv8n",      // Deep, authoritative male
  domi: "AZnzlk1XvdvUeBnXmlld",       // Strong, clear female
  bella: "EXAVITQu4vr4xnSDxMaL",      // Soft, friendly female
  adam: "pNInz6obpgDQGcFmaJgB",        // Deep, professional male
};

interface TTSOptions {
  voice?: string;
  model?: "eleven_multilingual_v2" | "eleven_turbo_v2_5" | "eleven_flash_v2_5";
  stability?: number;
  similarity?: number;
}

/**
 * Generate speech audio using ElevenLabs API.
 * Returns an audio buffer (MP3) or null if the API key is not configured.
 */
export async function elevenLabsTTS(
  text: string,
  options: TTSOptions = {}
): Promise<{ audio: ArrayBuffer; contentType: string } | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    log.info("ElevenLabs not configured — falling back to Nemotron Voicechat");
    return null;
  }

  const voiceId = VOICES[options.voice || "rachel"] || VOICES.rachel;
  const model = options.model || "eleven_multilingual_v2";

  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text: text.slice(0, 5000), // ElevenLabs limit
        model_id: model,
        voice_settings: {
          stability: options.stability ?? 0.5,
          similarity_boost: options.similarity ?? 0.75,
          style: 0.3,
          use_speaker_boost: true,
        },
      }),
    });

    if (!res.ok) {
      log.warn("ElevenLabs TTS failed", { status: res.status });
      return null;
    }

    const audio = await res.arrayBuffer();
    return { audio, contentType: "audio/mpeg" };
  } catch (error) {
    log.warn("ElevenLabs TTS error", { error: String(error) });
    return null;
  }
}

/**
 * Get available ElevenLabs voices.
 */
export function getAvailableVoices() {
  return Object.entries(VOICES).map(([name, id]) => ({ name, id }));
}

/**
 * Check if ElevenLabs is configured.
 */
export function isElevenLabsConfigured(): boolean {
  return !!process.env.ELEVENLABS_API_KEY;
}
