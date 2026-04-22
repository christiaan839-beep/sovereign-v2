import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * TASK-PRIORITIZER — Eisenhower-matrix prioritization for a task list.
 *
 * Takes a task list (title + optional deadline/effort/dependencies) plus
 * an optional natural-language context describing the week's goals and
 * returns four quadrants + a today-recommendation shortlist.
 *
 * Input:
 *   {
 *     tasks: Array<{
 *       title:         string,
 *       deadline?:     string,   // ISO or human date
 *       effort?:       string,   // "15m", "2h", "half-day"
 *       dependencies?: string[]  // other task titles this depends on
 *     }>,
 *     context?: string  // NL — this week's focus
 *   }
 *
 * Output (JSON):
 *   {
 *     urgent_important:       string[],
 *     important_not_urgent:   string[],
 *     urgent_not_important:   string[],
 *     neither:                string[],
 *     todayRecommendation:    string[],
 *     rationale:              string
 *   }
 *
 * Pairs with:
 *   - `inbox-triage` — surface reply-later items as tasks
 *   - `meeting-scheduler` — block focus time for important_not_urgent
 */

const TASK_PRIORITIZER_SYSTEM_PROMPT = `You are a strategic operator trained to force-rank work using Eisenhower's urgent/important matrix with honest judgment.

${ANTI_SLOP_RULES}

## PRIORITIZATION RULES
1. NEVER fabricate dependencies. Use only the dependencies array provided on each task. Do not infer implicit dependencies that the caller didn't state.
2. "Urgent" = has a deadline today/tomorrow OR is blocking another unblocked task. "Important" = advances a stated goal or has high ROI.
3. Every task MUST appear in exactly one of the four quadrants. Use the exact task title string — do not rewrite it.
4. The todayRecommendation list contains 3–5 task titles the operator should do today. Prefer urgent_important, then important_not_urgent with near deadlines.
5. If a task has unmet dependencies (a dependency that isn't marked done), prefer scheduling it for after the dependency — do not put it in today's recommendation unless dependencies are clearly trivial.
6. Rationale explains the top 3 decisions in 1–2 sentences each, focusing on the hardest trade-offs.
7. Output VALID JSON only — no markdown fences, no prose, no trailing commas.`;

export const POST = createAgentRoute({
  name: "task-prioritizer",
  requiredFields: ["tasks"],
  handler: async ({ input }) => {
    const { tasks, context } = input as {
      tasks: Array<{
        title: string;
        deadline?: string;
        effort?: string;
        dependencies?: string[];
      }>;
      context?: string;
    };

    const prompt = `Prioritize these tasks using the Eisenhower matrix. Return ONLY valid JSON matching the schema.

TASKS:
${JSON.stringify(tasks, null, 2)}

${context ? `CONTEXT: ${context}` : ""}

SCHEMA:
{
  "urgent_important":      [ string ],
  "important_not_urgent":  [ string ],
  "urgent_not_important":  [ string ],
  "neither":               [ string ],
  "todayRecommendation":   [ string ],
  "rationale":             string
}`;

    const response = await ai(prompt, {
      system: TASK_PRIORITIZER_SYSTEM_PROMPT,
      maxTokens: 1500,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Task prioritization failed: model returned non-JSON output");
    }

    return { success: true, prioritization: parsed };
  },
});
