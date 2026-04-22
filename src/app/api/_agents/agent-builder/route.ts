import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * AGENT-BUILDER — Natural-language → new-agent scaffolding.
 *
 * A moat agent. Describe an agent in plain English and get back a
 * factory-compliant route file, a matching mocked-ai vitest suite,
 * the system prompt, and the JSON output schema. Self-expanding
 * platform — only possible because we own the factory and the
 * verification stack.
 *
 * Input:
 *   {
 *     purpose:         string            — NL description
 *     expectedInputs?: string[]          — input field hints
 *     expectedOutput?: string            — output shape hint
 *     model?:          "claude"|"gemini"|"nim"  (default "claude")
 *   }
 *
 * Output:
 *   {
 *     suggestedSlug: string       — kebab-case, purpose-first
 *     routeCode:     string       — full route.ts source
 *     testCode:      string       — full vitest suite source
 *     systemPrompt:  string       — extracted system prompt
 *     outputSchema:  string       — JSON schema (as string)
 *   }
 */

const AGENT_BUILDER_SYSTEM_PROMPT = `You are a platform architect for the Sovereign Matrix agent factory. You turn natural-language agent descriptions into factory-compliant route code + a vitest skeleton.

${ANTI_SLOP_RULES}

## ARCHITECTURE RULES
1. Every agent is a createAgentRoute({ name, requiredFields, handler }) export. Handler takes { input } and returns JSON.
2. Slugs are kebab-case, purpose-first (extract-invoice NOT invoiceAgent, summarize-meeting NOT summarizer).
3. Agents call ai(prompt, { system, model, maxTokens }) — never fetch directly.
4. JSON outputs are parsed with a markdown-fence strip before JSON.parse, and throw on parse failure so the factory error envelope kicks in.
5. System prompts embed ANTI_SLOP_RULES from @/lib/content-engine.
6. Tests mock @/lib/ai and @/lib/agent-factory (passthrough) so the handler can be invoked directly.

## SAFETY RULES
- Refuse agents that self-modify the platform, exfiltrate secrets, bypass auth, override safety gates, or do anything destructive. For refusals, set suggestedSlug to "refused" and routeCode/testCode to a short explanation starting with "// REFUSED:".
- Never generate agents that execute arbitrary user code on the server without a sandbox.

## OUTPUT
Return VALID JSON only — no markdown fences, no prose.`;

export const POST = createAgentRoute({
  name: "agent-builder",
  requiredFields: ["purpose"],
  handler: async ({ input }) => {
    const {
      purpose,
      expectedInputs,
      expectedOutput,
      model = "claude",
    } = input as {
      purpose: string;
      expectedInputs?: string[];
      expectedOutput?: string;
      model?: "claude" | "gemini" | "nim";
    };

    const prompt = `Generate a new Sovereign Matrix agent.

PURPOSE:
"""
${purpose.slice(0, 4000)}
"""

EXPECTED INPUTS: ${expectedInputs ? JSON.stringify(expectedInputs) : "(infer from purpose)"}
EXPECTED OUTPUT: ${expectedOutput ? expectedOutput.slice(0, 1000) : "(infer from purpose)"}
PREFERRED MODEL: ${model}

SCHEMA:
{
  "suggestedSlug": string,
  "routeCode":     string,
  "testCode":      string,
  "systemPrompt":  string,
  "outputSchema":  string
}`;

    const response = await ai(prompt, {
      system: AGENT_BUILDER_SYSTEM_PROMPT,
      maxTokens: 4000,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Agent builder failed: model returned non-JSON output");
    }

    return { success: true, generated: parsed };
  },
});
