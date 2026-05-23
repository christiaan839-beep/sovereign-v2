import { createAgentRoute } from "@/lib/agent-factory";

import { getBaseUrl } from "@/lib/base-url";

/**
 * MULTILINGUAL VOICE PIPELINE — Chain translation + voice synthesis
 * for global deployment.
 *
 * Input: text in any language → translate → synthesize speech
 *
 * Supports 20+ languages via NIM translation + voice models.
 */

import { outboundFetchAsResponse } from "@/lib/outbound-fetch";

export const POST = createAgentRoute({
  name: "multilingual-voice",
  // Wave 130 M3 batch 20: memory hooks. Per-language-pair translation
  // continuity — prior translation of the same source phrase gives the
  // next call a glossary anchor for terminology consistency.
  memory: {
    search: {
      query: (input) =>
        `mvoice ${input.source_lang ?? "en"}→${input.target_lang ?? "?"} ${String(input.text ?? "").slice(0, 80)}`,
      limit: 2,
    },
    store: {
      extract: (result) => {
        const r = result as {
          source?: { lang?: string; text?: string };
          translated?: { lang?: string; text?: string };
        };
        if (!r.translated?.text) return null;
        const src = (r.source?.text ?? "").slice(0, 100).replace(/\s+/g, " ");
        const tgt = r.translated.text.slice(0, 120).replace(/\s+/g, " ");
        return `mvoice[${r.source?.lang ?? "?"}→${r.translated.lang ?? "?"}]: "${src}" → "${tgt}"`;
      },
      metadata: (input) => ({
        kind: "multilingual-voice",
        sourceLang:
          typeof input.source_lang === "string" ? input.source_lang : "en",
        targetLang:
          typeof input.target_lang === "string" ? input.target_lang : "",
      }),
    },
  },
  handler: async ({ input, email, userId }) => {
    const {
      text,
      source_lang = "en",
      target_lang,
      voice = "en-US-1",
    } = input as Record<string, unknown>;

    if (!text || !target_lang) {
      return { error: "text and target_lang required." };
    }

    const baseUrl = getBaseUrl();
    const start = Date.now();

    // Step 1: Translate
    let translatedText = text;
    if (source_lang !== target_lang) {
      try {
        const translateRes = await outboundFetchAsResponse(
          `${baseUrl}/api/agents/translate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, target_lang }),
          },
          {
            ruleId: "agents.multilingual-voice.route.1",
            allowedHosts: [new URL(baseUrl).hostname],
          },
        );
        const translateData = await translateRes.json();
        translatedText =
          translateData?.translated || translateData?.result || text;
      } catch {
        translatedText = text;
      }
    }

    // Step 2: Voice synthesis
    let voiceResult = null;
    try {
      const voiceRes = await outboundFetchAsResponse(
        `${baseUrl}/api/agents/voice-synth`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: translatedText, voice }),
        },
        {
          ruleId: "agents.multilingual-voice.route.2",
          allowedHosts: [new URL(baseUrl).hostname],
        },
      );
      voiceResult = await voiceRes.json();
    } catch {
      voiceResult = { status: "Voice synthesis unavailable" };
    }

    return {
      success: true,
      pipeline: "Multilingual Voice",
      source: { lang: source_lang, text },
      translated: { lang: target_lang, text: translatedText },
      voice_output: voiceResult,
      total_duration_ms: Date.now() - start,
    };
  },
});
