import { createAgentRoute } from "@/lib/agent-factory";
import { z } from "zod";
import { ai, adaptive_ai } from "@/lib/ai";
import { remember, recall } from "@/lib/memory";

/**
 * BRAND VOICE CLONER — Learn a brand's voice from samples, then generate
 * new content matching it. Uses Adaptive AI with memory for improvement.
 */

const schema = z
  .object({
    action: z.enum(["learn", "generate"]),
    samples: z.array(z.string()).optional(),
    prompt: z.string().max(5000).optional(),
    brand_name: z.string().max(200).optional(),
    url: z.string().max(500).optional(),
    context: z.string().max(5000).optional(),
  })
  .refine(
    (d) =>
      (d.action === "learn" && d.samples && d.samples.length >= 3) ||
      (d.action === "generate" && d.prompt),
    { message: "learn requires 3+ samples; generate requires a prompt" },
  );

export const POST = createAgentRoute({
  name: "brand-voice",
  schema,
  // Wave 125 M3 batch 16: factory memory hooks layered ON TOP of the
  // existing internal `remember`/`recall` primitive. The internal one
  // stores the structured voice-profile JSON; the factory memory adds
  // CROSS-brand pattern recall (e.g. "last time we did luxury for a
  // hospitality brand the tone landed best at confidence 0.82").
  memory: {
    search: {
      query: (input) =>
        `brand-voice ${input.action ?? "?"} ${input.brand_name ?? "any"} ${String(input.prompt ?? "").slice(0, 80)}`.trim(),
      limit: 2,
    },
    store: {
      extract: (result) => {
        const r = result as {
          action?: string;
          brand_name?: string;
          voiceProfile?: { tone?: string };
          generatedContent?: string;
        };
        if (!r.action) return null;
        const head =
          r.voiceProfile?.tone ?? r.generatedContent?.slice(0, 180) ?? "";
        return `[${r.action}] ${r.brand_name ?? "default"}: ${head}`;
      },
      metadata: (input) => ({
        brand: typeof input.brand_name === "string" ? input.brand_name : "",
        kind: "brand-voice",
      }),
    },
  },
  handler: async ({ input }) => {
    const { action, samples, prompt, brand_name, url, context } =
      input as z.infer<typeof schema>;
    const label = brand_name || "default";

    if (action === "learn") {
      const samplesText = samples!
        .map((s, i) => `Sample ${i + 1}:\n${s}`)
        .join("\n\n---\n\n");

      const voiceProfile = await ai(
        `Analyze these content samples and extract the brand's unique voice profile.
${context ? `\nCONTEXT:\n${context}\n` : ""}${url ? `\nBrand URL: ${url}\n` : ""}
${samplesText}

OUTPUT (strict JSON):
{"tone": "...", "vocabulary_level": "...", "sentence_structure": "...", "personality_traits": ["..."], "signature_phrases": ["..."], "topics_they_avoid": ["..."], "formatting_style": "...", "call_to_action_style": "...", "example_hooks": ["..."]}

Output ONLY valid JSON.`,
        {
          system:
            "You are a brand strategist who reverse-engineers voice from content samples. Be specific.",
          maxTokens: 2000,
        },
      );

      await remember(`BRAND_VOICE_PROFILE:${label} ${voiceProfile}`);

      let parsed;
      try {
        parsed = JSON.parse(
          voiceProfile
            .replace(/```json?\n?/g, "")
            .replace(/```/g, "")
            .trim(),
        );
      } catch {
        parsed = { raw: voiceProfile };
      }

      return {
        success: true,
        action: "learn",
        brand: label,
        voice_profile: parsed,
        samples_analyzed: samples!.length,
      };
    }

    // Generate content in the learned brand voice
    let voiceContext = "";
    try {
      const memories = await recall(`BRAND_VOICE_PROFILE:${label}`, 1);
      if (memories.length > 0) voiceContext = memories[0].entry.text;
    } catch {
      /* no profile found */
    }

    const result = await adaptive_ai(prompt!, {
      system: `You are writing content as the brand "${label}". Match their exact voice, tone, and style.

${voiceContext ? `LEARNED VOICE PROFILE:\n${voiceContext}` : "No voice profile found — write in a professional, engaging tone."}
${context ? `\nCONTEXT:\n${context}` : ""}${url ? `\nBrand URL: ${url}` : ""}

RULES: Match vocabulary level. Use signature phrases naturally. Mirror formatting. Sound human.`,
      maxTokens: 2000,
    });

    return {
      success: true,
      action: "generate",
      brand: label,
      content: result,
      voice_matched: !!voiceContext,
    };
  },
});
