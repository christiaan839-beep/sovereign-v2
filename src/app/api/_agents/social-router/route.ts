import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES, PLATFORM_RULES } from "@/lib/content-engine";
import { fireUserWebhook } from "@/lib/webhooks";

/**
 * Social Router API
 * Generates platform-native social media content with anti-slop rules.
 * Adapts the same core message for each platform's unique format.
 */

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { topic, platforms, brandVoice, targetAudience } = await req.json();

    const selectedPlatforms = platforms || ["instagram", "linkedin", "twitter"];

    const prompt = `Create platform-native social media posts for: "${topic}"

TARGET AUDIENCE: ${targetAudience || "Business professionals"}
BRAND VOICE: ${brandVoice || "Authoritative but approachable"}
PLATFORMS: ${selectedPlatforms.join(", ")}

For EACH platform, generate a COMPLETE, ready-to-post piece of content following these platform-specific rules:

${selectedPlatforms.map((p: string) => `### ${p.toUpperCase()}\n${PLATFORM_RULES[p] || "Write platform-native content."}`).join("\n\n")}

Respond in JSON:
{
  "posts": [
    {
      "platform": "instagram",
      "postType": "carousel/reel/story/static",
      "caption": "Full caption with line breaks",
      "hashtags": ["tag1", "tag2"],
      "visualDirection": "What the image/video should show",
      "bestTime": "Recommended posting time",
      "engagementCta": "Specific question to drive comments"
    }
  ],
  "crossPostingNotes": "How to sequence these across platforms for maximum reach"
}`;

    const systemPrompt = `You are a social media strategist who creates viral, platform-native content. Each post must feel like it was written by someone who lives on that platform — not cross-posted generic content.\n\n${ANTI_SLOP_RULES}`;

    const result = await ai(prompt, { system: systemPrompt, maxTokens: 3000 });

    let parsed;
    try {
      const cleaned = result.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { posts: [], rawOutput: result };
    }

    await fireUserWebhook("SocialRouter", "PostsGenerated", { topic, platforms: selectedPlatforms });

    return NextResponse.json({ success: true, ...parsed });
  } catch (err) {
    console.error("[Social Router] Error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
