import { createAgentRoute } from "@/lib/agent-factory";
import { createLogger } from "@/lib/logger";

const log = createLogger("music-gen");

/**
 * MUSIC-GEN AGENT — AI music generation via Google Lyria 3 Pro.
 * Creates commercially-usable music tracks up to 3 minutes.
 * Available on Vertex AI (public preview) and Gemini API.
 * Outputs are watermarked and avoid mimicking existing artists.
 */
import { outboundFetchAsResponse } from "@/lib/outbound-fetch";

export const POST = createAgentRoute({
  name: "music-gen",
  handler: async ({ input, email, userId }) => {
    const {
      prompt = "",
      duration = 30,
      style,
      instruments,
    } = input as {
      prompt?: string;
      duration?: number;
      style?: string;
      instruments?: string[];
    };
    if (!prompt) return { error: "Missing music prompt" };

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { error: "GEMINI_API_KEY required for Lyria 3 Pro" };

    // Build enhanced prompt with style and instruments
    let enhancedPrompt = prompt;
    if (style) enhancedPrompt += `. Style: ${style}`;
    if (instruments) enhancedPrompt += `. Instruments: ${instruments}`;

    // Lyria 3 Pro API via Gemini API
    const res = await outboundFetchAsResponse(`https://generativelanguage.googleapis.com/v1beta/models/lyria-3-pro:generateMusic?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: enhancedPrompt }] }],
          generationConfig: {
            durationSeconds: Math.min(duration, 180), // Max 3 minutes
          },
        }),
      }, { ruleId: "agents.music-gen.route.1", allowedHosts: ["generativelanguage.googleapis.com"] });

    if (!res.ok) {
      const errorText = await res.text();
      log.warn("Lyria 3 Pro unavailable", {
        status: res.status,
        error: errorText,
      });

      // Fall back to generating a music brief via text AI
      const { ai } = await import("@/lib/ai");
      const brief = await ai(
        `Create a detailed music production brief for: ${enhancedPrompt}. Include BPM, key, structure (intro/verse/chorus/bridge/outro), instrument arrangement, and mixing notes.`,
        {
          system:
            "You are a senior music producer creating professional production briefs.",
          maxTokens: 1500,
        },
      );

      return {
        output: brief,
        model: "text-brief-fallback",
        note: "Lyria 3 Pro requires Google AI Ultra or Vertex AI. Generated a production brief instead.",
      };
    }

    const data = await res.json();
    // Lyria returns audio data
    const audioData = data.candidates?.[0]?.content?.parts?.[0];

    return {
      output: "Music generated successfully",
      audio: audioData,
      model: "lyria-3-pro",
      duration,
      prompt: enhancedPrompt,
      commercial_use: true,
      watermarked: true,
    };
  },
});
