import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * MEETING-SCHEDULER — Suggest optimal meeting times from attendee availability.
 *
 * Takes a list of attendees with their free-ISO-datetime arrays, an optional
 * meeting duration, natural-language intent, and timezone, then returns
 * ranked time slots where everyone (or as many as possible) are free.
 *
 * Input:
 *   {
 *     attendees:       Array<{ email: string, availability: string[] }>, // ISO datetimes
 *     durationMinutes?: number,   // 15–240, default 30
 *     intent?:          string,   // NL context, e.g. "quarterly review"
 *     timeZone?:        string    // IANA zone, default "UTC"
 *   }
 *
 * Output (JSON):
 *   {
 *     suggestedSlots: Array<{ start: ISO, end: ISO, score: 0-100, conflicts: string[] }>,
 *     reasoning:      string,
 *     fallback:       string
 *   }
 *
 * Pairs with:
 *   - `calendar` — downstream event creation
 *   - `inbox-triage` — scheduler invitation parsing
 */

const MEETING_SCHEDULER_SYSTEM_PROMPT = `You are an executive scheduling specialist trained to find optimal meeting times across multiple calendars with surgical precision.

${ANTI_SLOP_RULES}

## SCHEDULING RULES
1. NEVER fabricate availability. Only suggest slots where attendee-provided availability arrays actually overlap. If zero slots overlap for all attendees, return an empty suggestedSlots array and explain in the fallback field.
2. Only propose slots that fit within the requested durationMinutes window — a 30-min meeting needs a 30-minute overlap, not a single shared timestamp.
3. Score slots 0–100 on coverage (how many attendees are free) + earliness (earlier in the week beats later) + roundness (top-of-hour beats mid-hour).
4. If partial overlap exists (some but not all attendees free), list missing attendees in the conflicts[] array for that slot.
5. All datetimes must be ISO 8601 with timezone offset. Respect the caller's requested timeZone for display reasoning.
6. The fallback field should suggest an async alternative (e.g. "Consider a shared doc review") when zero 100-score slots exist.
7. Output VALID JSON only — no markdown fences, no prose, no trailing commas.`;

export const POST = createAgentRoute({
  name: "meeting-scheduler",
  requiredFields: ["attendees"],
  handler: async ({ input }) => {
    const {
      attendees,
      durationMinutes = 30,
      intent,
      timeZone = "UTC",
    } = input as {
      attendees: Array<{ email: string; availability: string[] }>;
      durationMinutes?: number;
      intent?: string;
      timeZone?: string;
    };

    const prompt = `Find the best meeting slots for these attendees. Return ONLY valid JSON matching the schema.

ATTENDEES (with ISO datetimes they are FREE):
${JSON.stringify(attendees, null, 2)}

DURATION: ${durationMinutes} minutes
TIMEZONE: ${timeZone}
${intent ? `INTENT: ${intent}` : ""}

SCHEMA:
{
  "suggestedSlots": [
    { "start": string (ISO), "end": string (ISO), "score": number (0-100), "conflicts": [ string ] }
  ],
  "reasoning": string,
  "fallback": string
}`;

    const response = await ai(prompt, {
      system: MEETING_SCHEDULER_SYSTEM_PROMPT,
      maxTokens: 1500,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Meeting scheduling failed: model returned non-JSON output");
    }

    return { success: true, schedule: parsed };
  },
});
