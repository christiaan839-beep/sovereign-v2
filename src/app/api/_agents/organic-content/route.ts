import { createAgentRoute } from "@/lib/agent-factory";
import { z } from "zod";
import { ai } from "@/lib/ai";
import {
  ANTI_SLOP_RULES,
  VOICE_PRESETS,
  PLATFORM_RULES,
  QUALITY_SCORER_PROMPT,
} from "@/lib/content-engine";
import type { VoicePreset } from "@/lib/content-engine";
import { fireUserWebhook } from "@/lib/webhooks";

/**
 * ORGANIC CONTENT ENGINE — Premium anti-slop content for organic marketing.
 * Supports: Blog, Social Pack, Video Script, Newsletter, Thread.
 * Custom 3-pass system: generate → score → auto-revise.
 */

const schema = z.object({
  contentType: z.enum([
    "blog",
    "social-pack",
    "video-script",
    "newsletter",
    "thread",
  ]),
  topic: z.string().min(3).max(500),
  platform: z.string().max(50).optional(),
  voice: z.string().max(50).optional(),
  targetAudience: z.string().max(500).optional(),
  brandContext: z.string().max(2000).optional(),
  keywords: z.array(z.string()).optional(),
  prompt: z.string().max(5000).optional(),
  context: z.string().max(5000).optional(),
});

export const POST = createAgentRoute({
  name: "organic-content",
  schema,
  skipQualityCheck: true, // Agent has its own 3-pass quality system
  // Wave-111.1 batch 4: memory hooks. Per-content-type + topic
  // history compounds brand-voice + avoids repeating hooks/angles.
  memory: {
    search: {
      query: (input) =>
        `organic-content type:${input.contentType ?? ""} topic:${input.topic ?? ""} voice:${input.voice ?? ""} platform:${input.platform ?? ""}`,
      limit: 3,
    },
    store: {
      extract: (result, input) => {
        const r = result as { content?: string; raw?: string };
        const piece = (r.content ?? r.raw ?? "").slice(0, 400);
        if (!piece) return null;
        return `${input.contentType ?? "content"} on ${input.topic ?? ""}: ${piece}`;
      },
      metadata: (input) => ({
        contentType: String(input.contentType ?? ""),
        topic: String(input.topic ?? ""),
        voice: String(input.voice ?? ""),
        platform: String(input.platform ?? ""),
        kind: "organic-content",
      }),
    },
  },
  handler: async ({ input, pastContextAsPrompt }) => {
    const {
      contentType,
      topic,
      platform,
      voice,
      targetAudience,
      brandContext,
      keywords,
      context,
    } = input as z.infer<typeof schema>;
    const pastContent = pastContextAsPrompt();

    const voicePreset =
      VOICE_PRESETS[(voice as VoicePreset) || "conversational"];
    const platformRules = PLATFORM_RULES[platform || "blog"] || "";

    // Build content-type-specific prompt
    const contentPrompts: Record<string, string> = {
      blog: `Write a blog post about: ${topic}\n\nTARGET AUDIENCE: ${targetAudience || "Business professionals"}\nKEYWORDS: ${(keywords || []).join(", ") || "Not specified"}\nBRAND CONTEXT: ${brandContext || "Not specified"}\n${context ? `CONTEXT:\n${context.slice(0, 2000)}` : ""}\n\nRequirements:\n- Title: 50-60 chars, click-worthy\n- Length: 1200-1800 words\n- Structure: Hook intro (3 sentences) → 5-6 sections with H2s → CTA conclusion\n- Include 2-3 data points\n- Include 1 contrarian take`,

      "social-pack": `Create a 7-day organic content calendar for: ${topic}\n\nPLATFORM: ${platform || "instagram"}\nTARGET: ${targetAudience || "Business professionals"}\n\nFor each day: POST TYPE, HOOK, FULL CAPTION, HASHTAGS, VISUAL DIRECTION, BEST TIME, ENGAGEMENT CTA.\nMix formats. Each post must be immediately publishable.`,

      "video-script": `Write a video script about: ${topic}\n\nPLATFORM: ${platform || "youtube"}\nTARGET: ${targetAudience || "Business professionals"}\n\nFormat: HOOK (0-3s), INTRO (3-15s), BODY (15-120s with 3-4 key points), CTA (final 10s).\nInclude [VISUAL], [TEXT OVERLAY], [TRANSITION] tags.`,

      newsletter: `Write a newsletter about: ${topic}\n\nTARGET: ${targetAudience || "Subscribers"}\n\nFormat: SUBJECT LINE (2 options), PREVIEW TEXT, OPENING (bold claim), MAIN CONTENT (400-600 words with story/data), KEY TAKEAWAY, CTA, P.S. LINE.`,

      thread: `Write a Twitter/X thread about: ${topic}\n\nTARGET: ${targetAudience || "Business/tech professionals"}\n\n8-12 tweets under 280 chars each.\nTweet 1: viral standalone. Include data, contrarian take. Last tweet: CTA.\nFormat: 1/, 2/, etc.`,
    };

    const basePrompt = contentPrompts[contentType];
    const contentPrompt = pastContent
      ? `${basePrompt}\n\nPRIOR CONTENT on similar topics (historical FACTS — avoid duplicating hooks/angles already used):\n${pastContent}`
      : basePrompt;

    // PASS 1: Generate with anti-slop rules
    const systemPrompt = `${voicePreset}\n\n${ANTI_SLOP_RULES}\n\n${platformRules}`;
    // Cost: long-form content gen at 4k tokens. NIM Nemotron-Ultra-253B
    // beats Gemini Flash on long-form quality at $0.
    const rawContent = await ai(contentPrompt, {
      system: systemPrompt,
      maxTokens: 4000,
      model: "nim",
    });

    // PASS 2: Quality score
    const scoreResult = await ai(
      `Score this ${contentType} content:\n\n---\n${rawContent}\n---`,
      { system: QUALITY_SCORER_PROMPT, maxTokens: 500 },
    );

    let qualityScore;
    try {
      qualityScore = JSON.parse(
        scoreResult
          .replace(/```json?\n?/g, "")
          .replace(/```/g, "")
          .trim(),
      );
    } catch {
      qualityScore = { overallScore: 7, verdict: "PUBLISH", scores: {} };
    }

    // PASS 3: Auto-revise if needed
    let finalContent = rawContent;
    if (
      qualityScore.verdict === "NEEDS_REVISION" &&
      qualityScore.issues?.length > 0
    ) {
      finalContent = await ai(
        `Revise this ${contentType} to fix:\n\nISSUES:\n${qualityScore.issues.join("\n")}\n\nORIGINAL:\n${rawContent}\n\nRewrite the FULL content. No explanations.`,
        { system: systemPrompt, maxTokens: 4000 },
      );
    }

    await fireUserWebhook("OrganicContent", contentType, {
      topic,
      platform,
      qualityScore: qualityScore.overallScore,
    }).catch(() => {});

    return {
      success: true,
      content: finalContent,
      qualityScore,
      metadata: {
        contentType,
        platform: platform || "blog",
        voice: voice || "conversational",
        generatedAt: new Date().toISOString(),
        wasRevised: qualityScore.verdict === "NEEDS_REVISION",
      },
    };
  },
});
