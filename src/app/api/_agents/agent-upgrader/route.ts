import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * AGENT-UPGRADER — Auto-patch an agent's prompt based on failure history.
 *
 * Feed it the current prompt + a list of {input, output, whyFailed}
 * triples and it proposes a minimal prompt edit that addresses the
 * failure pattern, with an explicit hypothesis and a list of risks
 * the change could introduce elsewhere.
 *
 * Input:
 *   {
 *     currentPrompt: string
 *     failures: Array<{ input: string, output: string, whyFailed: string }>
 *   }
 *
 * Output:
 *   {
 *     proposedPrompt: string
 *     changes:        string[]   — bulletable edits
 *     hypothesis:     string     — WHY this fixes it
 *     risksOfChange:  string[]   — side-effects to watch for
 *   }
 */

const AGENT_UPGRADER_SYSTEM_PROMPT = `You are a prompt refinement specialist. You receive a current system prompt and a list of production failures, and you propose the SMALLEST possible prompt edit that addresses the failure pattern.

${ANTI_SLOP_RULES}

## RULES
1. Every change must map to a specific failure mode in the failures list. No cosmetic rewrites.
2. Additive > destructive — prefer adding a clarifying rule over removing an existing line.
3. Preserve voice, structure, and existing rules that haven't caused failures.
4. If failures are contradictory (some say too long, some say too short) call that out in risksOfChange and propose a middle path.
5. If you can't find a fix that is minimal AND addresses the pattern, return the current prompt unchanged with an honest hypothesis and risks.

## OUTPUT SCHEMA
{
  "proposedPrompt": string,
  "changes":        [string],
  "hypothesis":     string,
  "risksOfChange":  [string]
}

Return VALID JSON only — no markdown fences, no prose.`;

export const POST = createAgentRoute({
  name: "agent-upgrader",
  requiredFields: ["currentPrompt", "failures"],
  handler: async ({ input }) => {
    const { currentPrompt, failures } = input as {
      currentPrompt: string;
      failures: Array<{ input: string; output: string; whyFailed: string }>;
    };

    const failuresText = (failures || [])
      .slice(0, 20)
      .map(
        (f, i) =>
          `[FAILURE ${i + 1}]\nINPUT: ${String(f.input || "").slice(0, 800)}\nOUTPUT: ${String(f.output || "").slice(0, 800)}\nWHY FAILED: ${String(f.whyFailed || "").slice(0, 400)}`,
      )
      .join("\n\n---\n\n");

    const prompt = `Propose a minimal patch to this prompt based on the failures.

CURRENT PROMPT:
"""
${currentPrompt.slice(0, 8000)}
"""

FAILURES:
"""
${failuresText}
"""

SCHEMA:
{
  "proposedPrompt": string,
  "changes": [string],
  "hypothesis": string,
  "risksOfChange": [string]
}`;

    const response = await ai(prompt, {
      system: AGENT_UPGRADER_SYSTEM_PROMPT,
      maxTokens: 3000,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Agent upgrade failed: model returned non-JSON output");
    }

    return { success: true, upgrade: parsed };
  },
});
