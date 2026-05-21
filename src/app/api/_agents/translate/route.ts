import { NextResponse } from "next/server";
import { createAgentRoute } from "@/lib/agent-factory";
import { z } from "zod";
import { getNimKey } from "@/lib/nvidia";

/**
 * TRANSLATION — Uses NVIDIA Riva Translate 4B for 12 languages.
 */

const SUPPORTED_LANGUAGES = ["en", "es", "fr", "de", "it", "pt", "ru", "zh", "ja", "ko", "ar", "hi"];

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English", es: "Spanish", fr: "French", de: "German",
  it: "Italian", pt: "Portuguese", ru: "Russian", zh: "Chinese",
  ja: "Japanese", ko: "Korean", ar: "Arabic", hi: "Hindi",
};

// GET: public endpoint returning supported languages
export async function GET() {
  return NextResponse.json({
    status: "Riva Translate 4B — Active",
    supported_languages: SUPPORTED_LANGUAGES.map(l => ({ code: l, name: LANGUAGE_NAMES[l] })),
    model: "nvidia/riva-translate-4b-instruct-v1_1",
  });
}

// POST: translate text — wrapped in factory
import { outboundFetchAsResponse } from "@/lib/outbound-fetch";

const schema = z.object({
  text: z.string().min(1, "Text is required").max(10_000),
  source_lang: z.string().length(2).optional().default("en"),
  target_lang: z.string().length(2),
  prompt: z.string().optional(),
});

export const POST = createAgentRoute({
  name: "translate",
  schema,
  skipQualityCheck: true, // Translation quality is language-specific, not generic
  handler: async ({ input }) => {
    const { text, source_lang, target_lang } = input as z.infer<typeof schema>;

    if (!SUPPORTED_LANGUAGES.includes(target_lang)) {
      throw new Error(`Unsupported language: ${target_lang}. Supported: ${SUPPORTED_LANGUAGES.join(", ")}`);
    }

    const nimRes = await outboundFetchAsResponse("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await getNimKey()}`,
      },
      body: JSON.stringify({
        model: "nvidia/riva-translate-4b-instruct-v1_1",
        messages: [
          {
            role: "system",
            content: `Translate the following text from ${LANGUAGE_NAMES[source_lang]} to ${LANGUAGE_NAMES[target_lang]}. Maintain the original tone, formatting, and emphasis. Output ONLY the translated text.`,
          },
          { role: "user", content: text },
        ],
        max_tokens: 2048,
        temperature: 0.3,
      }),
    }, { ruleId: "agents.translate.route.1", allowedHosts: ["integrate.api.nvidia.com"] });

    if (!nimRes.ok) {
      throw new Error(`Translation API returned ${nimRes.status}`);
    }

    const nimData = await nimRes.json();
    const translatedText = nimData?.choices?.[0]?.message?.content || text;

    return {
      success: true,
      model: "riva-translate-4b",
      source: { lang: source_lang, name: LANGUAGE_NAMES[source_lang], text },
      target: { lang: target_lang, name: LANGUAGE_NAMES[target_lang], text: translatedText },
      character_count: text.length,
    };
  },
});
