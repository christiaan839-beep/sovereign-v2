import { nimChat, getNimKey } from "@/lib/nvidia";
import { NextResponse } from "next/server";

/**
 * KIMI K2.5 CREATIVE DIRECTOR — MoE model currently #1 Featured on NIM.
 * 
 * Specializes in creative content generation:
 * - Ad copy & headlines
 * - Social media campaigns
 * - Brand voice & storytelling
 * - Product descriptions
 * - Video scripts
 * 
 * LICENSE: Apache 2.0 — commercial use permitted.
 */

export async function POST(request: Request) {
  try {
    const { brief, style = "professional", platform = "general", count = 3 } = await request.json();

    if (!brief) {
      return NextResponse.json({ error: "brief is required." }, { status: 400 });
    }

    const styleGuides: Record<string, string> = {
      professional: "Polished, authoritative, data-driven. Think McKinsey meets Apple.",
      bold: "Provocative, disruptive, attention-grabbing. Think Ogilvy meets Nike.",
      conversational: "Warm, relatable, human. Think Mailchimp meets Innocent.",
      luxury: "Exclusive, refined, aspirational. Think Hermès meets Rolls-Royce.",
      tech: "Clean, precise, innovative. Think Stripe meets Vercel.",
    };

    const platformGuides: Record<string, string> = {
      general: "Create versatile content adaptable to any channel.",
      twitter: "Max 280 characters per post. Punchy, hashtag-smart, engagement-focused.",
      linkedin: "Professional tone, thought-leadership angle, 150-300 words.",
      instagram: "Visual-first descriptions, emoji-friendly, 125-150 words with hashtags.",
      email: "Subject line + body. Clear CTA. Personalization tokens like {firstName}.",
    };

    const start = Date.now();
    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${await getNimKey()}` },
      body: JSON.stringify({
        model: "moonshotai/kimi-k2.5",
        messages: [
          {
            role: "system",
            content: `You are a world-class Creative Director at a top agency. Style: ${styleGuides[style] || styleGuides.professional}. Platform: ${platformGuides[platform] || platformGuides.general}. Generate exactly ${count} creative variations.`,
          },
          { role: "user", content: `Creative Brief: ${brief}` },
        ],
        max_tokens: 1200,
        temperature: 0.8,
      }),
    });

    const data = await res.json();

    return NextResponse.json({
      success: true,
      model: "Kimi K2.5 (MoE — Featured #1 on NIM)",
      style, platform,
      creatives: data?.choices?.[0]?.message?.content || "",
      duration_ms: Date.now() - start,
      license: "Apache 2.0 — commercial use permitted",
    });
  } catch (error) {
    return NextResponse.json({ error: "Creative Director error", details: String(error) }, { status: 500 });
  }
}
