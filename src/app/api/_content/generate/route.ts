import { NextResponse } from "next/server";
import { vertex as google } from "@ai-sdk/google-vertex";
import { generateText } from "ai";
import { db } from "@/db";
import { scheduledContent } from "@/db/schema";
import { requireAuth } from "@/lib/auth-guard";

/**
 * Content Auto-Generator API
 * 
 * Uses Gemini 2.5 Pro to generate a full week of social media content
 * and automatically schedules it in the Content Calendar.
 * This is the key automation gap — content creation is now zero-touch.
 */
export async function POST(req: Request) {
  const auth = await requireAuth(); if (auth.error) return auth.error;
  try {
    const { industry, topics, platforms } = await req.json();

    const targetPlatforms = platforms || ["instagram", "linkedin", "twitter"];
    const targetTopics = topics || ["AI marketing trends", "automation case studies", "growth hacking", "client results", "industry insights"];

    const { text: contentJson } = await generateText({
      model: google("gemini-2.5-pro"),
      prompt: `Act as a cynical, high-level marketing operator. You are generating a 7-day social media content calendar for an agency.

INDUSTRY FOCUS: ${industry || "Digital Marketing & AI"}
PLATFORMS: ${targetPlatforms.join(", ")}
TOPICS: ${targetTopics.join(", ")}

Generate EXACTLY 7 posts in this JSON format:
[
  {
    "day": 1,
    "platform": "instagram",
    "topic": "...",
    "caption": "...",
    "hashtags": "...",
    "imagePrompt": "...",
    "bestTime": "09:00"
  }
]

CRITICAL "ANTI-SLOP" RULES (FAILURE IS UNACCEPTABLE):
1. **NO AI SPEAK:** Never use words like "delve, testament, beacon, navigate, landscape, dynamic, synergy."
2. **NO EMOJI VOMIT:** Use max 1 emoji per post, or 0.
3. **TONE:** Sharp, opinionated, slightly contrarian, punchy. Write like a tired founder giving real advice, not a bubbly intern.
4. **FORMAT:** Short sentences. 8th-grade reading level. 
5. **PLATFORM NATIVE:** X/Twitter posts must be single-thought micro-rants. LinkedIn posts must be contrarian reality-checks, not humble-brags. Instagram captions must be direct and aesthetic.
6. **CAPTIONS:** Keep them under 100 words. Cut the fluff. Start with a hook that pisses off conventional thinkers.

Output ONLY the JSON array.`,
    });

    let posts;
    try {
      const cleaned = contentJson.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      posts = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: "Failed to parse content" }, { status: 500 });
    }

    // Schedule each post in the Content Calendar
    const now = new Date();
    const scheduled = [];

    for (const post of posts) {
      const scheduleDate = new Date(now);
      scheduleDate.setDate(now.getDate() + (post.day - 1));
      const [hours, minutes] = (post.bestTime || "09:00").split(":").map(Number);
      scheduleDate.setHours(hours, minutes, 0, 0);

      const entry = await db.insert(scheduledContent).values({
        topic: post.caption,
        platform: post.platform,
        scheduledAt: scheduleDate,
        status: "scheduled",
        imagePrompt: post.imagePrompt || null,
      }).returning();

      scheduled.push({ ...post, id: entry[0]?.id, scheduledFor: scheduleDate.toISOString() });
    }

    return NextResponse.json({
      success: true,
      postsGenerated: scheduled.length,
      posts: scheduled,
      message: `${scheduled.length} posts generated and scheduled for the next 7 days`,
    });
  } catch (error) {
    console.error("[Content Generator Error]:", error);
    return NextResponse.json({ error: "Content generation failed" }, { status: 500 });
  }
}
