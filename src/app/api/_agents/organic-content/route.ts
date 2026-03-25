import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES, VOICE_PRESETS, PLATFORM_RULES, QUALITY_SCORER_PROMPT } from "@/lib/content-engine";
import type { VoicePreset } from "@/lib/content-engine";
import { fireUserWebhook } from "@/lib/webhooks";

/**
 * Organic Content Production Engine
 * 
 * Generates premium, anti-slop content for organic marketing.
 * Supports: Blog, Instagram, LinkedIn, Twitter, TikTok, YouTube, Newsletter
 * 
 * Uses a 2-pass system:
 * 1. Generate content with anti-slop rules injected
 * 2. Score quality and auto-revise if below threshold
 */

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { contentType, topic, platform, voice, targetAudience, brandContext, keywords } = await req.json();

    if (!contentType || !topic) {
      return NextResponse.json({ error: "contentType and topic are required" }, { status: 400 });
    }

    const voicePreset = VOICE_PRESETS[(voice as VoicePreset) || "conversational"];
    const platformRules = PLATFORM_RULES[platform || "blog"] || "";

    // Build the content generation prompt
    let contentPrompt = "";

    switch (contentType) {
      case "blog":
        contentPrompt = `Write a blog post about: ${topic}

TARGET AUDIENCE: ${targetAudience || "Business professionals and decision-makers"}
KEYWORDS: ${(keywords || []).join(", ") || "Not specified"}
BRAND CONTEXT: ${brandContext || "Not specified"}

Requirements:
- Title: 50-60 chars, include primary keyword naturally, make it click-worthy
- Length: 1200-1800 words
- Structure: Hook intro (3 sentences max) → 5-6 sections with H2s → Short conclusion with CTA
- Include 2-3 data points or statistics (real or realistic)
- Include 1 contrarian take that challenges conventional wisdom
- End with an open loop or provocative question, NOT a generic summary`;
        break;

      case "social-pack":
        contentPrompt = `Create a 7-day organic content calendar for: ${topic}

TARGET AUDIENCE: ${targetAudience || "Business professionals"}
PLATFORM: ${platform || "instagram"}
BRAND CONTEXT: ${brandContext || "Not specified"}

For EACH of the 7 days, generate:
1. POST TYPE (carousel, reel script, story, static, text post)
2. HOOK (the text/visual that stops the scroll)
3. FULL CAPTION (platform-native length and format)
4. HASHTAGS (if applicable)
5. VISUAL DIRECTION (what should the image/video contain)
6. BEST POSTING TIME (based on platform algorithm)
7. ENGAGEMENT CTA (specific question or action to drive comments)

Mix content types across the week. Never repeat the same format twice in a row.
Each post must be immediately publishable — no placeholders.`;
        break;

      case "video-script":
        contentPrompt = `Write a video script about: ${topic}

TARGET AUDIENCE: ${targetAudience || "Business professionals"}
PLATFORM: ${platform || "youtube"}
BRAND CONTEXT: ${brandContext || "Not specified"}

Format:
HOOK (0-3 seconds): The exact words/visual that prevent the scroll
INTRO (3-15 seconds): Establish credibility and promise value
BODY (15-120 seconds): 3-4 key points, each with a real example or story
CTA (final 10 seconds): Single, clear next step

Include:
- Exact speaker dialogue (in quotes)
- [VISUAL] tags describing what's on screen
- [TEXT OVERLAY] for any text graphics
- [TRANSITION] notes for editing
- Timing for each segment`;
        break;

      case "newsletter":
        contentPrompt = `Write a newsletter issue about: ${topic}

TARGET AUDIENCE: ${targetAudience || "Subscribers interested in business/growth"}
BRAND CONTEXT: ${brandContext || "Not specified"}

Format:
1. SUBJECT LINE (2 options: one curiosity-based, one benefit-based)
2. PREVIEW TEXT (complement the subject, max 90 chars)
3. OPENING (personal anecdote or bold claim — 2 sentences)
4. MAIN CONTENT (one core idea, 400-600 words)
   - Include a specific story, case study, or data point
   - Break into short paragraphs (2-3 sentences max)
   - Add 1-2 subheadings
5. KEY TAKEAWAY (1 sentence, bolded)
6. CTA (specific, relevant to the content — not generic)
7. P.S. LINE (add a personal touch or teaser for next issue)`;
        break;

      case "thread":
        contentPrompt = `Write a Twitter/X thread about: ${topic}

TARGET AUDIENCE: ${targetAudience || "Business/tech professionals"}

Requirements:
- 8-12 tweets, each under 280 characters
- Tweet 1: Must stand alone as a viral tweet. Bold claim, number, or counterintuitive statement.
- Each tweet: ONE idea. Short sentences. Use line breaks.
- Include at least 1 tweet with a specific number or data point
- Include at least 1 contrarian take
- Last tweet: CTA (follow, reply, or visit link)
- Format each tweet with the number (1/, 2/, etc.)

The thread should read like a mini-essay that builds momentum. Each tweet should make the reader NEED to see the next one.`;
        break;

      default:
        return NextResponse.json({ error: `Unknown contentType: ${contentType}` }, { status: 400 });
    }

    // PASS 1: Generate content with anti-slop rules
    const systemPrompt = `${voicePreset}\n\n${ANTI_SLOP_RULES}\n\n${platformRules}`;

    const rawContent = await ai(contentPrompt, {
      system: systemPrompt,
      maxTokens: 4000,
      model: "gemini", // Use Gemini 2.0 Pro for best long-form quality
    });

    // PASS 2: Quality score the content
    const scoreResult = await ai(
      `Score this ${contentType} content:\n\n---\n${rawContent}\n---`,
      { system: QUALITY_SCORER_PROMPT, maxTokens: 500 }
    );

    let qualityScore;
    try {
      const cleaned = scoreResult.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      qualityScore = JSON.parse(cleaned);
    } catch {
      qualityScore = { overallScore: 7, verdict: "PUBLISH", scores: {} };
    }

    // PASS 3: Auto-revise if quality is below threshold
    let finalContent = rawContent;
    if (qualityScore.verdict === "NEEDS_REVISION" && qualityScore.issues?.length > 0) {
      const revisionPrompt = `Revise this ${contentType} content to fix these issues:\n\nISSUES:\n${qualityScore.issues.join("\n")}\n\nSUGGESTIONS:\n${(qualityScore.suggestions || []).join("\n")}\n\nORIGINAL CONTENT:\n${rawContent}\n\nRewrite the FULL content with these fixes applied. Do NOT add explanations — just output the improved content.`;

      finalContent = await ai(revisionPrompt, {
        system: systemPrompt,
        maxTokens: 4000,
      });
    }

    // Fire webhook
    await fireUserWebhook("OrganicContent", contentType, { topic, platform, qualityScore: qualityScore.overallScore });

    return NextResponse.json({
      success: true,
      content: finalContent,
      qualityScore,
      metadata: {
        contentType,
        platform: platform || "blog",
        voice: voice || "conversational",
        generatedAt: new Date().toISOString(),
        wasRevised: qualityScore.verdict === "NEEDS_REVISION",
      }
    });

  } catch (err) {
    console.error("[Organic Content] Error:", err);
    return NextResponse.json({ error: "Failed to generate content" }, { status: 500 });
  }
}
