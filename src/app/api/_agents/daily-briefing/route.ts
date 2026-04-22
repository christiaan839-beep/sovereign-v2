import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * DAILY-BRIEFING — Compose a morning digest for a busy operator.
 *
 * Input:
 *   {
 *     meetings: Array<{ title, time, attendees? }>,
 *     slackDigest?:   string,
 *     emailSummary?:  string,
 *     tasksDue?:      string[],
 *     weather?:       string
 *   }
 *
 * Output (JSON):
 *   {
 *     headline:             string (<= 120 words),
 *     keyPriorities:        string[],
 *     recommendedSequence:  string[],
 *     risks:                string[],
 *     coffeeTime:           string   // "hh:mm", 15 min before first meeting
 *   }
 *
 * Pairs with:
 *   - `sales:daily-briefing` — sales-flavored variant
 *   - `slack-by-salesforce:standup` — upstream activity capture
 */

const BRIEFING_SYSTEM_PROMPT = `You are an executive assistant composing a calm, directive morning briefing.

${ANTI_SLOP_RULES}

## BRIEFING RULES
1. headline is <=120 words, calm, directive, action-oriented. No cheerful filler ("Good morning! What a day!"). Start with the most consequential moment of the day.
2. keyPriorities: 3-5 items. Each prefixed with a concrete verb.
3. recommendedSequence: chronological ordering of the day. Group adjacent related work together.
4. risks: schedule collisions, prep gaps for important meetings, overdue tasks. Empty array if none — do not invent anxiety.
5. coffeeTime: 15 minutes before the earliest meeting. Format "hh:mm" 24-hour. If no meetings, use "08:00".
6. Never fabricate attendees, topics, or tasks that weren't in the input.
7. Output VALID JSON only — no markdown fences, no prose, no trailing commas.`;

export const POST = createAgentRoute({
  name: "daily-briefing",
  requiredFields: ["meetings"],
  handler: async ({ input }) => {
    const { meetings, slackDigest, emailSummary, tasksDue, weather } =
      input as {
        meetings: Array<{ title: string; time: string; attendees?: string[] }>;
        slackDigest?: string;
        emailSummary?: string;
        tasksDue?: string[];
        weather?: string;
      };

    if (!Array.isArray(meetings)) {
      throw new Error("Daily briefing failed: meetings must be an array");
    }

    const meetingLines = meetings
      .map((m) => {
        const attendees = m.attendees?.length ? ` with ${m.attendees.join(", ")}` : "";
        return `- ${m.time} — ${m.title}${attendees}`;
      })
      .join("\n");

    const tasksSection = tasksDue?.length
      ? `\n\nTASKS DUE:\n${tasksDue.map((t) => `- ${t}`).join("\n")}`
      : "";

    const prompt = `Compose a morning briefing. Return ONLY valid JSON.

MEETINGS:
${meetingLines || "(none)"}

SLACK:
${slackDigest ?? "(none)"}

EMAIL:
${emailSummary ?? "(none)"}
${tasksSection}

WEATHER:
${weather ?? "(unavailable)"}

SCHEMA:
{
  "headline": string,
  "keyPriorities": [ string ],
  "recommendedSequence": [ string ],
  "risks": [ string ],
  "coffeeTime": string
}`;

    const response = await ai(prompt, {
      system: BRIEFING_SYSTEM_PROMPT,
      maxTokens: 1500,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Daily briefing failed: model returned non-JSON output");
    }

    return { success: true, result: parsed };
  },
});
