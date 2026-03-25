import { NextResponse } from "next/server";
import { ai, adaptive_ai } from "@/lib/ai";
import { remember, recall } from "@/lib/memory";

/**
 * BRAND VOICE CLONER — Analyze existing content to learn a brand's voice,
 * then generate new content that sounds exactly like them.
 * 
 * Uses Adaptive AI (memory-enhanced) to improve over time.
 */

export async function POST(request: Request) {
  try {
    const { action, samples, prompt, brand_name } = await request.json();

    // ACTION: LEARN — Ingest sample content to learn the brand voice
    if (action === "learn") {
      if (!samples || !Array.isArray(samples) || samples.length < 3) {
        return NextResponse.json({ error: "Provide at least 3 content samples as an array." }, { status: 400 });
      }

      const samplesText = samples.map((s: string, i: number) => `Sample ${i + 1}:\n${s}`).join("\n\n---\n\n");

      const voiceProfile = await ai(
        `Analyze these content samples and extract the brand's unique voice profile.

${samplesText}

OUTPUT (strict JSON):
{
  "tone": "description of overall tone (e.g., 'confident but approachable')",
  "vocabulary_level": "grade level and word choices",
  "sentence_structure": "short/long, simple/complex, patterns observed",
  "personality_traits": ["trait1", "trait2", "trait3"],
  "signature_phrases": ["phrases they frequently use"],
  "topics_they_avoid": ["things they never talk about"],
  "formatting_style": "how they structure posts (line breaks, emojis, hashtags)",
  "call_to_action_style": "how they close content",
  "example_hooks": ["3 hooks that match their style"]
}

Output ONLY valid JSON.`,
        { system: "You are a brand strategist who can reverse-engineer any brand's voice from content samples. Be specific and actionable.", maxTokens: 2000 }
      );

      // Store the voice profile in memory for later retrieval
      const label = brand_name || "default";
      await remember(`BRAND_VOICE_PROFILE:${label} ${voiceProfile}`);

      let parsed;
      try {
        parsed = JSON.parse(voiceProfile.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
      } catch {
        parsed = { raw: voiceProfile };
      }

      return NextResponse.json({
        success: true,
        action: "learn",
        brand: label,
        voice_profile: parsed,
        samples_analyzed: samples.length,
        message: `Voice profile for "${label}" learned and stored in memory.`,
      });
    }

    // ACTION: GENERATE — Create content in the learned brand voice
    if (action === "generate") {
      if (!prompt) {
        return NextResponse.json({ error: "prompt is required for generation." }, { status: 400 });
      }

      const label = brand_name || "default";

      // Recall the stored voice profile
      let voiceContext = "";
      try {
        const memories = await recall(`BRAND_VOICE_PROFILE:${label}`, 1);
        if (memories.length > 0) {
          voiceContext = memories[0].entry.text;
        }
      } catch {
        // No voice profile found — generate without it
      }

      const result = await adaptive_ai(prompt, {
        system: `You are writing content as the brand "${label}". You must match their exact voice, tone, and style.

${voiceContext ? `LEARNED VOICE PROFILE:\n${voiceContext}` : "No voice profile found — write in a professional, engaging tone."}

RULES:
- Match the brand's vocabulary level exactly
- Use their signature phrases naturally
- Mirror their formatting style
- Sound human, not AI-generated
- Never break character`,
        maxTokens: 2000,
      });

      return NextResponse.json({
        success: true,
        action: "generate",
        brand: label,
        content: result,
        voice_matched: !!voiceContext,
      });
    }

    return NextResponse.json({ error: "action must be 'learn' or 'generate'." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: "Brand voice cloner error", details: String(error) }, { status: 500 });
  }
}
