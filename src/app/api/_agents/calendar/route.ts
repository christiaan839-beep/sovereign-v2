import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * Content Calendar API
 * Generates strategic content calendars with daily posting schedules.
 */

export const POST = createAgentRoute({
  name: "calendar",
  // Wave 131 M3 batch 21: memory hooks. Per-niche content calendar
  // continuity — prior calendars for the same niche+platforms+goal
  // let the next plan dedupe topics and rotate pillars instead of
  // repeating the same Monday-Wednesday-Friday cadence verbatim.
  memory: {
    search: {
      query: (input) =>
        `calendar ${input.niche ?? "?"} ${Array.isArray(input.platforms) ? (input.platforms as string[]).slice(0, 3).join(",") : ""} ${String(input.contentGoal ?? "").slice(0, 60)}`,
      limit: 2,
    },
    store: {
      extract: (result) => {
        const r = result as {
          calendar?: Array<{ week?: number; days?: Array<{ topic?: string }> }>;
          niche?: string;
        };
        if (!r.calendar?.length) return null;
        const topics = r.calendar
          .flatMap((w) => (w.days ?? []).map((d) => d.topic ?? "?"))
          .filter((t) => t !== "?")
          .slice(0, 5)
          .join(" · ");
        return `calendar[${r.niche ?? "?"}]: ${topics}`;
      },
      metadata: (input) => ({
        kind: "calendar",
        niche: typeof input.niche === "string" ? input.niche.slice(0, 80) : "",
      }),
    },
  },
  handler: async ({ input }) => {
    const { niche, platforms, weeks, contentGoal } = input as {
      niche?: string;
      platforms?: string[];
      weeks?: number;
      contentGoal?: string;
    };

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
      const cleaned = result
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { calendar: [], rawOutput: result };
    }

    return { success: true, ...parsed };
  },
});
