import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ai } from "@/lib/ai";

/**
 * AUTONOMOUS FILMMAKER NODE
 * Cinematic Video Generation via Luma Dream Machine & Runway Gen-3 APIs.
 * Uses AI to enhance prompts into cinematic directives before generation.
 */

export async function POST(req: Request) {
  try {
    const { prompt, provider = "luma", enhance = true } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Cinematic prompt required." }, { status: 400 });
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
          system: "You are a Hollywood cinematographer and visual director. You translate simple ideas into breathtaking cinematic visions. Output ONLY the enhanced prompt text.",
          maxTokens: 300,
        }
      );
    }

    const user = await currentUser();
    let apiKey = process.env.VIDEO_GEN_API_KEY || "";

    if (user?.primaryEmailAddress?.emailAddress) {
      const userSettings = await db.query.settings.findFirst({
        where: eq(settings.userEmail, user.primaryEmailAddress.emailAddress)
      });
      if (userSettings?.apiKeys) {
        const keys = JSON.parse(userSettings.apiKeys);
        if (keys.luma && provider === "luma") apiKey = keys.luma;
        if (keys.runway && provider === "runway") apiKey = keys.runway;
      }
    }

    if (!apiKey) {
      return NextResponse.json({ error: `API Key required for ${provider} Video Generative Engine.` }, { status: 401 });
    }

    if (provider === "luma") {
      const response = await fetch('https://api.lumalabs.ai/dream-machine/v1/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: cinematicPrompt,
          aspect_ratio: "16:9"
        })
      });

      if (!response.ok) {
        const errDump = await response.text();
        return NextResponse.json({ error: "Luma API Error", details: errDump }, { status: response.status });
      }

      const lumaData = await response.json();

      return NextResponse.json({
        success: true,
        task_id: lumaData.id,
        status: "GENERATING",
        original_prompt: prompt,
        enhanced_prompt: cinematicPrompt,
        message: "Luma Cinematic Engine Engaged. Awaiting render."
      });
    }

    return NextResponse.json({ error: "Unsupported Video Provider." }, { status: 400 });

  } catch (error) {
    return NextResponse.json({ error: "Filmmaker Engine Exception", details: String(error) }, { status: 500 });
  }
}
