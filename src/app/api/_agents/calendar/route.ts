import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * Content Calendar API
 * Generates strategic content calendars with daily posting schedules.
 */

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { niche, platforms, weeks, contentGoal } = await req.json();

    const prompt = `Generate a ${weeks || 4}-week content calendar for:

NICHE: ${niche || "AI marketing"}
PLATFORMS: ${(platforms || ["instagram", "linkedin", "twitter"]).join(", ")}
CONTENT GOAL: ${contentGoal || "Build authority and generate inbound leads"}

For each day (Monday-Friday), generate:
1. PLATFORM: Which platform to post on
2. CONTENT TYPE: Blog, carousel, reel, thread, newsletter, story
3. TOPIC: Specific post topic
4. HOOK: The opening line that stops the scroll
5. CONTENT PILLAR: Which pillar this serves (educate, inspire, entertain, promote)
6. BEST TIME: Optimal posting time

Respond in JSON:
{
  "calendar": [
    {
      "week": 1,
      "days": [
        {
          "day": "Monday",
          "date": "Week 1 Monday",
          "platform": "instagram",
          "contentType": "carousel",
          "topic": "...",
          "hook": "...",
          "pillar": "educate",
          "bestTime": "9:00 AM"
        }
      ]
    }
  ],
  "contentPillars": ["Pillar 1", "Pillar 2", "Pillar 3", "Pillar 4"],
  "strategy": "Brief overview of the calendar strategy"
}`;

    const systemPrompt = `You are a content strategist who plans viral content calendars. Every post must have a clear purpose and be part of a larger narrative arc.\n\n${ANTI_SLOP_RULES}`;

    const result = await ai(prompt, { system: systemPrompt, maxTokens: 4000 });

    let parsed;
    try {
      const cleaned = result.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { calendar: [], rawOutput: result };
    }

    return NextResponse.json({ success: true, ...parsed });
  } catch (err) {
    console.error("[Calendar] Error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
