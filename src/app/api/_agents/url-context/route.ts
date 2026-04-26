import { createAgentRoute } from "@/lib/agent-factory";
import { assertSafeUrl, SafeFetchError } from "@/lib/safe-fetch";

/**
 * URL CONTEXT ANALYZER — Gemini reads any URL directly.
 *
 * Uses Gemini 2.5 Pro's URL context feature to analyze web pages,
 * documents, or any publicly accessible URL without scraping.
 * Gemini fetches and processes the content natively.
 *
 * Input: { url, question? }
 * Output: { analysis, keyFindings[], url }
 */

export const POST = createAgentRoute({
  name: "url-context",
  requiredFields: ["url"],
  handler: async ({ input }) => {
    const url = input.url as string;
    const question =
      (input.question as string) ||
      "Analyze this page. Extract the key information, purpose, target audience, and any notable strengths or weaknesses.";

    // Reject internal/loopback/private URLs before handing them to Gemini
    // (Gemini will fetch the URL on our behalf, so SSRF still applies).
    let safeUrl: string;
    try {
      safeUrl = assertSafeUrl(url).toString();
    } catch (e) {
      if (e instanceof SafeFetchError) return { error: e.message };
      return { error: "Invalid URL" };
    }

    const geminiKey =
      process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return { error: "Google AI API key not configured." };
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: question },
                { fileData: { fileUri: safeUrl, mimeType: "text/html" } },
              ],
            },
          ],
          systemInstruction: {
            parts: [
              {
                text: "You are a senior analyst. Analyze the provided URL content thoroughly. Be specific — cite exact text, numbers, and details from the page. Structure your response with clear sections. No filler.",
              },
            ],
          },
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 3000,
          },
        }),
      },
    );

    if (!res.ok) {
      // Fallback: try with google_search grounding instead
      const fallbackRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `Analyze this URL and answer: ${question}\n\nURL: ${safeUrl}`,
                  },
                ],
              },
            ],
            tools: [{ google_search: {} }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 3000 },
          }),
        },
      );

      if (!fallbackRes.ok) {
        return { error: `Gemini API error`, details: await fallbackRes.text() };
      }

      const fallbackData = await fallbackRes.json();
      const answer =
        fallbackData.candidates?.[0]?.content?.parts
          ?.map((p: { text?: string }) => p.text || "")
          .join("") || "";
      return {
        analysis: answer,
        url,
        method: "grounded-search-fallback",
        model: "gemini-2.5-pro",
      };
    }

    const data = await res.json();
    const analysis =
      data.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text || "")
        .join("") || "";

    return {
      analysis,
      url,
      method: "direct-url-context",
      model: "gemini-2.5-pro",
    };
  },
});
