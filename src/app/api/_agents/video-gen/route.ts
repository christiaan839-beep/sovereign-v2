import { createAgentRoute } from "@/lib/agent-factory";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ai } from "@/lib/ai";

/**
 * AUTONOMOUS FILMMAKER NODE
 * Cinematic Video Generation via Luma Dream Machine & Runway Gen-3 APIs.
 * Uses AI to enhance prompts into cinematic directives before generation.
 */

export const POST = createAgentRoute({
  name: "video-gen",
  handler: async ({ input, email, userId }) => {
    const {
      prompt,
      provider = "luma",
      enhance = true,
    } = input as Record<string, unknown>;

    if (!prompt) {
      return { error: "Cinematic prompt required." };
    }

    // Use AI to enhance the raw prompt into a cinematic video directive
    let cinematicPrompt = prompt;
    if (enhance) {
      cinematicPrompt = await ai(
        `Enhance this video generation prompt into a cinematic directive optimized for AI video generation (Luma Dream Machine).

RAW PROMPT: ${prompt}

Return ONLY the enhanced prompt (no explanations). The enhanced prompt should:
- Describe camera movement (pan, dolly, crane, tracking shot)
- Specify lighting (golden hour, dramatic shadows, neon glow, studio lighting)
- Include cinematographic style (anamorphic, shallow depth of field, wide angle)
- Add atmosphere and mood (cinematic color grading, film grain, lens flare)
- Keep it under 200 words
- Be a single paragraph, no bullet points`,
        {
          system:
            "You are a Hollywood cinematographer and visual director. You translate simple ideas into breathtaking cinematic visions. Output ONLY the enhanced prompt text.",
          maxTokens: 300,
        },
      );
    }

    let apiKey = process.env.VIDEO_GEN_API_KEY || "";

    if (email) {
      try {
        const userSettings = await db.query.settings.findFirst({
          where: eq(settings.userEmail, email),
        });
        if (userSettings?.apiKeys) {
          const keys = JSON.parse(userSettings.apiKeys);
          if (keys.luma && provider === "luma") apiKey = keys.luma;
          if (keys.runway && provider === "runway") apiKey = keys.runway;
        }
      } catch {
        /* BYOK lookup failed — use default */
      }
    }

    if (!apiKey) {
      return {
        error: `API Key required for ${provider} Video Generative Engine.`,
      };
    }

    if (provider === "luma") {
      const response = await fetch(
        "https://api.lumalabs.ai/dream-machine/v1/generations",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: cinematicPrompt,
            aspect_ratio: "16:9",
          }),
        },
      );

      if (!response.ok) {
        const errDump = await response.text();
        return NextResponse.json(
          { error: "Luma API Error", details: errDump },
          { status: response.status },
        );
      }

      const lumaData = await response.json();

      return {
        success: true,
        task_id: lumaData.id,
        status: "GENERATING",
        original_prompt: prompt,
        enhanced_prompt: cinematicPrompt,
        message: "Luma Cinematic Engine Engaged. Awaiting render.",
      };
    }

    return { error: "Unsupported Video Provider." };
  },
});
