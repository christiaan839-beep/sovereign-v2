import { getNimKey } from "@/lib/nvidia";
import { NextResponse } from "next/server";

/**
 * 12-LANGUAGE TRANSLATION API — Uses NVIDIA Riva Translate 4B
 * to translate outbound marketing emails and content into any of 12 languages.
 * 
 * Supported: English, Spanish, French, German, Italian, Portuguese, 
 * Russian, Chinese, Japanese, Korean, Arabic, Hindi
 */

const SUPPORTED_LANGUAGES = [
  "en", "es", "fr", "de", "it", "pt", "ru", "zh", "ja", "ko", "ar", "hi"
];

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English", es: "Spanish", fr: "French", de: "German",
  it: "Italian", pt: "Portuguese", ru: "Russian", zh: "Chinese",
  ja: "Japanese", ko: "Korean", ar: "Arabic", hi: "Hindi",
};

export async function POST(request: Request) {
  try {
    const { text, source_lang = "en", target_lang } = await request.json();

    if (!text || !target_lang) {
      return NextResponse.json({ error: "text and target_lang are required." }, { status: 400 });
    }

    if (!SUPPORTED_LANGUAGES.includes(target_lang)) {
      return NextResponse.json({
        error: `Unsupported language: ${target_lang}`,
        supported: SUPPORTED_LANGUAGES.map(l => `${l} (${LANGUAGE_NAMES[l]})`),
      }, { status: 400 });
    }

    const nimRes = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${await getNimKey()}`,
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
    });

    const nimData = await nimRes.json();
    const translatedText = nimData?.choices?.[0]?.message?.content || text;

    return NextResponse.json({
      success: true,
      model: "riva-translate-4b",
      source: { lang: source_lang, name: LANGUAGE_NAMES[source_lang], text },
      target: { lang: target_lang, name: LANGUAGE_NAMES[target_lang], text: translatedText },
      character_count: text.length,
    });
  } catch (error) {
    return NextResponse.json({ error: "Translation error", details: String(error) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: "Riva Translate 4B — Active",
    supported_languages: SUPPORTED_LANGUAGES.map(l => ({ code: l, name: LANGUAGE_NAMES[l] })),
    model: "nvidia/riva-translate-4b-instruct-v1_1",
  });
}
